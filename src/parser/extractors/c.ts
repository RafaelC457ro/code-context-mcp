import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import type { CodeNode, Relationship, NodeKind } from '../../types.js';
import type { LanguageExtractor, ExtractionResult } from './types.js';
import { findDescendants } from './helpers.js';

const parser = new Parser();
parser.setLanguage(C);

function visitNode(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  switch (node.type) {
    case 'function_definition':
      extractFunction(node, filePath, nodes, relationships);
      break;
    case 'struct_specifier':
      extractStruct(node, filePath, nodes);
      break;
    case 'enum_specifier':
      extractEnum(node, filePath, nodes);
      break;
    case 'type_definition':
      extractTypedef(node, filePath, nodes);
      break;
    case 'preproc_include':
      extractInclude(node, filePath, nodes, relationships);
      break;
    case 'declaration':
      extractDeclaration(node, filePath, nodes);
      break;
  }

  for (const child of node.children) {
    visitNode(child, filePath, nodes, relationships);
  }
}

function extractFunction(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const declarator = node.childForFieldName('declarator');
  if (!declarator) return;

  const nameNode = declarator.childForFieldName('declarator');
  if (!nameNode) return;

  const name = nameNode.text;
  const returnType = node.childForFieldName('type')?.text ?? '';
  const params = declarator.childForFieldName('parameters')?.text ?? '()';
  const signature = `${returnType} ${name}${params}`;

  nodes.push({
    filePath,
    name,
    kind: 'function',
    signature,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  const body = node.childForFieldName('body');
  if (body) {
    extractCallRelationships(body, name, 'function', filePath, relationships);
  }
}

function extractStruct(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  // Skip anonymous structs inside typedefs (they'll be captured by extractTypedef)
  if (node.parent?.type === 'type_definition') return;

  nodes.push({
    filePath,
    name: nameNode.text,
    kind: 'struct',
    signature: `struct ${nameNode.text}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractEnum(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  // Skip enums inside typedefs
  if (node.parent?.type === 'type_definition') return;

  nodes.push({
    filePath,
    name: nameNode.text,
    kind: 'enum',
    signature: `enum ${nameNode.text}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractTypedef(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const declarator = node.childForFieldName('declarator');
  if (!declarator) return;

  const name = declarator.text;

  nodes.push({
    filePath,
    name,
    kind: 'type',
    signature: `typedef ${name}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractInclude(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const pathNode = node.childForFieldName('path');
  if (!pathNode) return;

  const includePath = pathNode.text.replace(/[<>"]/g, '');

  nodes.push({
    filePath,
    name: includePath,
    kind: 'import',
    signature: node.text.trim(),
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  relationships.push({
    sourceFilePath: filePath,
    sourceName: filePath,
    sourceKind: 'import',
    targetName: includePath,
    targetKind: 'function',
    relationshipKind: 'IMPORTS',
  });
}

function extractDeclaration(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  // Extract function prototypes: declarations with function_declarator
  const declarator = node.childForFieldName('declarator');
  if (!declarator || declarator.type !== 'function_declarator') return;

  const nameNode = declarator.childForFieldName('declarator');
  if (!nameNode) return;

  const name = nameNode.text;
  const returnType = node.childForFieldName('type')?.text ?? '';
  const params = declarator.childForFieldName('parameters')?.text ?? '()';
  const signature = `${returnType} ${name}${params}`;

  nodes.push({
    filePath,
    name,
    kind: 'function',
    signature,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractCallRelationships(
  body: Parser.SyntaxNode,
  callerName: string,
  callerKind: NodeKind,
  filePath: string,
  relationships: Relationship[]
): void {
  const calls = findDescendants(body, 'call_expression');
  const seen = new Set<string>();

  for (const call of calls) {
    const fn = call.childForFieldName('function');
    if (!fn) continue;

    let calleeName: string;
    if (fn.type === 'identifier') {
      calleeName = fn.text;
    } else if (fn.type === 'field_expression') {
      calleeName = fn.text;
    } else {
      continue;
    }

    if (seen.has(calleeName)) continue;
    seen.add(calleeName);

    relationships.push({
      sourceFilePath: filePath,
      sourceName: callerName,
      sourceKind: callerKind,
      targetName: calleeName,
      targetKind: 'function',
      relationshipKind: 'CALLS',
    });
  }
}

export const cExtractor: LanguageExtractor = {
  language: 'c',
  extensions: ['.c', '.h'],
  extract(filePath: string, source: string): ExtractionResult {
    const tree = parser.parse(source);
    const nodes: CodeNode[] = [];
    const relationships: Relationship[] = [];

    for (const child of tree.rootNode.children) {
      visitNode(child, filePath, nodes, relationships);
    }

    // Deduplicate: if a function definition and a forward declaration (prototype)
    // both exist with the same name, keep only the definition (the one with a body
    // that spans multiple lines, not a single-line prototype ending with ';')
    const definedFunctions = new Set(
      nodes
        .filter(n => n.kind === 'function' && n.startLine !== n.endLine)
        .map(n => n.name)
    );
    const deduped = nodes.filter(n => {
      if (n.kind === 'function' && n.startLine === n.endLine && definedFunctions.has(n.name)) {
        return false; // Skip prototype when definition exists
      }
      return true;
    });

    return { nodes: deduped, relationships };
  },
};
