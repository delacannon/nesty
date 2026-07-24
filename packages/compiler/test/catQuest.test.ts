import { beforeAll, describe, expect, it } from 'vitest';
import { catQuest, parse, serialize, validate } from '@nesty/core';
import { buildRom, type BuildResult } from '../src';
import { bootRom, Controller, type Runner } from './helpers';

const ST_WALK = 1;
const ST_DIALOG = 2;
const ST_ENDING = 3;

let build: BuildResult;
let sym: Map<string, number>;
const S = (n: string) => sym.get(n)!;

function settle(run: Runner) {
  for (let i = 0; i < 120 && run.ramAt(S('in_load')) !== 0; i++) run.frames(1);
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

/** walk a path like 'RRRDD', auto-closing pickup dialogs and settling room loads */
function walk(run: Runner, path: string) {
  for (const c of path) {
    run.press(BTN[c]!);
    settle(run);
    closeDialogs(run);
  }
}

describe("mio's fish quest (full 6-room walkthrough)", () => {
  beforeAll(() => {
    const game = catQuest();
    expect(validate(game).filter((d) => d.severity === 'error')).toEqual([]);
    // round-trips through the text format
    const { game: g2, errors } = parse(serialize(game));
    expect(errors).toEqual([]);
    expect(g2.rooms.length).toBe(6);
    build = buildRom(game);
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('has 6 rooms, 5 items, and fits the ROM budget', () => {
    const g = catQuest();
    expect(g.rooms.length).toBe(6);
    expect(g.items.length).toBe(5);
    expect(g.sprites.length).toBe(6);
    expect(build.report!.prgFree).toBeGreaterThan(0);
  });

  it('can be played from start to THE END', () => {
    const run = bootRom(build.rom!);
    run.frames(10);
    run.press(Controller.BUTTON_START);
    settle(run);
    expect(run.ramAt(S('game_state'))).toBe(ST_WALK);
    expect(run.ramAt(S('cur_room'))).toBe(0); // home

    // home -> garden (east door)
    walk(run, 'RRRRRRRRRR');
    expect(run.ramAt(S('cur_room'))).toBe(1);

    // garden: grab the yarn at (12,10)
    walk(run, 'RRRRRRRRRRR' + 'DDD');
    expect(run.ramAt(S('inv_count'))).toBe(1);

    // garden -> forest (north gap), into the cave mouth at (3,12)
    walk(run, 'UUU' + 'LLLLL' + 'UUUUUUU'); // to (7,0) exit
    expect(run.ramAt(S('cur_room'))).toBe(2); // forest, landed (7,13)
    walk(run, 'LLLL' + 'U'); // to (3,12) cave mouth
    expect(run.ramAt(S('cur_room'))).toBe(5); // cave, landed (7,2)

    // cave: key at (12,11)
    walk(run, 'DDDDDDDDD' + 'RRRRR');
    expect(run.ramAt(S('inv_count'))).toBe(2);

    // cave -> forest -> garden -> village
    walk(run, 'UUUUUUUUUU' + 'LLLLL'); // to ladder (7,1)
    expect(run.ramAt(S('cur_room'))).toBe(2); // forest (3,11)
    walk(run, 'R' + 'DD' + 'RRR' + 'D'); // around cave mouth to (7,14)
    expect(run.ramAt(S('cur_room'))).toBe(1); // garden (7,1)
    walk(run, 'DDDDDD' + 'RRRRRRRR'); // to east gap
    expect(run.ramAt(S('cur_room'))).toBe(3); // village (1,7)

    // village: coin at (3,10), then through the key-locked harbor gate
    walk(run, 'RR' + 'DDD');
    expect(run.ramAt(S('inv_count'))).toBe(3);
    walk(run, 'UUU' + 'RRRRRRRRRRRR');
    expect(run.ramAt(S('cur_room'))).toBe(4); // dock (1,7)

    // dock: coin-gated pier crossing, fish at (14,7)
    walk(run, 'RRRRRRRRR'); // (10,7) ferry -> (12,7)
    expect(run.ramAt(S('player_x'))).toBe(12);
    walk(run, 'RR');
    expect(run.ramAt(S('inv_count'))).toBe(4); // FISH!

    // all the way home
    walk(run, 'LL'); // ferry back -> (9,7)
    walk(run, 'LLLLLLLLL'); // dock -> village
    expect(run.ramAt(S('cur_room'))).toBe(3);
    walk(run, 'LLLLLLLLLLLLLL'); // village -> garden
    expect(run.ramAt(S('cur_room'))).toBe(1);
    walk(run, 'LLLLLLLLLLLLLL'); // garden -> home
    expect(run.ramAt(S('cur_room'))).toBe(0);

    // fireplace ending at (8,3) — unlocked because we hold the fish
    walk(run, 'LLLLLL' + 'UUU');
    walk(run, 'U'); // step onto the ending cell
    closeDialogs(run);
    expect(run.ramAt(S('game_state'))).toBe(ST_ENDING);
  });
});
