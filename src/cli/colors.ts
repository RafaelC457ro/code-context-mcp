// ANSI color codes
export const COLORS = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// Cursor control
export const CURSOR = {
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
};

// Convenience helpers — wrap text in color + reset
export const green = (s: string) => `${COLORS.green}${s}${COLORS.reset}`;
export const cyan = (s: string) => `${COLORS.cyan}${s}${COLORS.reset}`;
export const yellow = (s: string) => `${COLORS.yellow}${s}${COLORS.reset}`;
export const magenta = (s: string) => `${COLORS.magenta}${s}${COLORS.reset}`;
export const red = (s: string) => `${COLORS.red}${s}${COLORS.reset}`;
export const dim = (s: string) => `${COLORS.dim}${s}${COLORS.reset}`;
export const bold = (s: string) => `${COLORS.bold}${s}${COLORS.reset}`;
