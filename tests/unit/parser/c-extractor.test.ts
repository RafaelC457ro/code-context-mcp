import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { cExtractor } from '../../../src/parser/extractors/c.js';

describe('C Extractor', () => {
  it('extracts function definitions', () => {
    const source = `int add(int a, int b) { return a + b; }`;
    const result = cExtractor.extract('test.c', source);

    const fns = result.nodes.filter(n => n.kind === 'function');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('add');
    expect(fns[0].signature).toContain('int');
    expect(fns[0].signature).toContain('add');
  });

  it('extracts struct definitions', () => {
    const source = `struct Point { int x; int y; };`;
    const result = cExtractor.extract('test.c', source);

    const structs = result.nodes.filter(n => n.kind === 'struct');
    expect(structs).toHaveLength(1);
    expect(structs[0].name).toBe('Point');
    expect(structs[0].signature).toBe('struct Point');
  });

  it('extracts enum definitions', () => {
    const source = `enum Color { RED, GREEN, BLUE };`;
    const result = cExtractor.extract('test.c', source);

    const enums = result.nodes.filter(n => n.kind === 'enum');
    expect(enums).toHaveLength(1);
    expect(enums[0].name).toBe('Color');
    expect(enums[0].signature).toBe('enum Color');
  });

  it('extracts typedef definitions', () => {
    const source = `typedef unsigned long size_t_alias;`;
    const result = cExtractor.extract('test.c', source);

    const types = result.nodes.filter(n => n.kind === 'type');
    expect(types).toHaveLength(1);
    expect(types[0].name).toBe('size_t_alias');
    expect(types[0].signature).toContain('typedef');
  });

  it('extracts #include directives', () => {
    const source = `#include <stdio.h>\n#include "myheader.h"`;
    const result = cExtractor.extract('test.c', source);

    const imports = result.nodes.filter(n => n.kind === 'import');
    expect(imports).toHaveLength(2);
    expect(imports.map(n => n.name)).toContain('stdio.h');
    expect(imports.map(n => n.name)).toContain('myheader.h');

    const importRels = result.relationships.filter(r => r.relationshipKind === 'IMPORTS');
    expect(importRels).toHaveLength(2);
  });

  it('extracts CALLS relationships', () => {
    const source = `
void bar() {}
void foo() { bar(); printf("hello"); }`;
    const result = cExtractor.extract('test.c', source);

    const callRels = result.relationships.filter(r => r.relationshipKind === 'CALLS');
    expect(callRels.find(r => r.sourceName === 'foo' && r.targetName === 'bar')).toBeTruthy();
    expect(callRels.find(r => r.sourceName === 'foo' && r.targetName === 'printf')).toBeTruthy();
  });

  it('extracts multiple different CALLS without duplicates', () => {
    const source = `
void init_structures(void) {}
void init_server(int port, int buffersize, int maxthread, int maxbacklog, void (*handler)(int)) {}
void client_handler(int socket) {}

int main(int argc, char **argv)
{
    init_structures();
    init_server(8080, 1024, 8, 1024, client_handler);
    return 0;
}`;
    const result = cExtractor.extract('test.c', source);

    const mainCalls = result.relationships.filter(
      r => r.relationshipKind === 'CALLS' && r.sourceName === 'main'
    );

    // Should have exactly 2 calls from main: init_structures and init_server
    expect(mainCalls).toHaveLength(2);
    expect(mainCalls.find(r => r.targetName === 'init_structures')).toBeTruthy();
    expect(mainCalls.find(r => r.targetName === 'init_server')).toBeTruthy();

    // No duplicates
    const targetNames = mainCalls.map(r => r.targetName);
    expect(new Set(targetNames).size).toBe(targetNames.length);
  });

  it('extracts function prototypes from header declarations', () => {
    const source = `int add(int a, int b);`;
    const result = cExtractor.extract('test.h', source);

    const fns = result.nodes.filter(n => n.kind === 'function');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('add');
  });

  it('extracts from fixture .c file', () => {
    const source = readFileSync(new URL('../../fixtures/sample.c', import.meta.url), 'utf-8');
    const result = cExtractor.extract('fixtures/sample.c', source);

    expect(result.nodes.length).toBeGreaterThan(0);

    const kinds = new Set(result.nodes.map(n => n.kind));
    expect(kinds.has('function')).toBe(true);
    expect(kinds.has('import')).toBe(true);
    expect(kinds.has('type')).toBe(true);

    const fnNames = result.nodes.filter(n => n.kind === 'function').map(n => n.name);
    expect(fnNames).toContain('print_point');
    expect(fnNames).toContain('add');
    expect(fnNames).toContain('main');
  });

  it('extracts from fixture .h file', () => {
    const source = readFileSync(new URL('../../fixtures/sample.h', import.meta.url), 'utf-8');
    const result = cExtractor.extract('fixtures/sample.h', source);

    expect(result.nodes.length).toBeGreaterThan(0);

    // Header has prototypes
    const fns = result.nodes.filter(n => n.kind === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(3);
    expect(fns.map(n => n.name)).toContain('print_point');
    expect(fns.map(n => n.name)).toContain('add');
  });

  it('has correct language property', () => {
    expect(cExtractor.language).toBe('c');
  });

  it('has correct extensions', () => {
    expect(cExtractor.extensions).toContain('.c');
    expect(cExtractor.extensions).toContain('.h');
  });
});
