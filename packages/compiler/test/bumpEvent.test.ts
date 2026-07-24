import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@nesty/core';
import { defaultGame } from '@nesty/core';
import { buildRom, type BuildResult } from '../src';
import { bootRom, Controller, type Runner } from './helpers';

const GAME_FLAGS = 0x03a0;

/**
 * Default bordered room, start (7,7). A solid wall tile sits at (7,6) with an
 * event on it — the player can't step onto it, but bumping into it (pressing
 * up) should still fire the event.
 */
function bumpGame(): GameData {
  const g = defaultGame();
  g.flags = [{ id: 'd', name: 'talked' }];
  const wall = g.tiles[0]!; // block tile (wall:true)
  g.rooms[0]!.tiles[6 * 16 + 7] = wall.id; // (7,6)
  g.rooms[0]!.events = [{ x: 7, y: 6, actions: [{ type: 'setFlag', flagId: 'd' }] }];
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

describe('bump-to-interact on a solid wall event (headless jsnes)', () => {
  beforeAll(() => {
    build = buildRom(bumpGame());
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('fires the wall cell event without moving the player', () => {
    const run = boot();
    startGame(run);
    expect(run.ramAt(GAME_FLAGS)).toBe(0);
    run.press(Controller.BUTTON_UP); // bump into wall at (7,6)
    expect(run.ramAt(GAME_FLAGS) & 1).toBe(1); // event fired
    expect(run.ramAt(S('player_y'))).toBe(7); // blocked: did not move
  });
});
