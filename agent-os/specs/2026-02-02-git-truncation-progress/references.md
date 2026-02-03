# References

## ProgressBar

- **Location:** `src/cli/progress.ts`
- **Relevance:** Reusing this class for git indexing with a label param
- **Key patterns:** TTY-aware rendering, stats tracking, finish summary

## buildEmbeddingText

- **Location:** `src/embeddings/ollama.ts:34`
- **Relevance:** Existing truncation pattern (1000 char body max) to follow for git commits
