import { describe, expect, it } from 'vitest';
import { assemble } from '../src';

describe('expressions', () => {
  const val = (expr: string): number[] => {
    const r = assemble(`.byte ${expr}`);
    expect(r.errors).toEqual([]);
    return Array.from(r.bin);
  };

  it('literals', () => {
    expect(val('$1f')).toEqual([0x1f]);
    expect(val('%1010')).toEqual([10]);
    expect(val('65')).toEqual([65]);
    expect(val("'A'")).toEqual([65]);
  });

  it('arithmetic + precedence', () => {
    expect(val('2+3*4')).toEqual([14]);
    expect(val('(2+3)*4')).toEqual([20]);
    expect(val('16/4-1')).toEqual([3]);
    expect(val('1<<4|1')).toEqual([17]);
    expect(val('$ff&$0f')).toEqual([0x0f]);
    expect(val('$f0^$ff')).toEqual([0x0f]);
    expect(val('$40>>2')).toEqual([0x10]);
  });

  it('lo/hi byte operators', () => {
    const r = assemble('lda #<target\nldx #>target\ntarget = $beef');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xa9, 0xef, 0xa2, 0xbe]);
  });

  it('* is current pc', () => {
    const r = assemble('.org $9000\n.word *', { origin: 0x9000 });
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0x00, 0x90]);
  });
});

describe('two-pass / labels', () => {
  it('forward reference resolves to absolute', () => {
    const r = assemble('jmp done\nnop\ndone: rts');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0x4c, 0x04, 0x80, 0xea, 0x60]);
    expect(r.symbols.get('done')).toBe(0x8004);
  });

  it('known zp constant chooses zero page', () => {
    const r = assemble('ptr = $10\nlda ptr\nsta ptr,x');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xa5, 0x10, 0x95, 0x10]);
  });

  it('a: prefix forces absolute', () => {
    const r = assemble('ptr = $10\nlda a:ptr');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xad, 0x10, 0x00]);
  });

  it('local labels scoped between globals', () => {
    const src = [
      'first:',
      '@loop: dex',
      'bne @loop',
      'second:',
      '@loop: dey',
      'bne @loop',
      'rts',
    ].join('\n');
    const r = assemble(src);
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xca, 0xd0, 0xfd, 0x88, 0xd0, 0xfd, 0x60]);
  });

  it('backward branch', () => {
    const r = assemble('loop: nop\nbne loop');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xea, 0xd0, 0xfd]);
  });
});

describe('directives', () => {
  it('.byte with strings and exprs', () => {
    const r = assemble('.byte "AB", 1, $ff');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0x41, 0x42, 0x01, 0xff]);
  });

  it('.word little-endian', () => {
    const r = assemble('.word $1234, $abcd');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0x34, 0x12, 0xcd, 0xab]);
  });

  it('.res reserves fill bytes', () => {
    const r = assemble('.res 3, $aa\n.byte 1');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xaa, 0xaa, 0xaa, 0x01]);
  });

  it('.org gap fills $ff and vectors land at end', () => {
    const src = ['start: rts', '.org $8010', '.word start'].join('\n');
    const r = assemble(src);
    expect(r.errors).toEqual([]);
    expect(r.bin.length).toBe(0x12);
    expect(r.bin[0]).toBe(0x60);
    expect(r.bin[1]).toBe(0xff);
    expect(Array.from(r.bin.slice(0x10))).toEqual([0x00, 0x80]);
  });

  it('comments ignored', () => {
    const r = assemble('nop ; comment with lda $10\n; full line\nrts');
    expect(r.errors).toEqual([]);
    expect(Array.from(r.bin)).toEqual([0xea, 0x60]);
  });
});

describe('errors', () => {
  it('branch out of range', () => {
    const r = assemble('beq far\n.org $8200\nfar: rts');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]!.message).toMatch(/branch out of range/);
  });

  it('unknown symbol', () => {
    const r = assemble('lda nowhere');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('duplicate label', () => {
    const r = assemble('dup: nop\ndup: nop');
    expect(r.errors[0]!.message).toMatch(/duplicate/);
  });

  it('unknown mnemonic', () => {
    const r = assemble('xyz $10');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('bad addressing mode', () => {
    const r = assemble('sta #$10');
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
