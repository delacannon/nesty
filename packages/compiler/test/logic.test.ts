import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData, TileDef } from '@nesty/core';
import { blankRoom, defaultAvatar, defaultPalette, defaultSfxSet, frameFromRows } from '@nesty/core';
import { buildRom, type BuildResult } from '../src';
import { bootRom, Controller, type Runner } from './helpers';

const ST_WALK = 1;
const ST_DIALOG = 2;
const ST_ENDING = 3;

// engine RAM (fixed addresses, see engine.asm)
const GAME_FLAGS = 0x03a0;
const VAR_VALS = 0x03b0;
const SPR_ANIM_CTL = 0x0460;
const MAP_RAM = 0x0500;

function solid(v: number): string[] {
  return new Array(16).fill(String(v).repeat(16));
}

function blockTile(): TileDef {
  return { id: 'a', name: 'block', wall: true, frames: [frameFromRows(solid(1))] };
}

/**
 * Room 0 (bordered, start 7,7):
 *   coins 'k' at (5,7) and (4,7)
 *   once-event at (7,6): flag+ d; var+ v 2; anim c f1
 *   repeat-event at (7,8): var+ v 1
 *   overlay: wall tile 'a' at (9,7) while flag d is CLEAR
 *   sprite c at (7,4), appears only while flag d is SET
 *   item 'k' at (7,9), appears only when coins >= 2
 *   exit (15,7) -> room 1, requires coins >= 2, locked dialog 'd'
 * Room 1: ending at (3,7).
 */
