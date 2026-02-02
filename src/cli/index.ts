#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, basename, extname } from 'path';
import { setup } from '../db/schema.js';
import { closePool } from '../db/connection.js';
import { updateEmbedding, deleteFileEmbeddings, deleteProjectEmbeddings, listProjects } from '../db/queries.js';
import { collectFiles, scanDirectory } from '../parser/scanner.js';
import { generateEmbedding, buildEmbeddingText } from '../embeddings/ollama.js';
import { clearFileVertices, populateGraph, addVertex, addEdge, upsertFileVertex, getFileHash, deleteProjectGraph } from '../graph/operations.js';
import { ProgressBar } from './progress.js';
import type { CodeNode, Relationship } from '../types.js';

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const program = new Command();

program
  .name('code-context-mcp')
  .description('Semantic code search and dependency graph analysis')
  .version('0.1.0');

program
  .command('index <directory>')
  .description('Index a codebase for semantic search and graph analysis')
  .option('--project <name>', 'Project name (defaults to directory basename)')
  .action(async (directory: string, opts: { project?: string }) => {
    const dir = resolve(directory);
    const project = opts.project
      ? sanitizeProjectName(opts.project)
      : sanitizeProjectName(basename(dir));

    console.log(`Indexing: ${dir}`);
    console.log(`Project: ${project}`);

    // Setup database
    console.log('Setting up database schema and graph...');
    await setup();

    // Collect files
    const files = collectFiles(dir);
    console.log(`Found ${files.length} source files`);

    // Parse and check for changes
    const scanned = scanDirectory(dir, files);
    const progress = new ProgressBar(scanned.length);

    // Two-pass indexing: vertices first, then edges.
    // This ensures cross-file relationships (e.g., main -> init_server across files)
    // can be resolved, since both endpoints must exist before creating an edge.

    // Collect all extractions from changed files
    const changedFiles: Array<typeof scanned[0]> = [];
    for (const file of scanned) {
      const existingHash = await getFileHash(file.relativePath, project);
      if (existingHash === file.hash) {
        progress.incrementSkipped();
        continue;
      }
      changedFiles.push(file);
    }

    // Cross-file dedup: remove header prototypes when a definition exists in a .c file.
    // In C, a .h file often declares `void foo();` (prototype, single-line) while the
    // .c file has the full definition `void foo() { ... }` (multi-line). Keeping both
    // creates duplicate graph vertices that cause duplicate edges at deeper call levels.
    const allNodes: CodeNode[] = [];
    for (const file of changedFiles) {
      allNodes.push(...file.extraction.nodes);
    }
    const definedFunctions = new Set(
      allNodes
        .filter(n => n.kind === 'function' && n.startLine !== n.endLine)
        .map(n => n.name)
    );

    // Pass 1: Clear old data, create vertices, generate embeddings
    for (const file of changedFiles) {
      // Clear old data
      await deleteFileEmbeddings(file.relativePath, project);
      await clearFileVertices(file.relativePath, project);

      // Upsert file vertex in graph
      await upsertFileVertex(file.relativePath, file.hash, project);

      // Filter out prototype nodes that have a definition elsewhere
      const ext = extname(file.relativePath);
      const nodes = file.extraction.nodes.filter(n => {
        if (n.kind === 'function' && n.startLine === n.endLine && definedFunctions.has(n.name)) {
          return false; // Skip prototype when a multi-line definition exists
        }
        return true;
      });

      // Create vertices only (defer edges to pass 2)
      for (const node of nodes) {
        try {
          await addVertex(node, project);
        } catch (err) {
          // Vertex may already exist; skip
        }
      }
      progress.addNodes(nodes.length);

      // Generate and store embeddings
      for (const node of nodes) {
        try {
          const text = buildEmbeddingText(node.name, node.signature, node.body);
          const embedding = await generateEmbedding(text);
          await updateEmbedding(node.name, node.filePath, embedding, project);
          progress.addEmbeddings(1);
        } catch (err) {
          console.error(`\n    Failed to generate embedding for ${node.name}: ${err}`);
        }
      }

      progress.incrementFiles();
    }

    // Pass 2: Create edges (all vertices now exist)
    for (const file of changedFiles) {
      for (const rel of file.extraction.relationships) {
        try {
          await addEdge(rel, project);
        } catch (err) {
          // Target may not exist (external dependency); skip
        }
      }
    }

    progress.finish();

    await closePool();
  });

program
  .command('delete <project-name>')
  .description('Delete all indexed data for a project')
  .option('--force', 'Required flag to confirm deletion')
  .action(async (projectName: string, opts: { force?: boolean }) => {
    if (!opts.force) {
      console.error('Error: --force flag is required to confirm deletion.');
      console.error('Usage: code-context-mcp delete <project-name> --force');
      process.exit(1);
    }

    const project = sanitizeProjectName(projectName);

    // Check if project exists
    const projects = await listProjects();
    const existing = projects.find(p => p.project === project);
    if (!existing) {
      console.error(`Project "${project}" not found.`);
      if (projects.length > 0) {
        console.error('Available projects:');
        for (const p of projects) {
          console.error(`  - ${p.project} (${p.nodeCount} embeddings)`);
        }
      }
      process.exit(1);
    }

    console.log(`Deleting project "${project}"...`);

    await setup();

    const embeddingsDeleted = await deleteProjectEmbeddings(project);
    const verticesDeleted = await deleteProjectGraph(project);

    console.log('');
    console.log('--- Deletion Summary ---');
    console.log(`Project: ${project}`);
    console.log(`Embeddings deleted: ${embeddingsDeleted}`);
    console.log(`Graph vertices deleted: ${verticesDeleted}`);

    await closePool();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Command failed:', err);
  process.exit(1);
});
