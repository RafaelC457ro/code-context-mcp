import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { typescriptExtractor } from '../../../src/parser/extractors/typescript.js';

describe('TypeScript Extractor', () => {
  it('extracts function declarations', () => {
    const source = `function greet(name: string): string { return "Hello, " + name; }`;
    const result = typescriptExtractor.extract('test.ts', source);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].name).toBe('greet');
    expect(result.nodes[0].kind).toBe('function');
    expect(result.nodes[0].signature).toContain('function greet');
  });

  it('extracts arrow functions', () => {
    const source = `const add = (a: number, b: number): number => a + b;`;
    const result = typescriptExtractor.extract('test.ts', source);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].name).toBe('add');
    expect(result.nodes[0].kind).toBe('function');
  });

  it('extracts classes with methods and extends', () => {
    const source = `
class Animal {
  speak(): void {}
}

class Dog extends Animal {
  bark(): void { this.speak(); }
}`;
    const result = typescriptExtractor.extract('test.ts', source);

    const classNodes = result.nodes.filter(n => n.kind === 'class');
    expect(classNodes).toHaveLength(2);
    expect(classNodes.map(n => n.name)).toContain('Animal');
    expect(classNodes.map(n => n.name)).toContain('Dog');

    const methodNodes = result.nodes.filter(n => n.kind === 'function');
    expect(methodNodes.map(n => n.name)).toContain('Animal.speak');
    expect(methodNodes.map(n => n.name)).toContain('Dog.bark');

    const extendsRels = result.relationships.filter(r => r.relationshipKind === 'EXTENDS');
    expect(extendsRels).toHaveLength(1);
    expect(extendsRels[0].sourceName).toBe('Dog');
    expect(extendsRels[0].targetName).toBe('Animal');
  });

  it('extracts interfaces and types', () => {
    const source = `
interface Config { name: string; }
type Status = 'active' | 'inactive';`;
    const result = typescriptExtractor.extract('test.ts', source);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.find(n => n.kind === 'interface')?.name).toBe('Config');
    expect(result.nodes.find(n => n.kind === 'type')?.name).toBe('Status');
  });

  it('extracts imports and IMPORTS relationships', () => {
    const source = `import { readFileSync, writeFileSync } from 'fs';`;
    const result = typescriptExtractor.extract('test.ts', source);

    const importNodes = result.nodes.filter(n => n.kind === 'import');
    expect(importNodes).toHaveLength(1);
    expect(importNodes[0].name).toBe('fs');

    const importRels = result.relationships.filter(r => r.relationshipKind === 'IMPORTS');
    expect(importRels.length).toBeGreaterThanOrEqual(2);
    expect(importRels.map(r => r.targetName)).toContain('readFileSync');
    expect(importRels.map(r => r.targetName)).toContain('writeFileSync');
  });

  it('extracts CALLS relationships', () => {
    const source = `
function foo() { bar(); baz(); }
function bar() {}
function baz() {}`;
    const result = typescriptExtractor.extract('test.ts', source);

    const callRels = result.relationships.filter(r => r.relationshipKind === 'CALLS');
    expect(callRels.length).toBeGreaterThanOrEqual(2);
    expect(callRels.find(r => r.sourceName === 'foo' && r.targetName === 'bar')).toBeTruthy();
    expect(callRels.find(r => r.sourceName === 'foo' && r.targetName === 'baz')).toBeTruthy();
  });

  it('extracts multiple different CALLS without duplicates', () => {
    const source = `
function initStructures() {}
function initServer(port: number, bufferSize: number, handler: Function) {}
function clientHandler(socket: number) {}

function main() {
    initStructures();
    initServer(8080, 1024, clientHandler);
}`;
    const result = typescriptExtractor.extract('test.ts', source);

    const mainCalls = result.relationships.filter(
      r => r.relationshipKind === 'CALLS' && r.sourceName === 'main'
    );

    expect(mainCalls).toHaveLength(2);
    expect(mainCalls.find(r => r.targetName === 'initStructures')).toBeTruthy();
    expect(mainCalls.find(r => r.targetName === 'initServer')).toBeTruthy();

    const targetNames = mainCalls.map(r => r.targetName);
    expect(new Set(targetNames).size).toBe(targetNames.length);
  });

  it('extracts USES relationships for type references', () => {
    const source = `
interface Config { name: string; }
function loadConfig(path: string): Config { return {} as Config; }`;
    const result = typescriptExtractor.extract('test.ts', source);

    const usesRels = result.relationships.filter(r => r.relationshipKind === 'USES');
    expect(usesRels.find(r => r.targetName === 'Config')).toBeTruthy();
  });

  it('extracts multiple different CALLS from React component without duplicates', () => {
    const source = `
function useState(initial: any) { return [initial, () => {}]; }
function useEffect(fn: Function, deps: any[]) {}
function fetchUserData(id: string) {}
function formatName(name: string) { return name; }
function validateInput(input: string) { return true; }

const UserProfile = ({ userId }: { userId: string }) => {
    const [user, setUser] = useState(null);
    useEffect(() => {
        fetchUserData(userId);
    }, [userId]);
    const name = formatName(user?.name ?? '');
    const isValid = validateInput(name);
    return null;
}`;
    const result = typescriptExtractor.extract('UserProfile.tsx', source);

    const componentCalls = result.relationships.filter(
      r => r.relationshipKind === 'CALLS' && r.sourceName === 'UserProfile'
    );

    expect(componentCalls.find(r => r.targetName === 'useState')).toBeTruthy();
    expect(componentCalls.find(r => r.targetName === 'useEffect')).toBeTruthy();
    expect(componentCalls.find(r => r.targetName === 'formatName')).toBeTruthy();
    expect(componentCalls.find(r => r.targetName === 'validateInput')).toBeTruthy();

    // No duplicates
    const targetNames = componentCalls.map(r => r.targetName);
    expect(new Set(targetNames).size).toBe(targetNames.length);
  });

  it('extracts CALLS from React component with JSX and hooks', () => {
    const source = `
function useAuth() { return { user: null }; }
function useRouter() { return { push: () => {} }; }
function logPageView(page: string) {}

const Dashboard = () => {
    const auth = useAuth();
    const router = useRouter();
    logPageView('dashboard');
    return null;
}`;
    const result = typescriptExtractor.extract('Dashboard.tsx', source);

    const dashboardCalls = result.relationships.filter(
      r => r.relationshipKind === 'CALLS' && r.sourceName === 'Dashboard'
    );

    expect(dashboardCalls).toHaveLength(3);
    expect(dashboardCalls.find(r => r.targetName === 'useAuth')).toBeTruthy();
    expect(dashboardCalls.find(r => r.targetName === 'useRouter')).toBeTruthy();
    expect(dashboardCalls.find(r => r.targetName === 'logPageView')).toBeTruthy();

    const targetNames = dashboardCalls.map(r => r.targetName);
    expect(new Set(targetNames).size).toBe(targetNames.length);
  });

  it('extracts from fixture file', () => {
    const source = readFileSync(new URL('../../fixtures/sample.ts', import.meta.url), 'utf-8');
    const result = typescriptExtractor.extract('fixtures/sample.ts', source);

    expect(result.nodes.length).toBeGreaterThan(0);

    const kinds = new Set(result.nodes.map(n => n.kind));
    expect(kinds.has('function')).toBe(true);
    expect(kinds.has('class')).toBe(true);
    expect(kinds.has('interface')).toBe(true);
    expect(kinds.has('import')).toBe(true);
  });
});
