# Shape: Multi-Language Extractor Architecture

## Core Interface

```typescript
interface LanguageExtractor {
  extensions: string[];
  extract(filePath: string, source: string): ExtractionResult;
}
```

## Registry

```
extensionMap: Map<string, LanguageExtractor>
  .ts  → typescriptExtractor
  .tsx → typescriptExtractor
  .rs  → rustExtractor
  .sol → solidityExtractor
```

## Node Kind Mapping

| Language   | Constructs                                        |
|------------|---------------------------------------------------|
| TypeScript | function, class, type, interface, import           |
| Rust       | function, struct, enum, trait, impl, module, import|
| Solidity   | contract, function, event, modifier, struct, enum, interface, import |

## Relationship Kinds

| Kind       | Source Languages      |
|------------|-----------------------|
| CALLS      | All                   |
| IMPORTS    | All                   |
| EXTENDS    | TypeScript, Solidity  |
| USES       | TypeScript, Rust      |
| RETURNS    | TypeScript            |
| IMPLEMENTS | Rust                  |

## File Discovery

```
collectFiles(directory) → string[]
  Includes: .ts, .tsx, .rs, .sol
  Excludes: node_modules, .git, dist, target, build, out, .d.ts
```
