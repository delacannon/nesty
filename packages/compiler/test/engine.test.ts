import { beforeAll, describe, expect, it } from 'vitest';
import { buildRom, type BuildResult } from '../src';
import { bootRom, distinctColors, Controller, type Runner } from './helpers';
import { sampleGame } from './sampleGame';

// engine zero-page addresses (from asm symbol table)
let sym: Map<string, number>;
let build: BuildResult;

const ST_TITLE = 0;
const ST_WALK = 1;
const ST_DIALOG = 2;
const ST_ENDING = 3;

function boot(): Runner {
  const run = bootRom(build.rom!);
  run.frames(10); // reset + title draw
  return run;
}

const S = (name: string) => {
  const v = sym.get(name);
  if (v === undefined) throw new Error(`symbol ${name} missing`);
  return v;
};

function state(run: Runner) {
  return run.ramAt(S('game_state'));
}

function closeDialog(run: Runner) {
  // let box+typewriter finish, then page/close with A until back to walk/ending
  for (let i = 0; i < 30 && state(run) === ST_DIALOG; i++) {
    run.frames(30);
    run.press(Controller.BUTTON_A);
  }
}

function settle(run: Runner) {
  // room loads span several frames (rendering off); wait for in_load to clear
  for (let i = 0; i < 120 && run.ramAt(S('in_load')) !== 0; i++) run.frames(1);
  run.frames(2);
}

function startGame(run: Runner) {
  run.press(Controller.BUTTON_START);
  settle(run);
}

