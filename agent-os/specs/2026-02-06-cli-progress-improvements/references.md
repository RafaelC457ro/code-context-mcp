# References: CLI Progress Improvements

## Existing Code Patterns

### Incremental Indexing Pattern (index-git command)
```typescript
// src/cli/index.ts:202-223
const indexed = await getIndexedCommitHashes(project);
console.log(`Already indexed: ${indexed.size} commits`);

const allCommits = extractGitCommits(dir, project);
const newCommits = allCommits
  .filter(c => !indexed.has(c.commitHash))
  .slice(0, maxCommits);
const skippedCount = allCommits.length - newCommits.length;

const progress = new ProgressBar(newCommits.length + skippedCount, 'commits');
for (let i = 0; i < skippedCount; i++) {
  progress.incrementSkipped();
}
```

### File Hash in Graph (graph/operations.ts)
```typescript
// src/graph/operations.ts:141-168
export async function upsertFileVertex(path: string, hash: string, project: string): Promise<void>
export async function getFileHash(path: string, project: string): Promise<string | null>
```

### ProgressBar Methods
```typescript
// src/cli/progress.ts
incrementFiles(): void
incrementSkipped(): void
addNodes(n: number): void
addEmbeddings(n: number): void
finish(): void
getStats(): ProgressStats
```

### Git Queries Pattern
```typescript
// src/db/git-queries.ts
export async function getIndexedCommitHashes(project: string): Promise<Set<string>>
export async function upsertGitCommit(...): Promise<void>
export async function deleteProjectGitCommits(project: string): Promise<number>
```

## File Paths

- Types: `src/types.ts`
- Progress: `src/cli/progress.ts`
- CLI commands: `src/cli/index.ts`
- Schema: `src/db/schema.ts`
- Queries: `src/db/queries.ts`
- Graph operations: `src/graph/operations.ts`
