/**
 * Expression tokenizer + Pratt parser + evaluator.
 * Numbers: 123, $1F, %1010, 'c'. Symbols case-sensitive. '*' = current PC.
 * Binary ops: + - * / & | ^ << >>  Unary: - < (low byte) > (high byte) ( )
 */
import { AsmFatal } from './errors';

export type ExprNode =
  | { kind: 'num'; value: number }
  | { kind: 'sym'; name: string }
  | { kind: 'pc' }
  | { kind: 'unary'; op: string; arg: ExprNode }
  | { kind: 'bin'; op: string; left: ExprNode; right: ExprNode };

interface Tok {
  type: 'num' | 'sym' | 'op';
  value: string;
  num?: number;
}

const SYM_START = /[A-Za-z_@]/;
const SYM_CHAR = /[A-Za-z0-9_@]/;

export function tokenizeExpr(src: string, line: number): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '$') {
      let j = i + 1;
      while (j < src.length && /[0-9a-fA-F]/.test(src[j]!)) j++;
      if (j === i + 1) throw new AsmFatal(line, 'bad hex literal');
      toks.push({ type: 'num', value: src.slice(i, j), num: parseInt(src.slice(i + 1, j), 16) });
      i = j;
    } else if (c === '%') {
      let j = i + 1;
      while (j < src.length && /[01]/.test(src[j]!)) j++;
      if (j === i + 1) throw new AsmFatal(line, 'bad binary literal');
      toks.push({ type: 'num', value: src.slice(i, j), num: parseInt(src.slice(i + 1, j), 2) });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j]!)) j++;
      toks.push({ type: 'num', value: src.slice(i, j), num: parseInt(src.slice(i, j), 10) });
      i = j;
    } else if (c === "'") {
      if (i + 2 >= src.length || src[i + 2] !== "'") throw new AsmFatal(line, 'bad char literal');
      toks.push({ type: 'num', value: src.slice(i, i + 3), num: src.charCodeAt(i + 1) });
      i += 3;
    } else if (SYM_START.test(c)) {
      let j = i;
      while (j < src.length && SYM_CHAR.test(src[j]!)) j++;
      toks.push({ type: 'sym', value: src.slice(i, j) });
      i = j;
    } else if (c === '<' && src[i + 1] === '<') {
      toks.push({ type: 'op', value: '<<' });
      i += 2;
    } else if (c === '>' && src[i + 1] === '>') {
      toks.push({ type: 'op', value: '>>' });
      i += 2;
    } else if ('+-*/&|^()<>'.includes(c)) {
      toks.push({ type: 'op', value: c });
      i++;
    } else {
      throw new AsmFatal(line, `unexpected character '${c}' in expression`);
    }
  }
  return toks;
}

const BIN_PREC: Record<string, number> = {
  '|': 1,
  '^': 2,
  '&': 3,
  '<<': 4,
  '>>': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
};

class Parser {
  pos = 0;
  constructor(
    private toks: Tok[],
    private line: number,
  ) {}

  peek(): Tok | undefined {
    return this.toks[this.pos];
  }
  next(): Tok {
    const t = this.toks[this.pos++];
    if (!t) throw new AsmFatal(this.line, 'unexpected end of expression');
    return t;
  }

  parseExpr(minPrec = 0): ExprNode {
    let left = this.parsePrefix();
    for (;;) {
      const t = this.peek();
      if (!t || t.type !== 'op') break;
      const prec = BIN_PREC[t.value];
      if (prec === undefined || prec < minPrec) break;
      this.next();
      const right = this.parseExpr(prec + 1);
      left = { kind: 'bin', op: t.value, left, right };
    }
    return left;
  }

  parsePrefix(): ExprNode {
    const t = this.next();
    if (t.type === 'num') return { kind: 'num', value: t.num! };
    if (t.type === 'sym') return { kind: 'sym', name: t.value };
    if (t.type === 'op') {
      if (t.value === '(') {
        const inner = this.parseExpr(0);
        const close = this.next();
        if (close.type !== 'op' || close.value !== ')')
          throw new AsmFatal(this.line, 'expected )');
        return inner;
      }
      if (t.value === '-') return { kind: 'unary', op: '-', arg: this.parsePrefix() };
      if (t.value === '<') return { kind: 'unary', op: '<', arg: this.parsePrefix() };
      if (t.value === '>') return { kind: 'unary', op: '>', arg: this.parsePrefix() };
      if (t.value === '*') return { kind: 'pc' };
    }
    throw new AsmFatal(this.line, `unexpected token '${t.value}' in expression`);
  }
}

export function parseExpr(src: string, line: number): ExprNode {
  const toks = tokenizeExpr(src, line);
  if (toks.length === 0) throw new AsmFatal(line, 'empty expression');
  const p = new Parser(toks, line);
  const node = p.parseExpr(0);
  if (p.pos !== toks.length)
    throw new AsmFatal(line, `unexpected trailing tokens in expression '${src}'`);
  return node;
}

/** Evaluate; returns undefined when a symbol is not (yet) defined. */
export function evalExpr(
  node: ExprNode,
  symbols: ReadonlyMap<string, number>,
  pc: number,
  scope: string,
): number | undefined {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'pc':
      return pc;
    case 'sym': {
      const name = node.name.startsWith('@') ? scope + node.name : node.name;
      return symbols.get(name);
    }
    case 'unary': {
      const v = evalExpr(node.arg, symbols, pc, scope);
      if (v === undefined) return undefined;
      if (node.op === '-') return -v & 0xffff;
      if (node.op === '<') return v & 0xff;
      return (v >> 8) & 0xff;
    }
    case 'bin': {
      const l = evalExpr(node.left, symbols, pc, scope);
      const r = evalExpr(node.right, symbols, pc, scope);
      if (l === undefined || r === undefined) return undefined;
      switch (node.op) {
        case '+':
          return (l + r) & 0xffff;
        case '-':
          return (l - r) & 0xffff;
        case '*':
          return (l * r) & 0xffff;
        case '/':
          return r === 0 ? undefined : Math.floor(l / r) & 0xffff;
        case '&':
          return l & r;
        case '|':
          return l | r;
        case '^':
          return l ^ r;
        case '<<':
          return (l << r) & 0xffff;
        case '>>':
          return l >>> r;
      }
    }
  }
  return undefined;
}
