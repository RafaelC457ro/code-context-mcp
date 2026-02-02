import type Parser from 'tree-sitter';

export function findDescendant(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
  if (node.type === type) return node;
  for (const child of node.children) {
    const found = findDescendant(child, type);
    if (found) return found;
  }
  return null;
}

export function findDescendants(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
  const results: Parser.SyntaxNode[] = [];
  if (node.type === type) results.push(node);
  for (const child of node.children) {
    results.push(...findDescendants(child, type));
  }
  return results;
}
