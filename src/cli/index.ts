#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, basename, extname } from 'path';
import { setup, setupSchema, setupGitSchema, setupFileHashSchema, ensureProjectGraph, dropProjectGraph, listProjectGraphs, dropAllTables } from '../db/schema.js';
import { closePool } from '../db/connection.js';
import { updateEmbedding, deleteFileEmbeddings, deleteProjectEmbeddings, listProjects, getIndexedFileHashes, upsertFileHash, deleteProjectFileHashes } from '../db/queries.js';
import { collectFiles, scanDirectory } from '../parser/scanner.js';
import { generateEmbedding, buildEmbeddingText } from '../embeddings/ollama.js';
import { clearFileVertices, addVertex, addEdge, upsertFileVertex, getFileHash } from '../graph/operations.js';
import { ProgressBar } from './progress.js';
import { extractGitCommits, buildCommitEmbeddingText } from '../git/extractor.js';
import { upsertGitCommit, getIndexedCommitHashes, deleteProjectGitCommits } from '../db/git-queries.js';
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
  .description('Index a codebase for semantic search (embeddings only)')
  .option('--project <name>', 'Project name (defaults to directory basename)')
  .action(async (directory: string, opts: { project?: string }) => {
    const dir = resolve(directory);
    const project = opts.project
      ? sanitizeProjectName(opts.project)
      : sanitizeProjectName(basename(dir));

    console.log(`Indexing: ${dir}`);
    console.log(`Project: ${project}`);

    // Setup database (embeddings only, no graph)
    console.log('Setting up database schema...');
    await setupSchema();
    await setupGitSchema();
    await setupFileHashSchema();

    const progress = new ProgressBar(0);

    // Stage 1: Collect files
    progress.setStage('Collecting files', 1, 3);
    const files = collectFiles(dir);
    console.log(`Found ${files.length} source files`);

    // Stage 2: Scan for changes
    progress.setStage('Scanning for changes', 2, 3);
    const indexedHashes = await getIndexedFileHashes(project);
    console.log(`Already indexed: ${indexedHashes.size} files`);

    const scanned = scanDirectory(dir, files);

    // Identify changed files
    const changedFiles: typeof scanned = [];
    const unchangedFiles: typeof scanned = [];
    for (const file of scanned) {
      const existingHash = indexedHashes.get(file.relativePath);
      if (existingHash === file.hash) {
        unchangedFiles.push(file);
      } else {
        changedFiles.push(file);
      }
    }

    console.log(`Changed: ${changedFiles.length} files | Unchanged: ${unchangedFiles.length} files (skipped)`);

    if (changedFiles.length === 0) {
      console.log('Nothing to index.');
      await closePool();
      return;
    }

    // Cross-file dedup: remove header prototypes when a definition exists in a .c file.
    const allNodes: CodeNode[] = [];
    for (const file of scanned) {
      allNodes.push(...file.extraction.nodes);
    }
    const definedFunctions = new Set(
      allNodes
        .filter(n => n.kind === 'function' && n.startLine !== n.endLine)
        .map(n => n.name)
    );

    // Stage 3: Generate embeddings for changed files
    progress.setStage('Generating embeddings', 3, 3);
    progress.reset(changedFiles.length + unchangedFiles.length);

    // Mark unchanged files as skipped
    for (const _ of unchangedFiles) {
      progress.incrementSkipped();
    }

    // Process changed files and generate embeddings
    for (const file of changedFiles) {
      progress.setCurrentItem(file.relativePath);

      // Clear old embeddings for this file
      await deleteFileEmbeddings(file.relativePath, project);

      // Filter out prototype nodes that have a definition elsewhere
      const nodes = file.extraction.nodes.filter(n => {
        if (n.kind === 'function' && n.startLine === n.endLine && definedFunctions.has(n.name)) {
          return false; // Skip prototype when a multi-line definition exists
        }
        return true;
      });

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

      // Update file hash after successful processing
      await upsertFileHash(file.relativePath, file.hash, project);

      progress.incrementFiles();
    }

    progress.finish();

    await closePool();
  });