describe('engine e2e (headless jsnes)', () => {
  beforeAll(() => {
    build = buildRom(sampleGame());
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('boots to title and renders pixels', () => {
    const run = boot();
    run.frames(30);
    expect(state(run)).toBe(ST_TITLE);
    expect(distinctColors(run.lastFrame())).toBeGreaterThanOrEqual(2);
  });

  it('start button enters walk state at start position', () => {
    const run = boot();
    startGame(run);
    expect(state(run)).toBe(ST_WALK);
    expect(run.ramAt(S('cur_room'))).toBe(0);
    expect(run.ramAt(S('player_x'))).toBe(7);
    expect(run.ramAt(S('player_y'))).toBe(7);
  });

  it('walks and collides with walls', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_DOWN);
    expect(run.ramAt(S('player_y'))).toBe(8);
    // walk down into the bottom wall: y stops at 13 (row 14 is wall)
    for (let i = 0; i < 10; i++) run.press(Controller.BUTTON_DOWN);
    expect(run.ramAt(S('player_y'))).toBe(13);
    // walk left into the wall: x stops at 1
    for (let i = 0; i < 10; i++) run.press(Controller.BUTTON_LEFT);
    expect(run.ramAt(S('player_x'))).toBe(1);
  });

  it('talking to a sprite opens and closes dialog', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_UP); // (7,6)
    expect(run.ramAt(S('player_y'))).toBe(6);
    run.press(Controller.BUTTON_UP); // cat at (7,5): dialog, no move
    expect(state(run)).toBe(ST_DIALOG);
    expect(run.ramAt(S('player_y'))).toBe(6);
    closeDialog(run);
    expect(state(run)).toBe(ST_WALK);
  });

  it('picks up an item: moves onto it, sets inventory, shows dialog once', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_LEFT); // (6,7)
    run.press(Controller.BUTTON_LEFT); // key at (5,7)
    expect(state(run)).toBe(ST_DIALOG);
    expect(run.ramAt(S('player_x'))).toBe(5);
    expect(run.ramAt(S('inv_count'))).toBe(1);
    closeDialog(run);
    // walk off and back on: no second pickup
    run.press(Controller.BUTTON_RIGHT);
    run.press(Controller.BUTTON_LEFT);
    expect(state(run)).toBe(ST_WALK);
    expect(run.ramAt(S('inv_count'))).toBe(1);
  });

  function grabKey(run: Runner) {
    run.press(Controller.BUTTON_LEFT); // (6,7)
    run.press(Controller.BUTTON_LEFT); // key at (5,7)
    closeDialog(run);
    expect(run.ramAt(S('inv_count'))).toBe(1);
  }

  it('conditional exit: locked without the key, shows the locked dialog', () => {
    const run = boot();
    startGame(run);
    for (let i = 0; i < 7; i++) run.press(Controller.BUTTON_RIGHT); // to (14,7)
    expect(run.ramAt(S('player_x'))).toBe(14);
    run.press(Controller.BUTTON_RIGHT); // locked exit at (15,7)
    expect(state(run)).toBe(ST_DIALOG); // "the east door is locked"
    expect(run.ramAt(S('cur_room'))).toBe(0);
    expect(run.ramAt(S('player_x'))).toBe(14);
    closeDialog(run);
    expect(state(run)).toBe(ST_WALK);
  });

  it('conditional sprite dialog: cat says the alt line once you hold the key', () => {
    const run = boot();
    startGame(run);
    // talk without key -> base dialog index
    run.press(Controller.BUTTON_UP);
    run.press(Controller.BUTTON_UP);
    expect(state(run)).toBe(ST_DIALOG);
    const baseDlg = run.ramAt(S('cur_dlg'));
    closeDialog(run);
    run.press(Controller.BUTTON_DOWN); // back to (7,7)
    grabKey(run);
    // back to the cat
    run.press(Controller.BUTTON_RIGHT);
    run.press(Controller.BUTTON_RIGHT); // (7,7)
    run.press(Controller.BUTTON_UP);
    run.press(Controller.BUTTON_UP);
    expect(state(run)).toBe(ST_DIALOG);
    expect(run.ramAt(S('cur_dlg'))).not.toBe(baseDlg);
    closeDialog(run);
  });

  it('exit teleports to the destination room (with key)', () => {
    const run = boot();
    startGame(run);
    grabKey(run);
    for (let i = 0; i < 9; i++) run.press(Controller.BUTTON_RIGHT); // to (14,7)
    expect(run.ramAt(S('player_x'))).toBe(14);
    run.press(Controller.BUTTON_RIGHT); // exit at (15,7)
    settle(run);
    expect(run.ramAt(S('cur_room'))).toBe(1);
    expect(run.ramAt(S('player_x'))).toBe(1);
    expect(run.ramAt(S('player_y'))).toBe(7);
  });

  it('ending locks the game after its dialog', () => {
    const run = boot();
    startGame(run);
    grabKey(run);
    for (let i = 0; i < 10; i++) run.press(Controller.BUTTON_RIGHT); // through exit
    settle(run);
    expect(run.ramAt(S('cur_room'))).toBe(1);
    run.frames(20); // wait out d-pad release guard
    run.press(Controller.BUTTON_RIGHT); // (2,7)
    expect(run.ramAt(S('player_x'))).toBe(2);
    run.press(Controller.BUTTON_RIGHT); // ending at (3,7)
    expect(state(run)).toBe(ST_DIALOG);
    closeDialog(run);
    expect(state(run)).toBe(ST_ENDING);
    // input is dead now
    run.press(Controller.BUTTON_LEFT);
    expect(run.ramAt(S('player_x'))).toBe(3);
  });

  it('sound effects trigger on walk and pickup', () => {
    const run = boot();
    startGame(run);
    run.nes.buttonDown(1, Controller.BUTTON_DOWN);
    run.frames(2); // walk sfx plays right after the move
    expect(run.ramAt(S('sfx_on'))).toBe(1);
    run.nes.buttonUp(1, Controller.BUTTON_DOWN);
    run.frames(20); // walk blip is 2 frames; should be silent again
    expect(run.ramAt(S('sfx_on'))).toBe(0);
    run.press(Controller.BUTTON_UP);
    run.press(Controller.BUTTON_LEFT);
    run.press(Controller.BUTTON_LEFT); // pickup at (5,7) — longer arpeggio
    expect(run.ramAt(S('inv_count'))).toBe(1);
    expect(run.ramAt(S('sfx_on'))).toBe(1);
  });

  it('smooth movement: grid snaps at once but the avatar tweens between tiles', () => {
    const g = sampleGame();
    g.smoothMove = true;
    g.moveSpeed = 4; // 16px cell / 4 = 4 frames per tile
    g.moveCont = true; // glide continuously while a direction is held
    const sbuild = buildRom(g);
    expect(sbuild.ok).toBe(true);
    const ssym = sbuild.symbols!;
    const SS = (name: string) => {
      const v = ssym.get(name);
      if (v === undefined) throw new Error(`symbol ${name} missing`);
      return v;
    };
    const run = bootRom(sbuild.rom!);
    run.frames(10);
    run.nes.buttonDown(1, Controller.BUTTON_START);
    run.frames(2);
    run.nes.buttonUp(1, Controller.BUTTON_START);
    for (let i = 0; i < 120 && run.ramAt(SS('in_load')) !== 0; i++)
      run.frames(1);
    run.frames(2);
    expect(run.ramAt(SS('smooth_on'))).toBe(1);
    expect(run.ramAt(SS('player_y'))).toBe(7);

    // begin a downward step: the grid cell advances immediately, and a
    // vertical slide offset is seeded so the sprite starts at the old cell
    run.nes.buttonDown(1, Controller.BUTTON_DOWN);
    run.frames(2);
    expect(run.ramAt(SS('player_y'))).toBe(8); // logic already on the new tile
    expect(run.ramAt(SS('slide_y'))).not.toBe(0); // still mid-tween
    run.nes.buttonUp(1, Controller.BUTTON_DOWN);

    // the tween drains to exactly zero — the avatar lands on-grid
    run.frames(10);
    expect(run.ramAt(SS('slide_y'))).toBe(0);
    expect(run.ramAt(SS('player_y'))).toBe(8);

    // hold the direction: the avatar keeps gliding across tiles with no per-tile
    // stop. At 4px/frame a tile takes 4 frames, so ~16 frames covers ~4 tiles
    // (until it reaches the bottom wall at y=13).
    run.nes.buttonDown(1, Controller.BUTTON_DOWN);
    run.frames(20);
    expect(run.ramAt(SS('player_y'))).toBe(13); // slid all the way to the wall
    run.nes.buttonUp(1, Controller.BUTTON_DOWN);
    run.frames(6);
    expect(run.ramAt(SS('slide_y'))).toBe(0); // settled on-grid on release
    expect(run.ramAt(SS('player_y'))).toBe(13);
    expect(run.ramAt(SS('player_dir'))).toBe(0); // DIR_DOWN

    // facing tracks the last direction pressed (drives directional sprites)
    run.nes.buttonDown(1, Controller.BUTTON_LEFT);
    run.frames(2);
    run.nes.buttonUp(1, Controller.BUTTON_LEFT);
    run.frames(6);
    expect(run.ramAt(SS('player_dir'))).toBe(2); // DIR_LEFT
  });

  it('tile animation flips anim_frame over time', () => {
    const run = boot();
    startGame(run);
    const before = run.ramAt(S('anim_frame'));
    run.frames(40);
    expect(run.ramAt(S('anim_frame'))).toBe(before ^ 1);
  });
});
