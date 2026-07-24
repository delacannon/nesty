/**
 * Line grammar:
 *   [label:] [@local:] [mnemonic operand | .directive args | NAME = expr] [; comment]
 */
import { AsmFatal } from './errors';
import { isMnemonic } from './opcodes';

export type Stmt =
  | { kind: 'none' }
  | { kind: 'instr'; mnemonic: string; operand: string }
  | { kind: 'directive'; name: string; args: string }
  | { kind: 'assign'; name: string; expr: string };

export interface Line {
  num: number;
  label?: string; // includes leading '@' for locals
  stmt: Stmt;
}

const LABEL_RE = /^(@?[A-Za-z_][A-Za-z0-9_]*):/;
const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;

function stripComment(text: string): string {
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inStr = !inStr;
    else if (c === "'" && !inStr && text[i + 2] === "'") i += 2;
    else if (c === ';' && !inStr) return text.slice(0, i);
  }
  return text;
}

export function parseLine(raw: string, num: number): Line[] {
  let text = stripComment(raw).trim();
  const lines: Line[] = [];
  let label: string | undefined;

  const m = LABEL_RE.exec(text);
  if (m) {
    label = m[1]!;
    text = text.slice(m[0].length).trim();
  }

  if (text === '') {
    lines.push({ num, label, stmt: { kind: 'none' } });
    return lines;
  }

  if (text.startsWith('.')) {
    const sp = text.search(/[\s]/);
    const name = (sp === -1 ? text : text.slice(0, sp)).toLowerCase();
    const args = sp === -1 ? '' : text.slice(sp).trim();
    lines.push({ num, label, stmt: { kind: 'directive', name, args } });
    return lines;
  }

  const am = ASSIGN_RE.exec(text);
  if (am && !isMnemonic(am[1]!)) {
    lines.push({ num, label, stmt: { kind: 'assign', name: am[1]!, expr: am[2]! } });
    return lines;
  }

  const sp = text.search(/[\s]/);
  const word = sp === -1 ? text : text.slice(0, sp);
  if (!isMnemonic(word)) {
    throw new AsmFatal(num, `unknown mnemonic or directive '${word}'`);
  }
  const operand = sp === -1 ? '' : text.slice(sp).trim();
  lines.push({ num, label, stmt: { kind: 'instr', mnemonic: word.toLowerCase(), operand } });
  return lines;
}

export function parseSource(source: string): Line[] {
  const out: Line[] = [];
  const rows = source.split(/\r?\n/);
  for (let i = 0; i < rows.length; i++) {
    out.push(...parseLine(rows[i]!, i + 1));
  }
  return out;
}
