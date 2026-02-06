# OpenCypher Reference for code-context-mcp

This document provides a complete reference for querying code graphs using the `run_cypher` MCP tool.

## Graph Schema

Each project has its own isolated graph named `code_graph_{projectName}`.

### Vertex Labels

| Label | Description | Key Properties |
|-------|-------------|----------------|
| `Function` | Functions and methods | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Class` | Classes | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Type` | Types and interfaces | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `File` | Source files | `path`, `hash` |
| `Struct` | Structs (Rust, C, Solidity) | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Enum` | Enums | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Trait` | Traits (Rust) | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Impl` | Impl blocks (Rust) | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Module` | Modules | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Contract` | Smart contracts (Solidity) | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Event` | Events (Solidity) | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |
| `Modifier` | Modifiers (Solidity) | `name`, `file_path`, `signature`, `body`, `start_line`, `end_line`, `kind` |

### Edge Labels

| Label | Description | Example |
|-------|-------------|---------|
| `CALLS` | Function calls another function | `(main)-[:CALLS]->(helper)` |
| `IMPORTS` | File imports another file/module | `(app.ts)-[:IMPORTS]->(utils.ts)` |
| `EXTENDS` | Class/contract extends another | `(Child)-[:EXTENDS]->(Parent)` |
| `USES` | Function uses a type | `(processData)-[:USES]->(Config)` |
| `RETURNS` | Function returns a type | `(getUser)-[:RETURNS]->(User)` |
| `DEFINED_IN` | Node is defined in a file | `(myFunction)-[:DEFINED_IN]->(app.ts)` |
| `IMPLEMENTS` | Class/struct implements trait/interface | `(MyStruct)-[:IMPLEMENTS]->(Drawable)` |

## Query Safety

The `run_cypher` tool only allows **read-only queries**. The following keywords are blocked:
- `CREATE`
- `DELETE`
- `SET`
- `REMOVE`
- `MERGE`
- `DROP`

## Example Queries

### Basic Queries

**List all functions:**
```cypher
MATCH (f:Function)
RETURN f.name, f.file_path, f.start_line
LIMIT 20
```

**Find a specific function:**
```cypher
MATCH (f:Function {name: 'handleRequest'})
RETURN f.name, f.file_path, f.signature, f.body
```

**List all classes:**
```cypher
MATCH (c:Class)
RETURN c.name, c.file_path
```

**List all types/interfaces:**
```cypher
MATCH (t:Type)
RETURN t.name, t.file_path, t.kind
```

### Call Graph Queries

**Find functions that call a specific function:**
```cypher
MATCH (caller:Function)-[:CALLS]->(target:Function {name: 'validateInput'})
RETURN caller.name, caller.file_path
```

**Find all functions called by a function:**
```cypher
MATCH (f:Function {name: 'main'})-[:CALLS]->(callee:Function)
RETURN callee.name, callee.file_path
```

**Find call chain (2 levels deep):**
```cypher
MATCH (f:Function {name: 'main'})-[:CALLS]->(level1:Function)-[:CALLS]->(level2:Function)
RETURN f.name, level1.name, level2.name
```

**Count function calls:**
```cypher
MATCH (f:Function)-[r:CALLS]->()
RETURN f.name, count(r) AS call_count
ORDER BY call_count DESC
LIMIT 10
```

### Type Usage Queries

**Find types used by a function:**
```cypher
MATCH (f:Function {name: 'processOrder'})-[:USES]->(t:Type)
RETURN t.name, t.file_path
```

**Find functions that use a specific type:**
```cypher
MATCH (f:Function)-[:USES]->(t:Type {name: 'Config'})
RETURN f.name, f.file_path
```

### Inheritance Queries

**Find subclasses:**
```cypher
MATCH (child:Class)-[:EXTENDS]->(parent:Class {name: 'BaseController'})
RETURN child.name, child.file_path
```

**Find interface implementations:**
```cypher
MATCH (impl)-[:IMPLEMENTS]->(interface:Type {name: 'Repository'})
RETURN impl.name, impl.file_path
```

### File-Based Queries

**Find all nodes in a file:**
```cypher
MATCH (n {file_path: 'src/handlers/auth.ts'})
WHERE n.kind IS NOT NULL
RETURN n.name, n.kind, n.start_line
```

**Find cross-file dependencies:**
```cypher
MATCH (caller {file_path: 'src/app.ts'})-[:CALLS]->(callee)
WHERE callee.file_path <> 'src/app.ts'
RETURN DISTINCT callee.file_path, count(*) AS calls
ORDER BY calls DESC
```

### Impact Analysis Queries

**Find external dependencies on a file:**
```cypher
MATCH (external)-[r]->(target {file_path: 'src/utils/validators.ts'})
WHERE external.file_path <> 'src/utils/validators.ts'
RETURN external.name, external.file_path, type(r)
```

**Find unused functions (no callers):**
```cypher
MATCH (f:Function)
WHERE NOT ()-[:CALLS]->(f) AND f.name <> 'main'
RETURN f.name, f.file_path
```

### Solidity-Specific Queries

**Find all contracts:**
```cypher
MATCH (c:Contract)
RETURN c.name, c.file_path
```

**Find contract events:**
```cypher
MATCH (e:Event)
WHERE e.name STARTS WITH 'Token.'
RETURN e.name, e.file_path
```

**Find contract inheritance:**
```cypher
MATCH (child:Contract)-[:EXTENDS]->(parent)
RETURN child.name, parent.name
```

### Rust-Specific Queries

**Find all traits:**
```cypher
MATCH (t:Trait)
RETURN t.name, t.file_path
```

**Find trait implementations:**
```cypher
MATCH (s:Struct)-[:IMPLEMENTS]->(t:Trait {name: 'Debug'})
RETURN s.name, s.file_path
```

**Find all impl blocks for a struct:**
```cypher
MATCH (i:Impl)
WHERE i.name STARTS WITH 'Point::'
RETURN i.name, i.file_path, i.signature
```

### Aggregate Queries

**Count nodes by kind:**
```cypher
MATCH (n)
WHERE n.kind IS NOT NULL
RETURN n.kind, count(*) AS count
ORDER BY count DESC
```

**Files with most functions:**
```cypher
MATCH (f:Function)
RETURN f.file_path, count(*) AS function_count
ORDER BY function_count DESC
LIMIT 10
```

**Most connected functions (called and calling):**
```cypher
MATCH (f:Function)
OPTIONAL MATCH (f)-[out:CALLS]->()
OPTIONAL MATCH ()-[in:CALLS]->(f)
RETURN f.name, count(DISTINCT out) AS calls_made, count(DISTINCT in) AS called_by
ORDER BY calls_made + called_by DESC
LIMIT 10
```

## Apache AGE Notes

This tool uses [Apache AGE](https://age.apache.org/) as the graph database backend. Some Cypher features have limitations:

1. **No DETACH DELETE** - Edges must be deleted before vertices
2. **No MERGE with ON CREATE/ON MATCH** - Use separate CREATE/MATCH operations
3. **No shortestPath()** - Path finding functions are not available
4. **No APOC procedures** - Only standard Cypher is supported
5. **Property access** - Use `node.property` syntax (not `node['property']`)

## Error Handling

Common errors you may encounter:

- **"Query contains write operations"** - The query includes CREATE, DELETE, or other write operations
- **"Graph for project not found"** - Run `code-context-mcp graph <dir> --project <name>` first
- **"label not found"** - The vertex/edge label doesn't exist in this graph
