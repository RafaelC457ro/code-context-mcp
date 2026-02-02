import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { rustExtractor } from '../../../src/parser/extractors/rust.js';

describe('Rust Extractor', () => {
  it('extracts function declarations', () => {
    const source = `fn main() { println!("hello"); }`;
    const result = rustExtractor.extract('test.rs', source);

    const fns = result.nodes.filter(n => n.kind === 'function');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('main');
    expect(fns[0].signature).toContain('fn main');
  });

  it('extracts structs', () => {
    const source = `struct Point { x: f64, y: f64 }`;
    const result = rustExtractor.extract('test.rs', source);

    const structs = result.nodes.filter(n => n.kind === 'struct');
    expect(structs).toHaveLength(1);
    expect(structs[0].name).toBe('Point');
  });

  it('extracts enums', () => {
    const source = `enum Color { Red, Green, Blue }`;
    const result = rustExtractor.extract('test.rs', source);

    const enums = result.nodes.filter(n => n.kind === 'enum');
    expect(enums).toHaveLength(1);
    expect(enums[0].name).toBe('Color');
  });

  it('extracts traits', () => {
    const source = `trait Drawable { fn draw(&self); }`;
    const result = rustExtractor.extract('test.rs', source);

    const traits = result.nodes.filter(n => n.kind === 'trait');
    expect(traits).toHaveLength(1);
    expect(traits[0].name).toBe('Drawable');
  });

  it('extracts impl blocks and methods', () => {
    const source = `
struct Point { x: f64, y: f64 }

impl Point {
    fn new(x: f64, y: f64) -> Point { Point { x, y } }
}`;
    const result = rustExtractor.extract('test.rs', source);

    const impls = result.nodes.filter(n => n.kind === 'impl');
    expect(impls).toHaveLength(1);
    expect(impls[0].name).toBe('impl Point');

    const methods = result.nodes.filter(n => n.kind === 'function' && n.name.startsWith('Point.'));
    expect(methods).toHaveLength(1);
    expect(methods[0].name).toBe('Point.new');
  });

  it('extracts trait impl with IMPLEMENTS relationship', () => {
    const source = `
trait Drawable { fn draw(&self); }
struct Point { x: f64 }
impl Drawable for Point { fn draw(&self) {} }`;
    const result = rustExtractor.extract('test.rs', source);

    const implRels = result.relationships.filter(r => r.relationshipKind === 'IMPLEMENTS');
    expect(implRels).toHaveLength(1);
    expect(implRels[0].sourceName).toBe('Point');
    expect(implRels[0].targetName).toBe('Drawable');
  });

  it('extracts modules', () => {
    const source = `mod utils;`;
    const result = rustExtractor.extract('test.rs', source);

    const mods = result.nodes.filter(n => n.kind === 'module');
    expect(mods).toHaveLength(1);
    expect(mods[0].name).toBe('utils');
  });

  it('extracts use declarations with IMPORTS relationship', () => {
    const source = `use std::collections::HashMap;`;
    const result = rustExtractor.extract('test.rs', source);

    const imports = result.nodes.filter(n => n.kind === 'import');
    expect(imports).toHaveLength(1);
    expect(imports[0].name).toBe('std::collections::HashMap');

    const importRels = result.relationships.filter(r => r.relationshipKind === 'IMPORTS');
    expect(importRels).toHaveLength(1);
  });

  it('extracts CALLS relationships', () => {
    const source = `
fn render() {}
fn main() { render(); }`;
    const result = rustExtractor.extract('test.rs', source);

    const callRels = result.relationships.filter(r => r.relationshipKind === 'CALLS');
    expect(callRels.find(r => r.sourceName === 'main' && r.targetName === 'render')).toBeTruthy();
  });

  it('extracts multiple different CALLS without duplicates', () => {
    const source = `
fn init_structures() {}
fn init_server(port: u16, buffer_size: usize) {}
fn client_handler(socket: i32) {}

fn main() {
    init_structures();
    init_server(8080, 1024);
    client_handler(0);
}`;
    const result = rustExtractor.extract('test.rs', source);

    const mainCalls = result.relationships.filter(
      r => r.relationshipKind === 'CALLS' && r.sourceName === 'main'
    );

    expect(mainCalls).toHaveLength(3);
    expect(mainCalls.find(r => r.targetName === 'init_structures')).toBeTruthy();
    expect(mainCalls.find(r => r.targetName === 'init_server')).toBeTruthy();
    expect(mainCalls.find(r => r.targetName === 'client_handler')).toBeTruthy();

    const targetNames = mainCalls.map(r => r.targetName);
    expect(new Set(targetNames).size).toBe(targetNames.length);
  });

  it('extracts from fixture file', () => {
    const source = readFileSync(new URL('../../fixtures/sample.rs', import.meta.url), 'utf-8');
    const result = rustExtractor.extract('fixtures/sample.rs', source);

    expect(result.nodes.length).toBeGreaterThan(0);

    const kinds = new Set(result.nodes.map(n => n.kind));
    expect(kinds.has('function')).toBe(true);
    expect(kinds.has('struct')).toBe(true);
    expect(kinds.has('enum')).toBe(true);
    expect(kinds.has('trait')).toBe(true);
    expect(kinds.has('impl')).toBe(true);
    expect(kinds.has('module')).toBe(true);
    expect(kinds.has('import')).toBe(true);
  });
});
