export type NodeKind =
  | 'function' | 'class' | 'type' | 'interface' | 'import'
  | 'struct' | 'enum' | 'trait' | 'impl' | 'module'
  | 'contract' | 'event' | 'modifier';

export type RelationshipKind = 'CALLS' | 'IMPORTS' | 'EXTENDS' | 'USES' | 'RETURNS' | 'IMPLEMENTS';

export type SupportedLanguage = 'typescript' | 'rust' | 'solidity' | 'c';

export interface CodeNode {
  filePath: string;
  name: string;
  kind: NodeKind;
  signature: string;
  startLine: number;
  endLine: number;
  body: string;
}

export interface Relationship {
  sourceFilePath: string;
  sourceName: string;
  sourceKind: NodeKind;
  targetName: string;
  targetKind: NodeKind;
  relationshipKind: RelationshipKind;
}

export interface FileRecord {
  path: string;
  hash: string;
}

export interface SearchResult {
  node: CodeNode;
  score: number;
}

export interface EmbeddingHit {
  name: string;
  filePath: string;
  project: string;
  score: number;
}

export interface ProgressStats {
  totalFiles: number;
  filesProcessed: number;
  filesSkipped: number;
  nodesExtracted: number;
  embeddingsGenerated: number;
}

export interface CallStackEntry {
  name: string;
  filePath: string;
  kind: NodeKind;
  depth: number;
  children: CallStackEntry[];
}

export interface FunctionContext {
  node: CodeNode;
  callers: CodeNode[];
  callees: CodeNode[];
  usedTypes: CodeNode[];
  file: string;
  imports: CodeNode[];
}

export interface ImpactResult {
  sourceFile: string;
  affectedNodes: Array<{
    name: string;
    filePath: string;
    kind: NodeKind;
    relationship: RelationshipKind;
  }>;
}

export interface GitCommit {
  commitHash: string;
  project: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string;
  diffSummary: string;
}

export interface GitCommitHit {
  commitHash: string;
  project: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string;
  diffSummary: string;
  score: number;
}
