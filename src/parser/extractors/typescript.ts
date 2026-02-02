import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import type { CodeNode, Relationship, NodeKind } from '../../types.js';
import type { LanguageExtractor, ExtractionResult } from './types.js';
import { findDescendant, findDescendants } from './helpers.js';

const parser = new Parser();
parser.setLanguage(TypeScript.typescript);

function visitNode(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  switch (node.type) {
    case 'function_declaration':
      extractFunction(node, filePath, nodes, relationships);
      break;
    case 'export_statement':
      // Check if it wraps a function/class/type declaration
      for (const child of node.children) {
        visitNode(child, filePath, nodes, relationships);
      }
      return; // Don't visit children again
    case 'lexical_declaration': {
      // Handle: const foo = () => {} or const foo = function() {}
      for (const declarator of node.children) {
        if (declarator.type === 'variable_declarator') {
          extractArrowOrFunctionExpression(declarator, filePath, nodes, relationships);
        }
      }
      break;
    }
    case 'class_declaration':
      extractClass(node, filePath, nodes, relationships);
      break;
    case 'type_alias_declaration':
      extractType(node, filePath, nodes);
      break;
    case 'interface_declaration':
      extractInterface(node, filePath, nodes);
      break;
    case 'import_statement':
      extractImport(node, filePath, nodes, relationships);
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
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = nameNode.text;
  const params = node.childForFieldName('parameters')?.text ?? '()';
  const returnType = node.childForFieldName('return_type')?.text ?? '';
  const signature = `function ${name}${params}${returnType ? `: ${returnType}` : ''}`;

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
  const body = node.childForFieldName('body');
  if (body) {
    extractCallRelationships(body, name, 'function', filePath, relationships);
    extractTypeUsages(node, name, 'function', filePath, relationships);
  }
}

function extractArrowOrFunctionExpression(
  declarator: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const nameNode = declarator.childForFieldName('name');
  const value = declarator.childForFieldName('value');
  if (!nameNode || !value) return;
  if (value.type !== 'arrow_function' && value.type !== 'function') return;

  const name = nameNode.text;
  const params = value.childForFieldName('parameters')?.text ?? '()';
  const returnType = value.childForFieldName('return_type')?.text ?? '';
  const signature = `const ${name} = ${params} => ${returnType ? `: ${returnType}` : '...'}`;

  nodes.push({
    filePath,
    name,
    kind: 'function',
    signature,
    startLine: declarator.startPosition.row + 1,
    endLine: declarator.endPosition.row + 1,
    body: declarator.text,
  });

  const body = value.childForFieldName('body');
  if (body) {
    extractCallRelationships(body, name, 'function', filePath, relationships);
    extractTypeUsages(value, name, 'function', filePath, relationships);
  }
}

function extractClass(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[],
  relationships: Relationship[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  const name = nameNode.text;

  // Check for extends (class_heritage node)
  const heritage = node.children.find(c => c.type === 'class_heritage');
  if (heritage) {
    for (const clause of heritage.children) {
      if (clause.type === 'extends_clause') {
        const superClass = clause.children.find(c => c.type === 'identifier');
        if (superClass) {
          relationships.push({
            sourceFilePath: filePath,
            sourceName: name,
            sourceKind: 'class',
            targetName: superClass.text,
            targetKind: 'class',
            relationshipKind: 'EXTENDS',
          });
        }
      }
    }
  }

  // Build signature
  const typeParams = node.childForFieldName('type_parameters')?.text ?? '';
  const extendsClause = heritage?.text ?? '';
  const signature = `class ${name}${typeParams}${extendsClause ? ` ${extendsClause}` : ''}`;

  nodes.push({
    filePath,
    name,
    kind: 'class',
    signature,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  // Extract methods as separate function nodes
  const body = node.childForFieldName('body');
  if (body) {
    for (const member of body.children) {
      if (member.type === 'method_definition') {
        const methodName = member.childForFieldName('name');
        if (methodName) {
          const fullName = `${name}.${methodName.text}`;
          const mParams = member.childForFieldName('parameters')?.text ?? '()';
          const mReturn = member.childForFieldName('return_type')?.text ?? '';

          nodes.push({
            filePath,
            name: fullName,
            kind: 'function',
            signature: `${fullName}${mParams}${mReturn ? `: ${mReturn}` : ''}`,
            startLine: member.startPosition.row + 1,
            endLine: member.endPosition.row + 1,
            body: member.text,
          });

          const methodBody = member.childForFieldName('body');
          if (methodBody) {
            extractCallRelationships(methodBody, fullName, 'function', filePath, relationships);
          }
        }
      }
    }
  }
}

function extractType(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  nodes.push({
    filePath,
    name: nameNode.text,
    kind: 'type',
    signature: `type ${nameNode.text}`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });
}

function extractInterface(
  node: Parser.SyntaxNode,
  filePath: string,
  nodes: CodeNode[]
): void {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;

  nodes.push({
    filePath,
    name: nameNode.text,
    kind: 'interface',
    signature: `interface ${nameNode.text}`,
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
  const source = node.childForFieldName('source');
  if (!source) return;

  const modulePath = source.text.replace(/['"]/g, '');

  nodes.push({
    filePath,
    name: modulePath,
    kind: 'import',
    signature: node.text,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    body: node.text,
  });

  // Extract imported names for IMPORTS relationships
  const importClause = node.children.find(c => c.type === 'import_clause');
  if (importClause) {
    const namedImports = findDescendant(importClause, 'named_imports');
    if (namedImports) {
      for (const specifier of namedImports.children) {
        if (specifier.type === 'import_specifier') {
          const importedName = specifier.childForFieldName('name')?.text ?? specifier.text;
          relationships.push({
            sourceFilePath: filePath,
            sourceName: filePath,
            sourceKind: 'import',
            targetName: importedName,
            targetKind: 'function', // May be any kind; resolved later
            relationshipKind: 'IMPORTS',
          });
        }
      }
    }
  }
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
    } else if (fn.type === 'member_expression') {
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

    // Skip built-in types
    if (['string', 'number', 'boolean', 'void', 'any', 'never', 'unknown', 'null', 'undefined'].includes(typeName)) {
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

export const typescriptExtractor: LanguageExtractor = {
  language: 'typescript',
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  extract(filePath: string, source: string): ExtractionResult {
    const tree = parser.parse(source);
    const nodes: CodeNode[] = [];
    const relationships: Relationship[] = [];

    visitNode(tree.rootNode, filePath, nodes, relationships);

    return { nodes, relationships };
  },
};
