import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import type { CodeNode, Relationship, NodeKind } from '../../types.js';
import type { LanguageExtractor, ExtractionResult } from './types.js';
import { findDescendants } from './helpers.js';

const parser = new Parser();
parser.setLanguage(Rust);

function visitNode(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  switch (node.type) {
    case 'function_item':
      extractFunction(node, filePath, nodes, relationships);
      break;
    case 'struct_item':
      extractStruct(node, filePath, nodes);
      break;
    case 'enum_item':
      extractEnum(node, filePath, nodes);
      break;
    case 'trait_item':
      extractTrait(node, filePath, nodes);
      break;
    case 'impl_item':
      extractImpl(node, filePath, nodes, relationships);
      break;
    case 'mod_item':
      extractModule(node, filePath, nodes);
      break;
    case 'use_declaration':
      extractUse(node, filePath, nodes, relationships);
      break;
  }

  for (const child of node.children) {
    // Don't recurse into items we already handle at the top level
    if (child.type === 'impl_item' || child.type === 'function_item') continue;
    visitNode(child, filePath, nodes, relationships);
  }
}

function extractFunction(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[],
  namePrefix?: string
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = namePrefix ? `${namePrefix}.${nameNode.text}` : nameNode.text;
  const params = node.childForFieldName('parameters')?.text ?? '()';
  const returnType = node.childForFieldName('return_type')?.text ?? '';
  const signature = `fn ${name}${params}${returnType ? ` ${returnType}` : ''}`;

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
    extractTypeUsages(node, name, 'function', filePath, relationships);
  }
}

function extractStruct(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

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

function extractTrait(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  nodes.push({
    filePath,
    name: nameNode.text,
    kind: 'trait',
    signature: `trait ${nameNode.text}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractImpl(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const typeNode = node.childForFieldName('type');
  if (!typeNode) return;

  const typeName = typeNode.text;
  const traitNode = node.childForFieldName('trait');
  const traitName = traitNode?.text;

  const implName = traitName ? `impl ${traitName} for ${typeName}` : `impl ${typeName}`;

  nodes.push({
    filePath,
    name: implName,
    kind: 'impl',
    signature: implName,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  // If this is a trait impl, create IMPLEMENTS relationship
  if (traitName) {
    relationships.push({
      sourceFilePath: filePath,
      sourceName: typeName,
      sourceKind: 'struct',
      targetName: traitName,
      targetKind: 'trait',
      relationshipKind: 'IMPLEMENTS',
    });
  }

  // Extract methods from impl body
  const body = node.childForFieldName('body');
  if (body) {
    for (const member of body.children) {
      if (member.type === 'function_item') {
        extractFunction(member, filePath, nodes, relationships, typeName);
      }
    }
  }
}

function extractModule(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  nodes.push({
    filePath,
    name: nameNode.text,
    kind: 'module',
    signature: `mod ${nameNode.text}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractUse(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  // Get the use path (e.g., "std::collections::HashMap")
  const pathNode = node.children.find(
    c => c.type === 'scoped_identifier' || c.type === 'identifier' || c.type === 'use_wildcard' || c.type === 'scoped_use_list' || c.type === 'use_list'
  );
  const usePath = pathNode?.text ?? node.text;

  nodes.push({
    filePath,
    name: usePath,
    kind: 'import',
    signature: node.text.replace(/;$/, '').trim(),
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  relationships.push({
    sourceFilePath: filePath,
    sourceName: filePath,
    sourceKind: 'import',
    targetName: usePath,
    targetKind: 'function',
    relationshipKind: 'IMPORTS',
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
    } else if (fn.type === 'scoped_identifier') {
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

function extractTypeUsages(
  node: Parser.SyntaxNode,
  ownerName: string,
  ownerKind: NodeKind,
  filePath: string,
  relationships: Relationship[]
): void {
  const typeAnnotations = findDescendants(node, 'type_identifier');
  const seen = new Set<string>();

  for (const typeNode of typeAnnotations) {
    const typeName = typeNode.text;
    if (seen.has(typeName)) continue;
    seen.add(typeName);

    // Skip primitive types
    if (['i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str', 'String', 'Self'].includes(typeName)) {
      continue;
    }

    relationships.push({
      sourceFilePath: filePath,
      sourceName: ownerName,
      sourceKind: ownerKind,
      targetName: typeName,
      targetKind: 'type',
      relationshipKind: 'USES',
    });
  }
}

export const rustExtractor: LanguageExtractor = {
  language: 'rust',
  extensions: ['.rs'],
  extract(filePath: string, source: string): ExtractionResult {
    const tree = parser.parse(source);
    const nodes: CodeNode[] = [];
    const relationships: Relationship[] = [];

    for (const child of tree.rootNode.children) {
      visitNode(child, filePath, nodes, relationships);
    }

    return { nodes, relationships };
  },
};