program
  .command('graph <directory>')
  .description('Build code graph (vertices and edges) for a codebase')
  .option('--project <name>', 'Project name (defaults to directory basename)')
  .action(async (directory: string, opts: { project?: string }) => {
    const dir = resolve(directory);
    const project = opts.project
      ? sanitizeProjectName(opts.project)
      : sanitizeProjectName(basename(dir));

    console.log(`Building graph: ${dir}`);
    console.log(`Project: ${project}`);

    // Setup project-specific graph
    console.log('Setting up project graph...');
    await ensureProjectGraph(project);

    const progress = new ProgressBar(0);

    // Stage 1: Collect files
    progress.setStage('Collecting files', 1, 3);
    const files = collectFiles(dir);
    console.log(`Found ${files.length} source files`);

    // Stage 2: Scan for changes
    progress.setStage('Scanning for changes', 2, 3);
    const scanned = scanDirectory(dir, files);

    // Identify changed files by comparing with stored file hashes in graph
    const changedFiles: typeof scanned = [];
    const unchangedFiles: typeof scanned = [];
    for (const file of scanned) {
      const existingHash = await getFileHash(file.relativePath, project);
      if (existingHash === file.hash) {
        unchangedFiles.push(file);
      } else {
        changedFiles.push(file);
      }
    }

    console.log(`Changed: ${changedFiles.length} files | Unchanged: ${unchangedFiles.length} files (skipped)`);

    if (changedFiles.length === 0) {
      console.log('Nothing to build.');
      await closePool();
      return;
    }

    // Cross-file dedup: remove header prototypes when a definition exists in a .c file.
    const allNodes: CodeNode[] = [];
    for (const file of scanned) {
      allNodes.push(...file.extraction.nodes);
    }
    const definedFunctions = new Set(
      allNodes
        .filter(n => n.kind === 'function' && n.startLine !== n.endLine)
        .map(n => n.name)
    );

    // Stage 3: Build graph for changed files
    progress.setStage('Building graph', 3, 3);
    progress.reset(changedFiles.length + unchangedFiles.length);

    // Mark unchanged files as skipped
    for (const _ of unchangedFiles) {
      progress.incrementSkipped();
    }

    // Pass 1: Clear old data and create vertices for changed files
    for (const file of changedFiles) {
      progress.setCurrentItem(file.relativePath);

      // Clear old graph data for this file
      await clearFileVertices(file.relativePath, project);

      // Upsert file vertex in graph (this also updates the hash)
      await upsertFileVertex(file.relativePath, file.hash, project);

      // Filter out prototype nodes that have a definition elsewhere
      const nodes = file.extraction.nodes.filter(n => {
        if (n.kind === 'function' && n.startLine === n.endLine && definedFunctions.has(n.name)) {
          return false;
        }
        return true;
      });

      // Create vertices
      for (const node of nodes) {
        try {
          await addVertex(node, project);
        } catch (err) {
          // Vertex may already exist; skip
        }
      }
      progress.addNodes(nodes.length);
      progress.incrementFiles();
    }

    // Pass 2: Create edges for changed files (all vertices now exist)
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
  .command('index-git <directory>')
  .description('Index git commit history for semantic search')
  .option('--project <name>', 'Project name (defaults to directory basename)')
  .option('--max-commits <n>', 'Maximum number of commits to index', '500')
  .action(async (directory: string, opts: { project?: string; maxCommits?: string }) => {
    const dir = resolve(directory);
    const project = opts.project
      ? sanitizeProjectName(opts.project)
      : sanitizeProjectName(basename(dir));
    const maxCommits = parseInt(opts.maxCommits ?? '500', 10);

    console.log(`Indexing git history: ${dir}`);
    console.log(`Project: ${project}`);

    console.log('Setting up database schema...');
    await setupSchema();
    await setupGitSchema();

    // Get already-indexed commit hashes for incremental support
    const indexed = await getIndexedCommitHashes(project);
    console.log(`Already indexed: ${indexed.size} commits`);

    // Extract commits from git
    const allCommits = extractGitCommits(dir, project);
    const newCommits = allCommits
      .filter(c => !indexed.has(c.commitHash))
      .slice(0, maxCommits);
    const skippedCount = allCommits.length - newCommits.length;
    console.log(`Found ${allCommits.length} total commits, ${newCommits.length} new to index`);

    if (newCommits.length === 0) {
      console.log('Nothing to index.');
      await closePool();
      return;
    }

    const progress = new ProgressBar(newCommits.length + skippedCount, 'commits');
    for (let i = 0; i < skippedCount; i++) {
      progress.incrementSkipped();
    }

    for (const commit of newCommits) {
      try {
        const text = buildCommitEmbeddingText(commit);
        const embedding = await generateEmbedding(text);
        await upsertGitCommit(
          commit.commitHash, project, commit.author, commit.date,
          commit.message, commit.filesChanged, commit.diffSummary, embedding
        );
        progress.addEmbeddings(1);
      } catch (err) {
        console.error(`\n  Failed to index commit ${commit.commitHash.substring(0, 7)}: ${err}`);
      }
      progress.incrementFiles();
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

    await setupSchema();
    await setupGitSchema();
    await setupFileHashSchema();

    const embeddingsDeleted = await deleteProjectEmbeddings(project);
    const gitCommitsDeleted = await deleteProjectGitCommits(project);
    const fileHashesDeleted = await deleteProjectFileHashes(project);

    // Drop the entire project graph
    await dropProjectGraph(project);

    console.log('');
    console.log('--- Deletion Summary ---');
    console.log(`Project: ${project}`);
    console.log(`Embeddings deleted: ${embeddingsDeleted}`);
    console.log(`Git commits deleted: ${gitCommitsDeleted}`);
    console.log(`File hashes deleted: ${fileHashesDeleted}`);
    console.log(`Graph dropped: code_graph_${project}`);

    await closePool();
  });

program
  .command('prune')
  .description('Reset database by dropping all tables and graphs')
  .option('--force', 'Required flag to confirm reset')
  .action(async (opts: { force?: boolean }) => {
    if (!opts.force) {
      console.error('Error: --force flag is required to confirm reset.');
      console.error('Usage: code-context-mcp prune --force');
      process.exit(1);
    }

    console.log('Pruning all indexed data...');
    console.log('');

    // Load AGE extension and list all project graphs
    const projects = await listProjectGraphs();

    // Drop all project graphs
    console.log('Dropping project graphs:');
    if (projects.length === 0) {
      console.log('  (no graphs found)');
    } else {
      for (const project of projects) {
        await dropProjectGraph(project);
        console.log(`  - code_graph_${project} (dropped)`);
      }
    }
    console.log('');

    // Drop all tables
    console.log('Dropping tables...');
    await dropAllTables();
    console.log('  - embeddings (dropped)');
    console.log('  - git_commits (dropped)');
    console.log('  - file_hashes (dropped)');
    console.log('');

    // Recreate schema
    console.log('Recreating schema...');
    await setupSchema();
    console.log('  - embeddings (created)');
    await setupGitSchema();
    console.log('  - git_commits (created)');
    await setupFileHashSchema();
    console.log('  - file_hashes (created)');
    console.log('');

    // Print summary
    console.log('--- Prune Summary ---');
    console.log(`Graphs dropped: ${projects.length}`);
    console.log('Tables reset: 3');
    console.log('Database is now clean.');

    await closePool();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Command failed:', err);
  process.exit(1);
});
