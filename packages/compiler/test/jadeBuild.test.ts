import { describe, expect, it } from 'vitest';
import { jadeDemo } from '@nesty/core';
import { buildRom } from '../src';

describe('jade demo builds', () => {
  it('compiles to a ROM within budget', () => {
    const res = buildRom(jadeDemo());
    expect(res.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.rom!.length).toBeGreaterThan(0);
  });
});
