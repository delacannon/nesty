import { describe, expect, it } from 'vitest';
import { jadeDemo, validate } from '../src';

/** Every distinct NES colour index actually painted on the room's screen. */
function shownColors() {
  const g = jadeDemo();
  const room = g.rooms[0]!;
  const pal = g.palettes.find((p) => p.id === room.palId)!;
  const seen = new Set<number>();

  // background: each cell's tile, coloured by its pmap sub-palette
  room.tiles.forEach((id, i) => {
    if (id === '0') return;
    const tile = g.tiles.find((t) => t.id === id)!;
    const sub = pal.bg[room.pmap[i]!]!;
    for (const px of tile.frames[0]!)
      seen.add(px === 0 ? pal.backdrop : sub[px - 1]!);
  });

  // sprites + avatar
  const drawSpr = (frames: number[][], sprPal: number) => {
    const sub = pal.spr[sprPal]!;
    for (const px of frames[0]!) if (px !== 0) seen.add(sub[px - 1]!);
  };
  for (const s of g.sprites) drawSpr(s.frames, s.sprPal);
  drawSpr(g.avatar.frames, g.avatar.sprPal);

  return seen;
}

describe('jade demo (25 colours)', () => {
  it('validates with no errors', () => {
    expect(validate(jadeDemo()).filter((d) => d.severity === 'error')).toEqual(
      [],
    );
  });

  it('paints exactly 25 distinct NES colours in one room', () => {
    expect(shownColors().size).toBe(25);
  });

  it('uses all 8 sub-palettes (full NES colour capacity)', () => {
    const g = jadeDemo();
    const bgSubs = new Set<number>(
      g.rooms[0]!.tiles.map((id, i) => (id === '0' ? -1 : g.rooms[0]!.pmap[i]!)),
    );
    const sprSubs = new Set<number>(g.sprites.map((s) => s.sprPal));
    expect([0, 1, 2, 3].every((s) => bgSubs.has(s))).toBe(true);
    expect([0, 1, 2, 3].every((s) => sprSubs.has(s))).toBe(true);
  });
});
