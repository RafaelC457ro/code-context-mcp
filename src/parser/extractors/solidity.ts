import Parser from 'tree-sitter';
import Solidity from 'tree-sitter-solidity';
import type { CodeNode, Relationship, NodeKind } from '../../types.js';
import type { LanguageExtractor, ExtractionResult } from './types.js';
import { findDescendants } from './helpers.js';

const parser = new Parser();
parser.setLanguage(Solidity);

function visitNode(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[],
  contractName?: string
): void {
  switch (node.type) {
    case 'contract_declaration':
      extractContract(node, filePath, nodes, relationships);
      return; // extractContract handles its own children
    case 'interface_declaration':
      extractInterface(node, filePath, nodes, relationships);
      return;
    case 'function_definition':
      extractFunction(node, filePath, nodes, relationships, contractName);
      break;
    case 'event_definition':
      extractEvent(node, filePath, nodes, contractName);
      break;
    case 'modifier_definition':
      extractModifier(node, filePath, nodes, contractName);
      break;
    case 'struct_declaration':
      extractStruct(node, filePath, nodes, contractName);
      break;
    case 'enum_declaration':
      extractEnum(node, filePath, nodes, contractName);
      break;
    case 'import_directive':
      extractImport(node, filePath, nodes, relationships);
      break;
  }

  for (const child of node.children) {
    visitNode(child, filePath, nodes, relationships, contractName);
  }
}

function extractContract(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = nameNode.text;

  // Check for inheritance (is Bar, Baz)
  for (const child of node.children) {
    if (child.type === 'inheritance_specifier') {
      const parentType = child.children.find(c => c.type === 'user_defined_type');
      if (parentType) {
        relationships.push({
          sourceFilePath: filePath,
          sourceName: name,
          sourceKind: 'contract',
          targetName: parentType.text,
          targetKind: 'contract',
          relationshipKind: 'EXTENDS',
        });
      }
    }
  }

  // Build signature with inheritance
  const inheritanceParts: string[] = [];
  for (const child of node.children) {
    if (child.type === 'inheritance_specifier') {
      const parentType = child.children.find(c => c.type === 'user_defined_type');
      if (parentType) inheritanceParts.push(parentType.text);
    }
  }
  const inheritanceStr = inheritanceParts.length > 0 ? ` is ${inheritanceParts.join(', ')}` : '';
  const signature = `contract ${name}${inheritanceStr}`;

  nodes.push({
    filePath,
    name,
    kind: 'contract',
    signature,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  // Visit body members with contract context
  const body = node.children.find(c => c.type === 'contract_body');
  if (body) {
    for (const member of body.children) {
      visitNode(member, filePath, nodes, relationships, name);
    }
  }
}

function extractInterface(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = nameNode.text;

  nodes.push({
    filePath,
    name,
    kind: 'interface',
    signature: `interface ${name}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  // Visit body members with interface context
  const body = node.children.find(c => c.type === 'contract_body');
  if (body) {
    for (const member of body.children) {
      visitNode(member, filePath, nodes, relationships, name);
    }
  }
}

function extractFunction(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[],
  contractName?: string
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = contractName ? `${contractName}.${nameNode.text}` : nameNode.text;
  const signature = `function ${name}`;

  nodes.push({
    filePath,
    name,
    kind: 'function',
    signature,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  // Extract call relationships from function body
  const body = node.childForFieldName('body') || node.children.find(c => c.type === 'function_body');
  if (body) {
    extractCallRelationships(body, name, 'function', filePath, relationships);
  }
}

function extractEvent(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  contractName?: string
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = contractName ? `${contractName}.${nameNode.text}` : nameNode.text;

  nodes.push({
    filePath,
    name,
    kind: 'event',
    signature: `event ${name}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractModifier(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  contractName?: string
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = contractName ? `${contractName}.${nameNode.text}` : nameNode.text;

  nodes.push({
    filePath,
    name,
    kind: 'modifier',
    signature: `modifier ${name}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractStruct(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  contractName?: string
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = contractName ? `${contractName}.${nameNode.text}` : nameNode.text;

  nodes.push({
    filePath,
    name,
    kind: 'struct',
    signature: `struct ${name}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractEnum(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  contractName?: string
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = contractName ? `${contractName}.${nameNode.text}` : nameNode.text;

  nodes.push({
    filePath,
    name,
    kind: 'enum',
    signature: `enum ${name}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractImport(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  // Find the import path string
  const stringNode = node.children.find(c => c.type === 'string');
  if (!stringNode) return;

  const importPath = stringNode.text.replace(/['"]/g, '');

  nodes.push({
    filePath,
    name: importPath,
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
    targetName: importPath,
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
    // In Solidity, call_expression's first child is the function reference
    // It may be wrapped in an 'expression' node or be an identifier/member_expression directly
    const fn = call.children[0];
    if (!fn) continue;

    let calleeName: string;
    if (fn.type === 'identifier') {
      calleeName = fn.text;
    } else if (fn.type === 'member_expression') {
      calleeName = fn.text;
    } else if (fn.type === 'expression') {
      // Solidity wraps function references in expression nodes
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

export const solidityExtractor: LanguageExtractor = {
  language: 'solidity',
  extensions: ['.sol'],
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
