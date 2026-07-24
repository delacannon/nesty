import { AsmFatal, type AsmError } from './errors';
import { evalExpr, parseExpr, type ExprNode } from './expr';
import { MODE_SIZE, OPCODES, type AddrMode } from './opcodes';
import { parseSource, type Line } from './parser';

export interface ListingEntry {
  line: number;
  pc: number;
  bytes: number[];
}

export interface AssembleResult {
  bin: Uint8Array;
  origin: number;
  symbols: Map<string, number>;
  listing: ListingEntry[];
  errors: AsmError[];
}

interface Operand {
  mode: AddrMode;
  expr?: ExprNode;
}

/** Split on top-level commas (outside quotes/parens). */
function splitArgs(text: string, line: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') inStr = !inStr;
    if (!inStr) {
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) {
        parts.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  if (inStr) throw new AsmFatal(line, 'unterminated string');
  if (cur.trim() !== '' || parts.length > 0) parts.push(cur.trim());
  return parts;
}

const IZX_RE = /^\((.+),\s*[xX]\)$/;
const IZY_RE = /^\((.+)\)\s*,\s*[yY]$/;
const IND_RE = /^\((.+)\)$/;
const IDX_RE = /^(.+),\s*([xyXY])$/;

/**
 * Parse an operand string into an addressing-mode candidate.
 * `resolve` returns the operand value if known (pass 1) — used for zp-vs-abs.
 */
function parseOperand(
  mnemonic: string,
  operand: string,
  line: number,
  resolve: (e: ExprNode) => number | undefined,
): Operand {
  const modes = OPCODES[mnemonic]!;

  if (operand === '') {
    if (modes.imp !== undefined) return { mode: 'imp' };
    if (modes.acc !== undefined) return { mode: 'acc' };
    throw new AsmFatal(line, `'${mnemonic}' requires an operand`);
  }

  if (operand.toLowerCase() === 'a' && modes.acc !== undefined) return { mode: 'acc' };

  if (operand.startsWith('#')) {
    if (modes.imm === undefined) throw new AsmFatal(line, `'${mnemonic}' has no immediate mode`);
    return { mode: 'imm', expr: parseExpr(operand.slice(1), line) };
  }

  if (modes.rel !== undefined) {
    return { mode: 'rel', expr: parseExpr(operand, line) };
  }

  let m = IZX_RE.exec(operand);
  if (m && modes.izx !== undefined) return { mode: 'izx', expr: parseExpr(m[1]!, line) };
  m = IZY_RE.exec(operand);
  if (m && modes.izy !== undefined) return { mode: 'izy', expr: parseExpr(m[1]!, line) };
  m = IND_RE.exec(operand);
  if (m && modes.ind !== undefined) return { mode: 'ind', expr: parseExpr(m[1]!, line) };

  let forceAbs = false;
  let rest = operand;
  if (rest.toLowerCase().startsWith('a:')) {
    forceAbs = true;
    rest = rest.slice(2).trim();
  }

  let idx: 'x' | 'y' | null = null;
  const im = IDX_RE.exec(rest);
  if (im) {
    // only treat as indexed if the tail isn't inside parens (already handled above)
    idx = im[2]!.toLowerCase() as 'x' | 'y';
    rest = im[1]!.trim();
  }

  const expr = parseExpr(rest, line);
  const zpMode: AddrMode | null = idx === null ? 'zp' : idx === 'x' ? 'zpx' : 'zpy';
  const absMode: AddrMode = idx === null ? 'abs' : idx === 'x' ? 'abx' : 'aby';

  if (!forceAbs && modes[zpMode] !== undefined) {
    const v = resolve(expr);
    if (v !== undefined && v < 0x100) {
      // known zero-page operand and a zp form exists
      if (modes[absMode] === undefined) return { mode: zpMode, expr };
      return { mode: zpMode, expr };
    }
  }
  if (modes[absMode] !== undefined) return { mode: absMode, expr };
  if (modes[zpMode] !== undefined) return { mode: zpMode, expr }; // zp-only instruction
  throw new AsmFatal(line, `'${mnemonic}' does not support this addressing mode`);
}

interface DataItem {
  kind: 'expr' | 'string';
  expr?: ExprNode;
  str?: string;
}

function parseDataArgs(args: string, line: number): DataItem[] {
  return splitArgs(args, line).map((a) => {
    if (a.startsWith('"')) {
      if (!a.endsWith('"') || a.length < 2) throw new AsmFatal(line, 'bad string literal');
      return { kind: 'string', str: a.slice(1, -1) } as DataItem;
    }
    return { kind: 'expr', expr: parseExpr(a, line) } as DataItem;
  });
}

export function assemble(source: string, opts: { origin?: number } = {}): AssembleResult {
  const origin = opts.origin ?? 0x8000;
  const errors: AsmError[] = [];
  const symbols = new Map<string, number>();
  const listing: ListingEntry[] = [];

  let lines: Line[];
  try {
    lines = parseSource(source);
  } catch (e) {
    if (e instanceof AsmFatal) {
      return { bin: new Uint8Array(0), origin, symbols, listing, errors: [{ line: e.line, message: e.message }] };
    }
    throw e;
  }

  // per parsed line: decided mode (instructions) so pass 2 sizes match pass 1
  const decidedModes: (AddrMode | undefined)[] = new Array(lines.length).fill(undefined);

  const runPass = (pass: 1 | 2, image?: Uint8Array): number => {
    let pc = origin;
    let maxPc = origin;
    let scope = '';

    const emit = (bytes: number[], lineNum: number) => {
      if (image) {
        for (let i = 0; i < bytes.length; i++) {
          const addr = pc + i;
          if (addr < origin || addr > 0xffff)
            throw new AsmFatal(lineNum, `write out of range at $${addr.toString(16)}`);
          image[addr - origin] = bytes[i]! & 0xff;
        }
        listing.push({ line: lineNum, pc, bytes });
      }
      pc += bytes.length;
      if (pc > maxPc) maxPc = pc;
    };

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      try {
        if (line.label) {
          if (line.label.startsWith('@')) {
            const full = scope + line.label;
            if (pass === 1 && symbols.has(full))
              throw new AsmFatal(line.num, `duplicate label '${line.label}'`);
            symbols.set(full, pc);
          } else {
            if (pass === 1 && symbols.has(line.label))
              throw new AsmFatal(line.num, `duplicate label '${line.label}'`);
            symbols.set(line.label, pc);
            scope = line.label;
          }
        }

        const stmt = line.stmt;
        if (stmt.kind === 'none') continue;

        if (stmt.kind === 'assign') {
          const v = evalExpr(parseExpr(stmt.expr, line.num), symbols, pc, scope);
          if (v === undefined)
            throw new AsmFatal(line.num, `cannot resolve '${stmt.expr}' for assignment`);
          symbols.set(stmt.name, v);
          continue;
        }

        if (stmt.kind === 'directive') {
          switch (stmt.name) {
            case '.org': {
              const v = evalExpr(parseExpr(stmt.args, line.num), symbols, pc, scope);
              if (v === undefined) throw new AsmFatal(line.num, '.org must be resolvable');
              if (v < origin) throw new AsmFatal(line.num, '.org below origin');
              pc = v;
              if (pc > maxPc) maxPc = pc;
              break;
            }
            case '.byte':
            case '.word': {
              const items = parseDataArgs(stmt.args, line.num);
              const bytes: number[] = [];
              for (const it of items) {
                if (it.kind === 'string') {
                  for (const ch of it.str!) bytes.push(ch.charCodeAt(0) & 0xff);
                  if (stmt.name === '.word')
                    throw new AsmFatal(line.num, 'strings not allowed in .word');
                } else {
                  const v = evalExpr(it.expr!, symbols, pc, scope);
                  if (pass === 2 && v === undefined)
                    throw new AsmFatal(line.num, 'unresolved expression in data');
                  const val = v ?? 0;
                  if (stmt.name === '.byte') bytes.push(val & 0xff);
                  else {
                    bytes.push(val & 0xff, (val >> 8) & 0xff);
                  }
                }
              }
              emit(bytes, line.num);
              break;
            }
            case '.res': {
              const parts = splitArgs(stmt.args, line.num);
              const n = evalExpr(parseExpr(parts[0]!, line.num), symbols, pc, scope);
              if (n === undefined) throw new AsmFatal(line.num, '.res size must be resolvable');
              const fill =
                parts.length > 1
                  ? (evalExpr(parseExpr(parts[1]!, line.num), symbols, pc, scope) ?? 0)
                  : 0;
              emit(new Array(n).fill(fill & 0xff), line.num);
              break;
            }
            default:
              throw new AsmFatal(line.num, `unknown directive '${stmt.name}'`);
          }
          continue;
        }

        // instruction
        const modes = OPCODES[stmt.mnemonic]!;
        let op: Operand;
        if (pass === 1) {
          op = parseOperand(stmt.mnemonic, stmt.operand, line.num, (e) =>
            evalExpr(e, symbols, pc, scope),
          );
          decidedModes[li] = op.mode;
        } else {
          const decided = decidedModes[li]!;
          op = parseOperand(stmt.mnemonic, stmt.operand, line.num, () =>
            decided === 'zp' || decided === 'zpx' || decided === 'zpy' ? 0 : undefined,
          );
          op.mode = decided; // sizes must match pass 1
        }

        const opcode = modes[op.mode];
        if (opcode === undefined)
          throw new AsmFatal(line.num, `'${stmt.mnemonic}' has no '${op.mode}' mode`);
        const size = MODE_SIZE[op.mode];
        const bytes = [opcode];

        if (size > 1) {
          let v = op.expr ? evalExpr(op.expr, symbols, pc, scope) : undefined;
          if (pass === 2 && v === undefined)
            throw new AsmFatal(line.num, `unresolved operand '${stmt.operand}'`);
          v = v ?? 0;
          if (op.mode === 'rel') {
            if (pass === 2) {
              const off = v - (pc + 2);
              if (off < -128 || off > 127)
                throw new AsmFatal(line.num, `branch out of range (${off})`);
              bytes.push(off & 0xff);
            } else {
              bytes.push(0);
            }
          } else if (size === 2) {
            if (pass === 2 && v > 0xff && op.mode !== 'imm')
              throw new AsmFatal(line.num, `operand $${v.toString(16)} does not fit zero page`);
            bytes.push(v & 0xff);
          } else {
            bytes.push(v & 0xff, (v >> 8) & 0xff);
          }
        }
        emit(bytes, line.num);
      } catch (e) {
        if (e instanceof AsmFatal) {
          errors.push({ line: e.line, message: e.message });
          if (pass === 1) decidedModes[li] = decidedModes[li] ?? undefined;
        } else throw e;
      }
    }
    return maxPc;
  };

  const maxPc = runPass(1);
  if (errors.length > 0) {
    return { bin: new Uint8Array(0), origin, symbols, listing, errors };
  }

  const image = new Uint8Array(Math.max(0, maxPc - origin)).fill(0xff);
  runPass(2, image);

  return { bin: image, origin, symbols, listing, errors };
}
