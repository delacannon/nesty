import { describe, expect, it } from 'vitest';
import { blankSplash, parse, sampleGame, serialize } from '@nesty/core';
import { buildRom } from '../src/index';
import { bootRom, Controller, distinctColors } from './helpers';

describe('splash screen', () => {
  it('builds a ROM with a splash screen and emits its tables', () => {
    const game = sampleGame();
    const tileId = game.tiles[0]!.id;
    game.splash = blankSplash(game.palettes[0]!.id);
    game.splash.tiles[0] = tileId;
    game.splash.tiles[223] = tileId;
    game.splash.pmap[223] = 2;
    const r = buildRom(game);
    expect(r.ok).toBe(true);
    expect(r.asm).toContain('has_splash');
    expect(r.asm).toContain('splash_nt');
  });

  it('builds without a splash (empty label path)', () => {
    const r = buildRom(sampleGame());
    expect(r.ok).toBe(true);
    expect(r.asm).toContain('has_splash');
  });

  it('round-trips through serialize/parse', () => {
    const game = sampleGame();
    const tileId = game.tiles[0]!.id;
    game.splash = blankSplash(game.palettes[0]!.id);
    game.splash.tiles[17] = tileId;
    game.splash.pmap[17] = 3;
    const { game: g2, errors } = parse(serialize(game));
    expect(errors).toEqual([]);
    expect(g2.splash?.tiles[17]).toBe(tileId);
    expect(g2.splash?.pmap[17]).toBe(3);
    expect(g2.splash?.palId).toBe(game.palettes[0]!.id);
  });

  it('boots to the splash and starts the game on START', () => {
    const game = sampleGame();
    const tileId = game.tiles[0]!.id;
    game.splash = blankSplash(game.palettes[0]!.id);
    for (let i = 0; i < 224; i++) game.splash.tiles[i] = tileId;
    const rom = buildRom(game).rom!;
    const r = bootRom(rom);
    r.frames(10);
    // splash fills the screen with a real tile → more than a bare text title
    expect(distinctColors(r.lastFrame())).toBeGreaterThan(1);
    r.press(Controller.BUTTON_START, 2);
    r.frames(10);
    // walk state reached: pressing d-pad doesn't crash and frame still renders
    r.press(Controller.BUTTON_RIGHT, 2);
    r.frames(5);
    expect(distinctColors(r.lastFrame())).toBeGreaterThan(1);
  });

  it('all-empty splash serializes as absent', () => {
    const game = sampleGame();
    game.splash = blankSplash();
    expect(serialize(game)).not.toContain('SPLASH');
  });
});
