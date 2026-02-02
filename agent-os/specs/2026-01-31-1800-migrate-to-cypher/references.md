# References

## Apache AGE
- Apache AGE documentation: https://age.apache.org/
- AGE Cypher compatibility: AGE implements openCypher specification with some limitations
- No MERGE ON CREATE SET support — use DELETE + CREATE pattern instead

## pgvector
- pgvector extension for PostgreSQL vector similarity search
- HNSW index for approximate nearest neighbor search
- Cosine distance operator: `<=>`

## Key Constraints
- AGE agtype return format requires JSON.parse for result extraction
- AGE string properties need careful escaping (single quotes, backslashes, newlines)
- No native vector type in Cypher — embeddings must stay in SQL
- Composite natural key `(node_name, file_path)` bridges graph ↔ SQL
