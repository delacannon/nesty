import { describe, expect, it } from 'vitest';
import { parse, serialize, theThing, validate } from '@nesty/core';
import { buildRom } from '../src';

describe('who goes there? (bundled example)', () => {
  it('validates, round-trips, and builds to a ROM', () => {
    const game = theThing();
    expect(validate(game).filter((d) => d.severity === 'error')).toEqual([]);
    const { game: g2, errors } = parse(serialize(game));
    expect(errors).toEqual([]);
    expect(g2.rooms.length).toBe(6);
    expect(g2.items.length).toBe(5);
    const build = buildRom(game);
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    expect(build.report!.prgFree).toBeGreaterThan(0);
  });
});
