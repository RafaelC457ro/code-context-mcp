import { readFileSync } from 'fs';

export interface Config {
  name: string;
  debug: boolean;
}

export type Status = 'active' | 'inactive';

export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  log(message: string): void {
    console.log(`${this.prefix}: ${message}`);
  }
}

export function loadConfig(path: string): Config {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

export function greet(name: string): string {
  return `Hello, ${name}!`;
}
