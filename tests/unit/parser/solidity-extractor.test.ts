import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { solidityExtractor } from '../../../src/parser/extractors/solidity.js';

describe('Solidity Extractor', () => {
  it('extracts contracts', () => {
    const source = `
pragma solidity ^0.8.0;
contract Token { }`;
    const result = solidityExtractor.extract('test.sol', source);

    const contracts = result.nodes.filter(n => n.kind === 'contract');
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe('Token');
  });

  it('extracts contract inheritance with EXTENDS', () => {
    const source = `
pragma solidity ^0.8.0;
contract Base { }
contract Child is Base { }`;
    const result = solidityExtractor.extract('test.sol', source);

    const extendsRels = result.relationships.filter(r => r.relationshipKind === 'EXTENDS');
    expect(extendsRels).toHaveLength(1);
    expect(extendsRels[0].sourceName).toBe('Child');
    expect(extendsRels[0].targetName).toBe('Base');
  });

  it('extracts multiple inheritance', () => {
    const source = `
pragma solidity ^0.8.0;
contract Child is Base, Mixin { }`;
    const result = solidityExtractor.extract('test.sol', source);

    const extendsRels = result.relationships.filter(r => r.relationshipKind === 'EXTENDS');
    expect(extendsRels).toHaveLength(2);
    expect(extendsRels.map(r => r.targetName)).toContain('Base');
    expect(extendsRels.map(r => r.targetName)).toContain('Mixin');
  });

  it('extracts functions namespaced by contract', () => {
    const source = `
pragma solidity ^0.8.0;
contract Token {
  function transfer(address to, uint256 amount) public { }
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const fns = result.nodes.filter(n => n.kind === 'function');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('Token.transfer');
  });

  it('extracts events', () => {
    const source = `
pragma solidity ^0.8.0;
contract Token {
  event Transfer(address indexed from, address indexed to, uint256 value);
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const events = result.nodes.filter(n => n.kind === 'event');
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Token.Transfer');
  });

  it('extracts modifiers', () => {
    const source = `
pragma solidity ^0.8.0;
contract Ownable {
  modifier onlyOwner() { _; }
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const modifiers = result.nodes.filter(n => n.kind === 'modifier');
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0].name).toBe('Ownable.onlyOwner');
  });

  it('extracts structs and enums', () => {
    const source = `
pragma solidity ^0.8.0;
contract Token {
  struct Balance { uint256 amount; }
  enum Status { Active, Paused }
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const structs = result.nodes.filter(n => n.kind === 'struct');
    expect(structs).toHaveLength(1);
    expect(structs[0].name).toBe('Token.Balance');

    const enums = result.nodes.filter(n => n.kind === 'enum');
    expect(enums).toHaveLength(1);
    expect(enums[0].name).toBe('Token.Status');
  });

  it('extracts interfaces', () => {
    const source = `
pragma solidity ^0.8.0;
interface IToken {
  function transfer(address to, uint256 amount) external returns (bool);
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const interfaces = result.nodes.filter(n => n.kind === 'interface');
    expect(interfaces).toHaveLength(1);
    expect(interfaces[0].name).toBe('IToken');
  });

  it('extracts imports with IMPORTS relationship', () => {
    const source = `
pragma solidity ^0.8.0;
import './IERC20.sol';`;
    const result = solidityExtractor.extract('test.sol', source);

    const imports = result.nodes.filter(n => n.kind === 'import');
    expect(imports).toHaveLength(1);
    expect(imports[0].name).toBe('./IERC20.sol');

    const importRels = result.relationships.filter(r => r.relationshipKind === 'IMPORTS');
    expect(importRels).toHaveLength(1);
  });

  it('extracts CALLS relationships', () => {
    const source = `
pragma solidity ^0.8.0;
contract Token {
  function transfer(address to, uint256 amount) public {
    _transfer(msg.sender, to, amount);
  }
  function _transfer(address from, address to, uint256 amount) internal { }
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const callRels = result.relationships.filter(r => r.relationshipKind === 'CALLS');
    expect(callRels.find(r => r.sourceName === 'Token.transfer' && r.targetName === '_transfer')).toBeTruthy();
  });

  it('extracts multiple different CALLS without duplicates', () => {
    const source = `
pragma solidity ^0.8.0;
contract Token {
  function mint(address to, uint256 amount) public {
    _beforeTransfer(to, amount);
    _mint(to, amount);
    _afterTransfer(to, amount);
  }
  function _beforeTransfer(address to, uint256 amount) internal { }
  function _mint(address to, uint256 amount) internal { }
  function _afterTransfer(address to, uint256 amount) internal { }
}`;
    const result = solidityExtractor.extract('test.sol', source);

    const mintCalls = result.relationships.filter(
      r => r.relationshipKind === 'CALLS' && r.sourceName === 'Token.mint'
    );

    expect(mintCalls).toHaveLength(3);
    expect(mintCalls.find(r => r.targetName === '_beforeTransfer')).toBeTruthy();
    expect(mintCalls.find(r => r.targetName === '_mint')).toBeTruthy();
    expect(mintCalls.find(r => r.targetName === '_afterTransfer')).toBeTruthy();

    const targetNames = mintCalls.map(r => r.targetName);
    expect(new Set(targetNames).size).toBe(targetNames.length);
  });

  it('extracts from fixture file', () => {
    const source = readFileSync(new URL('../../fixtures/sample.sol', import.meta.url), 'utf-8');
    const result = solidityExtractor.extract('fixtures/sample.sol', source);

    expect(result.nodes.length).toBeGreaterThan(0);

    const kinds = new Set(result.nodes.map(n => n.kind));
    expect(kinds.has('contract')).toBe(true);
    expect(kinds.has('function')).toBe(true);
    expect(kinds.has('event')).toBe(true);
    expect(kinds.has('modifier')).toBe(true);
    expect(kinds.has('struct')).toBe(true);
    expect(kinds.has('enum')).toBe(true);
    expect(kinds.has('interface')).toBe(true);
    expect(kinds.has('import')).toBe(true);
  });
});
