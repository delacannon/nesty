import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@nesty/core';
import { defaultGame, frameFromRows } from '@nesty/core';
import { buildRom, type BuildResult } from '../src';
import { bootRom, Controller, type Runner } from './helpers';

const MAP_RAM = 0x0500; // 240-byte working tilemap (ROM map + overlays)
const OVL_CELL = 5 * 16 + 5; // (5,5)

/**
 * Default room, but with a sprite-kind overlay at (5,5) gated by flag 'd'.
 * Stepping up onto (7,6) fires an event that sets flag 'd', which should flip
 * the overlay cell in map_ram to the sprite's BG-compiled tile index.
 */
function overlayGame(): GameData {
  const g = defaultGame();
  g.flags = [{ id: 'd', name: 'shown' }];
  g.sprites = [
    {
      id: 's',
      name: 'gizmo',
      frames: [frameFromRows(new Array(16).fill('0011001100110011'))],
      sprPal: 0,
      room: g.rooms[0]!.id,
      x: 1,
      y: 1,
    },
  ];
  g.rooms[0]!.events = [
    { x: 7, y: 6, actions: [{ type: 'setFlag', flagId: 'd' }] },
  ];
  g.rooms[0]!.overlays = [
    {
      x: 5,
      y: 5,
      tileId: 's',
      kind: 'sprite',
      cond: { kind: 'flag', flagId: 'd', negate: false },
    },
  ];
  return g;
}

let build: BuildResult;
let sym: Map<string, number>;
const S = (name: string) => {
  const v = sym.get(name);
  if (v === undefined) throw new Error(`symbol ${name} missing`);
  return v;
};
function boot(): Runner {
  const run = bootRom(build.rom!);
  run.frames(10);
  return run;
}
function settle(run: Runner) {
  for (let i = 0; i < 120 && run.ramAt(S('in_load')) !== 0; i++) run.frames(1);
  run.frames(2);
}
function startGame(run: Runner) {
  run.press(Controller.BUTTON_START);
  settle(run);
}

describe('sprite/item overlay compiled into BG (headless jsnes)', () => {
  beforeAll(() => {
    build = buildRom(overlayGame());
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('swaps the cell to the sprite tile when the cond becomes true', () => {
    const run = boot();
    startGame(run);
    // overlay index = game.tiles.length (1) + 1 = 2 (first appended BG drawable)
    const base = run.ramAt(MAP_RAM + OVL_CELL);
    expect(base).not.toBe(2); // cond unmet: base tile (empty)
    run.press(Controller.BUTTON_UP); // (7,6): setFlag d -> cond met
    expect(run.ramAt(MAP_RAM + OVL_CELL)).toBe(2);
  });
});