function logicGame(): GameData {
  const block = blockTile();
  const room0 = blankRoom('0');
  const room1 = blankRoom('1');
  for (const room of [room0, room1]) {
    for (let x = 0; x < 16; x++) {
      room.tiles[x] = block.id;
      room.tiles[14 * 16 + x] = block.id;
    }
    for (let y = 0; y < 15; y++) {
      room.tiles[y * 16] = block.id;
      room.tiles[y * 16 + 15] = block.id;
    }
  }
  room0.items.push({ itemId: 'k', x: 5, y: 7 }, { itemId: 'k', x: 4, y: 7 });
  room0.items.push({
    itemId: 'k',
    x: 7,
    y: 9,
    appearCond: { kind: 'count', itemId: 'k', cmp: '>=', value: 2 },
  });
  room0.events.push({
    x: 7,
    y: 6,
    once: true,
    actions: [
      { type: 'setFlag', flagId: 'd' },
      { type: 'addVar', varId: 'v', delta: 2 },
      { type: 'spriteAnim', spriteId: 'c', mode: 'f1' },
    ],
  });
  room0.events.push({ x: 7, y: 8, actions: [{ type: 'addVar', varId: 'v', delta: 1 }] });
  room0.overlays.push({
    x: 9,
    y: 7,
    tileId: 'a',
    cond: { kind: 'flag', flagId: 'd', negate: true },
  });
  room0.exits.push({
    x: 15,
    y: 7,
    destRoom: '1',
    destX: 1,
    destY: 7,
    req: { kind: 'count', itemId: 'k', cmp: '>=', value: 2 },
    lockedDlgId: 'd',
  });
  room1.endings.push({ x: 3, y: 7, dlgId: 'e' });

  const catRows = solid(0).map((r, y) => (y >= 8 ? '0011111111111100' : r));
  const keyRows = solid(0).map((r, y) => (y >= 6 && y <= 10 ? '0000011222110000' : r));
  return {
    title: 'logic quest',
    version: 2,
    startRoom: '0',
    startX: 7,
    startY: 7,
    textSpeed: 'turbo',
    font: 'classic',
    palettes: [defaultPalette()],
    tiles: [block],
    sprites: [
      {
        id: 'c',
        name: 'cat',
        frames: [frameFromRows(catRows), frameFromRows(catRows)],
        sprPal: 1,
        dlgId: 'c',
        room: '0',
        x: 7,
        y: 4,
        appearCond: { kind: 'flag', flagId: 'd', negate: false },
      },
    ],
    items: [{ id: 'k', name: 'coin', frames: [frameFromRows(keyRows)], sprPal: 2 }],
    flags: [{ id: 'd', name: 'door open' }],
    variables: [{ id: 'v', name: 'value', initial: 3 }],
    rooms: [room0, room1],
    dialogs: {
      c: 'Meow.',
      e: 'You reached the end.',
      d: 'Locked. Bring two coins.',
    },
    avatar: defaultAvatar(),
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [],
  };
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

function state(run: Runner) {
  return run.ramAt(S('game_state'));
}

function settle(run: Runner) {
  for (let i = 0; i < 120 && run.ramAt(S('in_load')) !== 0; i++) run.frames(1);
  run.frames(2);
}

function startGame(run: Runner) {
  run.press(Controller.BUTTON_START);
  settle(run);
}

function closeDialog(run: Runner) {
  for (let i = 0; i < 30 && state(run) === ST_DIALOG; i++) {
    run.frames(30);
    run.press(Controller.BUTTON_A);
  }
}

function fireOnceEvent(run: Runner) {
  run.press(Controller.BUTTON_UP); // (7,6): once-event
  expect(run.ramAt(S('player_y'))).toBe(6);
}

function grabCoins(run: Runner) {
  run.press(Controller.BUTTON_LEFT); // (6,7)
  run.press(Controller.BUTTON_LEFT); // (5,7) coin 1
  run.press(Controller.BUTTON_LEFT); // (4,7) coin 2
  expect(run.ramAt(S('inv_count'))).toBe(2);
}

describe('logic e2e (headless jsnes)', () => {
  beforeAll(() => {
    build = buildRom(logicGame());
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('initializes variables at game start', () => {
    const run = boot();
    startGame(run);
    expect(run.ramAt(VAR_VALS)).toBe(3);
    expect(run.ramAt(GAME_FLAGS)).toBe(0);
  });

  it('once-event sets flag, adds to var, switches sprite anim; fires once', () => {
    const run = boot();
    startGame(run);
    fireOnceEvent(run);
    expect(run.ramAt(GAME_FLAGS)).toBe(1);
    expect(run.ramAt(VAR_VALS)).toBe(5); // 3 + 2
    expect(run.ramAt(SPR_ANIM_CTL)).toBe(2); // hold f1
    // walk off and back on: once-event stays fired
    run.press(Controller.BUTTON_DOWN);
    run.press(Controller.BUTTON_UP);
    expect(run.ramAt(VAR_VALS)).toBe(5);
  });

  it('repeatable event fires every step', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_DOWN); // (7,8): var+1
    expect(run.ramAt(VAR_VALS)).toBe(4);
    run.press(Controller.BUTTON_DOWN); // (7,9)
    run.press(Controller.BUTTON_UP); // (7,8): var+1 again
    expect(run.ramAt(VAR_VALS)).toBe(5);
  });

  it('tile overlay: wall until flag set, then opens and map updates', () => {
    const run = boot();
    startGame(run);
    const cell = 7 * 16 + 9; // (9,7)
    expect(run.ramAt(MAP_RAM + cell)).toBe(1); // overlay wall (tile idx 1)
    // blocked: walk right from (8,7)
    run.press(Controller.BUTTON_RIGHT); // (8,7)
    run.press(Controller.BUTTON_RIGHT); // into overlay wall
    expect(run.ramAt(S('player_x'))).toBe(8);
    // fire event -> flag set -> overlay reverts to base (empty)
    run.press(Controller.BUTTON_LEFT);
    run.press(Controller.BUTTON_UP); // back to (7,6) fires event... wait, path
    expect(run.ramAt(GAME_FLAGS)).toBe(1);
    run.frames(4); // ovl_drain repaints
    expect(run.ramAt(MAP_RAM + cell)).toBe(0);
    run.press(Controller.BUTTON_DOWN); // (7,7)
    run.press(Controller.BUTTON_RIGHT); // (8,7)
    run.press(Controller.BUTTON_RIGHT); // (9,7): now walkable
    expect(run.ramAt(S('player_x'))).toBe(9);
  });

  it('conditional sprite: absent until flag set, then talks', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_UP); // (7,6) fires once-event -> flag set
    run.press(Controller.BUTTON_UP); // (7,5)
    expect(run.ramAt(S('player_y'))).toBe(5);
    run.press(Controller.BUTTON_UP); // cat at (7,4): dialog, no move
    expect(state(run)).toBe(ST_DIALOG);
    expect(run.ramAt(S('player_y'))).toBe(5);
    closeDialog(run);
  });

  it('conditional sprite: walkable while hidden', () => {
    const run = boot();
    startGame(run);
    // flag clear: cell (7,4) is empty floor
    run.press(Controller.BUTTON_DOWN); // sidestep the once-event cell? no: (7,8)
    run.press(Controller.BUTTON_UP); // back (7,7)
    run.press(Controller.BUTTON_LEFT); // (6,7)
    run.press(Controller.BUTTON_UP); // (6,6)
    run.press(Controller.BUTTON_UP); // (6,5)
    run.press(Controller.BUTTON_UP); // (6,4)
    run.press(Controller.BUTTON_RIGHT); // (7,4): hidden sprite cell
    expect(run.ramAt(S('player_x'))).toBe(7);
    expect(run.ramAt(S('player_y'))).toBe(4);
    expect(state(run)).toBe(ST_WALK);
  });

  it('conditional item: hidden until coin count reaches 2', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_DOWN); // (7,8)
    run.press(Controller.BUTTON_DOWN); // (7,9): hidden item cell, no pickup
    expect(run.ramAt(S('inv_count'))).toBe(0);
    expect(run.ramAt(S('player_y'))).toBe(9);
    run.press(Controller.BUTTON_UP);
    run.press(Controller.BUTTON_UP); // (7,7)
    grabCoins(run);
    // now visible: walk to (7,9) and pick it up
    run.press(Controller.BUTTON_RIGHT); // (5,7)
    run.press(Controller.BUTTON_RIGHT); // (6,7)
    run.press(Controller.BUTTON_RIGHT); // (7,7)
    run.press(Controller.BUTTON_DOWN); // (7,8)
    run.press(Controller.BUTTON_DOWN); // (7,9): pickup
    expect(run.ramAt(S('inv_count'))).toBe(3);
  });

  // the overlay wall sits at (9,7): detour along row 8 to reach the exit
  function walkToExitDoor(run: Runner) {
    run.press(Controller.BUTTON_DOWN); // row 8 (repeat-event cells are only at x=7)
    for (let i = 0; i < 12 && run.ramAt(S('player_x')) < 14; i++)
      run.press(Controller.BUTTON_RIGHT);
    expect(run.ramAt(S('player_x'))).toBe(14);
    run.press(Controller.BUTTON_UP); // (14,7)
    expect(run.ramAt(S('player_y'))).toBe(7);
  }

  it('count-gated exit: locked below 2 coins, opens at 2', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_LEFT);
    run.press(Controller.BUTTON_LEFT); // 1 coin at (5,7)
    expect(run.ramAt(S('inv_count'))).toBe(1);
    walkToExitDoor(run);
    run.press(Controller.BUTTON_RIGHT); // exit at (15,7): locked dialog
    expect(state(run)).toBe(ST_DIALOG);
    expect(run.ramAt(S('cur_room'))).toBe(0);
    closeDialog(run);
    // fetch the second coin (back along row 8)
    run.press(Controller.BUTTON_DOWN);
    for (let i = 0; i < 12 && run.ramAt(S('player_x')) > 4; i++)
      run.press(Controller.BUTTON_LEFT);
    run.press(Controller.BUTTON_UP); // (4,7) coin 2
    expect(run.ramAt(S('inv_count'))).toBe(2);
    walkToExitDoor(run);
    run.press(Controller.BUTTON_RIGHT);
    settle(run);
    expect(run.ramAt(S('cur_room'))).toBe(1);
    expect(run.ramAt(S('player_x'))).toBe(1);
  });

  it('ending shows blinking THE END screen', () => {
    const run = boot();
    startGame(run);
    grabCoins(run);
    walkToExitDoor(run);
    run.press(Controller.BUTTON_RIGHT); // exit
    settle(run);
    expect(run.ramAt(S('cur_room'))).toBe(1);
    run.press(Controller.BUTTON_RIGHT); // (2,7)
    run.press(Controller.BUTTON_RIGHT); // ending at (3,7): dialog
    expect(state(run)).toBe(ST_DIALOG);
    closeDialog(run);
    expect(state(run)).toBe(ST_ENDING);
    settle(run);
    // blink: text row (nt row 14 = px 112..119) alternates white/black
    const litRows = (fb: number[]) => {
      const colors = new Set<number>();
      for (let y = 112; y < 120; y++)
        for (let x = 0; x < 256; x++) colors.add(fb[y * 256 + x]!);
      return colors.size;
    };
    const samples: number[] = [];
    for (let i = 0; i < 4; i++) {
      run.frames(32);
      samples.push(litRows(run.lastFrame()));
    }
    expect(Math.max(...samples)).toBeGreaterThanOrEqual(2); // text visible
    expect(Math.min(...samples)).toBe(1); // text blinked off (all black)
  });
});
