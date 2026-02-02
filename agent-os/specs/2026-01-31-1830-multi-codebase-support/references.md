# References

## Technologies
- Apache AGE (graph extension for PostgreSQL): property-based vertex isolation
- pgvector: embedding storage with project-scoped queries
- ANSI escape codes: terminal progress bar rendering

## Design Decisions
- Property-based isolation over separate graphs: AGE `create_graph()` is DDL-level and can't be parameterized safely
- Backwards compatible: omitting `project` operates across all projects
- Zero-dependency progress bar: pure ANSI terminal output, graceful degradation when piped
