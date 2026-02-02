# References

## Dependencies

- [tree-sitter](https://github.com/tree-sitter/tree-sitter) — v0.21.1
- [tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript) — v0.23.2
- [tree-sitter-rust](https://github.com/nickel-org/tree-sitter-rust) — v0.21.0 (peer: tree-sitter ^0.21.1)
- [tree-sitter-solidity](https://github.com/JoranHonig/tree-sitter-solidity) — v1.2.11 (peer: tree-sitter ^0.21.0)
- [vitest](https://vitest.dev) — v4.x (ESM-native test runner)

## tree-sitter Node Types

### Rust
- `function_item`, `struct_item`, `enum_item`, `trait_item`, `impl_item`, `mod_item`, `use_declaration`
- `call_expression` (function field: `identifier` | `scoped_identifier` | `field_expression`)
- `type_identifier` for type references
- impl_item fields: `type` (impl target), `trait` (trait being implemented)

### Solidity
- `contract_declaration`, `function_definition`, `event_definition`, `modifier_definition`
- `struct_declaration`, `enum_declaration`, `interface_declaration`, `import_directive`
- `inheritance_specifier` with `user_defined_type` children
- `call_expression` first child is `expression` node wrapping the function reference
- `contract_body` contains all contract members
