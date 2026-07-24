import { beforeAll, describe, expect, it } from 'vitest';
import { helloWorld, parse, serialize, validate } from '@nesty/core';
import { buildRom, type BuildResult } from '../src';
import { bootRom, Controller, type Runner } from './helpers';

const ST_WALK = 1;
const ST_ENDING = 3;
const ST_DIALOG = 2;

const GAME_FLAGS = 0x03a0;
const VAR_VALS = 0x03b0;
const SPR_ANIM_CTL = 0x0460;

let build: BuildResult;
let sym: Map<string, number>;
const S = (n: string) => sym.get(n)!;

function settle(run: Runner) {
  for (let i = 0; i < 200 && run.ramAt(S('in_load')) !== 0; i++) run.frames(1);
  run.frames(2);
}

/**
 * Wait until the engine is back in its main loop: transitions (scroll, fade,
 * curtain...) run blocking and ignore input, but only the main loop samples
 * the controller — so hold SELECT (a no-op button) until it shows up in the
 * engine's pad byte.
 */
function waitIdle(run: Runner) {
  run.nes.buttonDown(1, Controller.BUTTON_SELECT);
  for (let i = 0; i < 600; i++) {
    run.frames(1);
    if ((run.ramAt(S('pad')) & 0x20) !== 0) break; // BTN_SELECT
  }
  run.nes.buttonUp(1, Controller.BUTTON_SELECT);
  run.frames(2);
}

function closeDialogs(run: Runner) {
  for (let i = 0; i < 40 && run.ramAt(S('game_state')) === ST_DIALOG; i++) {
    run.frames(30);
    run.press(Controller.BUTTON_A);
  }
}

const BTN: Record<string, number> = {
  U: Controller.BUTTON_UP,
  D: Controller.BUTTON_DOWN,
  L: Controller.BUTTON_LEFT,
  R: Controller.BUTTON_RIGHT,
};

/**
 * Walk a path like 'RRRDD', auto-closing dialogs and settling room loads.
 * Presses during a room transition are swallowed by the engine (it is busy
 * animating), so each step retries until the player position or room changes.
 */
function walk(run: Runner, path: string) {
  const pos = () =>
    [
      run.ramAt(S('player_x')),
      run.ramAt(S('player_y')),
      run.ramAt(S('cur_room')),
    ].join(',');
  for (const c of path) {
    const before = pos();
    for (let t = 0; t < 40; t++) {
      run.press(BTN[c]!);
      waitIdle(run);
      settle(run);
      closeDialogs(run);
      if (pos() !== before) break;
      run.frames(10);
    }
    waitIdle(run); // let any transition this step kicked off finish
  }
}

describe('hello world quest (full 5-room walkthrough)', () => {
  beforeAll(() => {
    const game = helloWorld();
    expect(validate(game).filter((d) => d.severity === 'error')).toEqual([]);
    // round-trips through the text format
    const { game: g2, errors } = parse(serialize(game));
    expect(errors).toEqual([]);
    expect(g2.rooms.length).toBe(5);
    build = buildRom(game);
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('uses every logic feature and fits the ROM budget', () => {
    const g = helloWorld();
    expect(g.rooms.length).toBe(5);
    expect(g.flags.length).toBe(1);
    expect(g.variables.length).toBe(1);
    expect(g.rooms.flatMap((r) => r.events).length).toBe(5);
    expect(g.rooms.flatMap((r) => r.overlays).length).toBe(3);
    expect(g.sprites.some((s) => s.appearCond)).toBe(true);
    expect(g.rooms.some((r) => r.items.some((ip) => ip.appearCond))).toBe(true);
    const transitions = new Set(
      g.rooms.flatMap((r) => r.exits.map((e) => e.transition)),
    );
    for (const t of ['scroll', 'fade', 'diag', 'curtain', 'blinds'])
      expect(transitions.has(t as never)).toBe(true);
    expect(g.songs.length).toBe(3);
    expect(build.report!.prgFree).toBeGreaterThan(0);
  });

  it('can be played from start to THE END', () => {
    const run = bootRom(build.rom!);
    run.frames(10);
    run.press(Controller.BUTTON_START);
    settle(run);
    expect(run.ramAt(S('game_state'))).toBe(ST_WALK);
    expect(run.ramAt(S('cur_room'))).toBe(0); // village

    // village: old bone at (3,10)
    walk(run, 'LLLL');
    expect(run.ramAt(S('inv_count'))).toBe(1);

    // sunherb 1 of 3 tucked in the village square at (11,11)
    walk(run, 'RRRRRRRR' + 'D');
    expect(run.ramAt(S('inv_count'))).toBe(2);
    expect(run.ramAt(S('player_x'))).toBe(11);
    expect(run.ramAt(S('player_y'))).toBe(11);

    // east road out of the village to the meadow
    walk(run, 'UUUU' + 'RRRR');
    expect(run.ramAt(S('cur_room'))).toBe(1); // meadow (1,7)

    // welcome event plate at (2,7) fires once
    walk(run, 'R');

    // sunherb 2 of 3: the lone meadow herb at (3,4)
    walk(run, 'R' + 'UUU');
    expect(run.ramAt(S('inv_count'))).toBe(3);

    // down and across to the north gap, then up to the wolf cave
    walk(run, 'DDD' + 'RRRR' + 'UUUUUUU');
    expect(run.ramAt(S('cur_room'))).toBe(2); // cave (7,13)

    // bone event at (7,9) tames the wolf; the sealed chamber is the only way up
    walk(run, 'UUUU');
    expect(run.ramAt(GAME_FLAGS)).toBe(1); // flag t set
    // straight through where the wolf sat: sunherb 3 at (7,4), then key at (7,2)
    walk(run, 'UUUUUUU');
    expect(run.ramAt(S('inv_count'))).toBe(5); // herb + key
    expect(run.ramAt(S('player_y'))).toBe(2);

    // back down through the cleared corridor to the meadow
    walk(run, 'DDDDDDDDDDD' + 'D');
    expect(run.ramAt(S('cur_room'))).toBe(1); // meadow (7,1)
    walk(run, 'DDDDDD' + 'RRRRRRRR');
    expect(run.ramAt(S('cur_room'))).toBe(3); // river (1,7)

    // cross the fairy's bridge of light (overlay: 3 sunherbs held)
    walk(run, 'RRRRRRRRR');
    expect(run.ramAt(S('player_x'))).toBe(10); // across the water

    // river gem appears because the wolf was tamed
    walk(run, 'RR' + 'DDD');
    expect(run.ramAt(S('inv_count'))).toBe(6);

    // east to the castle
    walk(run, 'UUU' + 'RRR');
    expect(run.ramAt(S('cur_room'))).toBe(4); // castle (1,7)

    // rune plates south of the gate: HELLO + WORLD
    walk(run, 'RRR' + 'D');
    expect(run.ramAt(VAR_VALS)).toBe(1);
    walk(run, 'RRRRRRR');
    expect(run.ramAt(VAR_VALS)).toBe(2);

    // through the key-unsealed gate arch to the throne
    walk(run, 'U' + 'LLLL' + 'UU');
    expect(run.ramAt(S('player_y'))).toBe(5); // standing in the arch
    walk(run, 'U'); // (7,4): the king rises (anim hold f1)
    expect(run.ramAt(SPR_ANIM_CTL + 4)).toBe(2); // king def idx 4, mode f1

    // speak the Greeting
    walk(run, 'U');
    closeDialogs(run);
    expect(run.ramAt(S('game_state'))).toBe(ST_ENDING);
  });
});
