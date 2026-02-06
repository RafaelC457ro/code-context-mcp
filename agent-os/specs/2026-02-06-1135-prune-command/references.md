# References: Prune Command

## Existing Patterns

### Force Flag Pattern
`src/cli/index.ts:321-328` - Delete command force flag handling

### Graph Functions
- `dropProjectGraph()` - `src/db/schema.ts:195-212`
- `listProjectGraphs()` - `src/db/schema.ts:214-230`

### Schema Setup Functions
- `setupSchema()` - `src/db/schema.ts:3-49`
- `setupGitSchema()` - `src/db/schema.ts:92-118`
- `setupFileHashSchema()` - `src/db/schema.ts:120-137`
