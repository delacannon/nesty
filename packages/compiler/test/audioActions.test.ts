import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@nesty/core';
import { defaultGame } from '@nesty/core';
import { buildRom, type BuildResult } from '../src';
import { bootRom, Controller, type Runner } from './helpers';

// engine RAM (see engine.asm)
const MUS_ON = 0x5d; // 0 = off, else song index + 1
const SFX_ON = 0x49; // non-zero while a sfx stream is playing

/**
 * Room 0 (bordered, start 7,7) with events that drive audio via logic:
 *   (6,7) left  -> playSfx custom 'boom'
 *   (7,6) up    -> playSong 'b' (index 1 -> mus_on 2)
 *   (7,8) down  -> playSong stop (mus_on 0)
 */
function audioGame(): GameData {
  const g = defaultGame();
  const b = { ...g.songs[0]!, id: 'b', name: 'song b' };
  g.songs = [g.songs[0]!, b];
  g.customSfx = [
    { id: 'boom', name: 'boom', notes: [{ freq: 200, frames: 12, vol: 8, duty: 1 }] },
  ];
  g.rooms[0]!.events = [
    { x: 6, y: 7, actions: [{ type: 'playSfx', sfxId: 'boom' }] },
    { x: 7, y: 6, actions: [{ type: 'playSong', songId: 'b' }] },
    { x: 7, y: 8, actions: [{ type: 'playSong' }] }, // stop
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

describe('audio logic actions (headless jsnes)', () => {
  beforeAll(() => {
    build = buildRom(audioGame());
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(build.ok).toBe(true);
    sym = build.symbols!;
  });

  it('room song plays at start', () => {
    const run = boot();
    startGame(run);
    expect(run.ramAt(MUS_ON)).toBe(1); // town = song 0 + 1
  });

  it('playSfx action triggers a sound effect', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_LEFT); // (6,7): playSfx boom
    expect(run.ramAt(SFX_ON)).not.toBe(0);
  });

  it('playSong switches the music, and stop silences it', () => {
    const run = boot();
    startGame(run);
    run.press(Controller.BUTTON_UP); // (7,6): playSong 'b' (index 1)
    expect(run.ramAt(MUS_ON)).toBe(2);
    run.press(Controller.BUTTON_DOWN); // back to (7,7)
    run.press(Controller.BUTTON_DOWN); // (7,8): playSong stop
    expect(run.ramAt(MUS_ON)).toBe(0);
  });

  it('typewriter SFX flag is compiled only when enabled and typewriter is on', () => {
    const on = defaultGame();
    on.textSpeed = 'slow';
    on.typewriterSfx = true;
    expect(buildRom(on).asm).toMatch(/tw_sfx:\s*\n\s*\.byte \$01/);

    const instant = defaultGame();
    instant.textSpeed = 'instant'; // typewriter off -> no per-char blip
    instant.typewriterSfx = true;
    expect(buildRom(instant).asm).toMatch(/tw_sfx:\s*\n\s*\.byte \$00/);

    const off = defaultGame();
    off.textSpeed = 'slow';
    expect(buildRom(off).asm).toMatch(/tw_sfx:\s*\n\s*\.byte \$00/);
  });
});
