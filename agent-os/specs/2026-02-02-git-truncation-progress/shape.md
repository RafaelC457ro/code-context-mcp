# Smart Truncation + Git Progress Bar — Shaping Notes

## Scope

Improve embedding quality by using the full nomic-embed-text context window (8192 tokens, ~6000 chars safe limit) instead of an arbitrary 2000-char diff truncation. Add a visual progress bar to git indexing by reusing the existing ProgressBar class.

## Decisions

- Budget-based truncation: prioritize message > file list > diff
- Default budget: 6000 chars (safe limit for nomic-embed-text)
- No per-file chunking — keep one embedding per commit
- Reuse existing ProgressBar with a configurable label parameter instead of creating a new class
- No schema changes needed

## Context

- **Visuals:** None
- **References:** Existing ProgressBar in `src/cli/progress.ts`, existing `buildEmbeddingText` in `src/embeddings/ollama.ts`
- **Product alignment:** Better embedding quality for semantic git search
