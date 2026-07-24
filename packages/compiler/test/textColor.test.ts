import { describe, expect, it } from 'vitest';
import { blankRoom, defaultGame } from '@nesty/core';
import { buildRom } from '../src/index';
import {
  DLG_BLINK,
  DLG_CYCLE,
  encodeDialog,
  parseDialogMarkup,
  wrapText,
  wrapTextRich,
} from '../src/dialogEncode';
import { chrgen } from '../src/chrgen';
import { bootRom, Controller } from './helpers';

describe('dialog color markup', () => {
  it('parses [col1] and [cycle] spans', () => {
    const { clean, marks } = parseDialogMarkup('Hi [col1]World[/col1] [cycle]go[/cycle]');
    expect(clean).toBe('Hi World go');
    expect(marks.slice(0, 3)).toEqual([0, 0, 0]);
    expect(marks.slice(3, 8)).toEqual([1, 1, 1, 1, 1]); // World
    expect(marks.slice(9, 11)).toEqual([2, 2]); // go
  });

  it('keeps unknown tags literal and survives unclosed tags', () => {
    expect(parseDialogMarkup('a [xyz] c').clean).toBe('a [xyz] c');
    const r = parseDialogMarkup('x [col1]rest');
    expect(r.clean).toBe('x rest');
    expect(r.marks.at(-1)).toBe(1);
  });

  it('marks survive word wrap', () => {
    const lines = wrapTextRich('aaaa [col1]bbbb[/col1] cccc');
    expect(lines[0]!.text).toBe('AAAA BBBB CCCC');
    expect(lines[0]!.marks[5]).toBe(1);
    expect(lines[0]!.marks[8]).toBe(1);
    expect(lines[0]!.marks[10]).toBe(0);
  });

  it('wrapText strips markup', () => {
    expect(wrapText('Hello [col1]World[/col1]')).toEqual(['HELLO WORLD']);
  });

  it('encodes colored chars via the color tile maps + cycle prefix', () => {
    const colorTiles = new Map([['W', 200]]);
    const bytes = encodeDialog('[cycle]W[/cycle]', 'classic', undefined, colorTiles);
    expect(bytes[0]).toBe(DLG_CYCLE);
    expect(bytes[1]).toBe(200);
    expect(bytes.at(-1)).toBe(0);
  });

  it('no cycle prefix for plain or col1-only dialogs', () => {
    expect(encodeDialog('[col1]HI[/col1]')[0]).not.toBe(DLG_CYCLE);
    expect(encodeDialog('HI')[0]).not.toBe(DLG_CYCLE);
  });

  it('parses [blink] and emits its marker (cycle wins when mixed)', () => {
    expect(parseDialogMarkup('[blink]GO[/blink]').marks[0]).toBe(4); // FX_BLINK
    expect(encodeDialog('[blink]GO[/blink]')[0]).toBe(DLG_BLINK);
    const mixed = encodeDialog('[blink]A[/blink] [cycle]B[/cycle]');
    expect(mixed[0]).toBe(DLG_BLINK);
    expect(mixed[1]).toBe(DLG_CYCLE); // read last → engine keeps cycle mode
  });

  it('effects accumulate in any nesting order, with short aliases', () => {
    const a = parseDialogMarkup('[cycle][wave]SEA[/wave][/cycle]');
    expect(a.clean).toBe('SEA');
    expect(a.marks[0]).toBe(2 | 8); // FX_CYCLE | FX_WAVE
    const b = parseDialogMarkup('[w][c]SEA[/c][/w]'); // aliases, other order
    expect(b.marks).toEqual(a.marks);
    const c = parseDialogMarkup('[b]x[w]y[/b]z[/w]'); // overlap, not nested
    expect(c.marks).toEqual([4, 4 | 8, 8]);
  });

  it('wave+cycle chars use highlight-ink wave pairs and arm cycling', () => {
    const game = defaultGame();
    game.dialogs['d'] = '[c][w]SEA[/w][/c]';
    const chr = chrgen(game);
    expect(chr.wavyColorTiles.has('S')).toBe(true);
    expect(chr.wavyTiles.has('S')).toBe(false);
    const base = chr.wavyColorTiles.get('S')!;
    expect(base & 1).toBe(0);
    expect(base).toBeGreaterThanOrEqual(chr.waveFirst);
    expect(base + 2).toBeLessThanOrEqual(chr.waveEnd);
    // highlight ink: no color-3 pixels in either pair tile
    for (const idx of [base, base + 1]) {
      const t = chr.chr.subarray(idx * 16, idx * 16 + 16);
      for (let y = 0; y < 8; y++) expect(t[y]! & t[y + 8]!).toBe(0);
    }
    const bytes = encodeDialog(
      game.dialogs['d']!,
      'classic',
      chr.line2Tiles,
      chr.colorTiles,
      chr.colorLine2Tiles,
      chr.wavyTiles,
      chr.wavyColorTiles,
    );
    expect(bytes[0]).toBe(DLG_CYCLE);
    expect(bytes[1]).toBe(base); // S
  });

  it('[wave] chars get contiguous even-aligned tile pairs', () => {
    const game = defaultGame();
    game.dialogs['d'] = '[wave]AB[/wave]';
    const chr = chrgen(game);
    expect(chr.waveEnd - chr.waveFirst).toBe(4); // 2 chars × 2 tiles
    for (const ch of ['A', 'B']) {
      const base = chr.wavyTiles.get(ch)!;
      expect(base & 1).toBe(0); // even pair base
      expect(base).toBeGreaterThanOrEqual(chr.waveFirst);
      // +1 tile is the 1px-down copy: plane1 shifted, fill intact
      const t0 = chr.chr.subarray(base * 16, base * 16 + 16);
      const t1 = chr.chr.subarray((base + 1) * 16, (base + 1) * 16 + 16);
      for (let y = 1; y < 8; y++) expect(t1[8 + y]).toBe(t0[8 + y - 1]);
    }
  });

  it('a wavy dialog registers its cells and keeps animating', () => {
    const game = defaultGame();
    const r0 = blankRoom('0', game.palettes[0]!.id);
    game.rooms = [r0];
    game.dialogs['d'] = 'THE [wave]SEA[/wave] MOVES';
    game.sprites.push({
      id: 's',
      name: 'npc',
      frames: [game.avatar.frames[0]!],
      sprPal: 0,
      room: '0',
      x: 8,
      y: 7,
      dlgId: 'd',
    });
    game.startX = 6;
    game.startY = 7;
    const r = bootRom(buildRom(game).rom!);
    r.frames(10);
    r.press(Controller.BUTTON_START, 2);
    r.frames(5);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(40); // type out
    expect(r.ramAt(0x00)).toBe(2); // dialog open
    expect(r.ramAt(0x53)).toBe(3); // wave_n = S,E,A cells registered
    const phase0 = r.ramAt(0x54);
    r.frames(32);
    expect(r.ramAt(0x54)).not.toBe(phase0); // animator running
    r.press(Controller.BUTTON_A, 2);
    r.frames(20);
    expect(r.ramAt(0x00)).toBe(1); // closes clean
  });

  it('wave+cycle in one word: engine registers wave cells and cycles', () => {
    const game = defaultGame();
    const r0 = blankRoom('0', game.palettes[0]!.id);
    game.rooms = [r0];
    game.dialogs['d'] = 'THE [c][w]SEA[/w][/c] GLOWS';
    game.sprites.push({
      id: 's',
      name: 'npc',
      frames: [game.avatar.frames[0]!],
      sprPal: 0,
      room: '0',
      x: 8,
      y: 7,
      dlgId: 'd',
    });
    game.startX = 6;
    game.startY = 7;
    const r = bootRom(buildRom(game).rom!);
    r.frames(10);
    r.press(Controller.BUTTON_START, 2);
    r.frames(5);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(40);
    expect(r.ramAt(0x00)).toBe(2); // dialog open
    expect(r.ramAt(0x52)).toBe(1); // cycle armed
    expect(r.ramAt(0x53)).toBe(3); // S,E,A wave cells registered
    r.frames(64);
    r.press(Controller.BUTTON_A, 2);
    r.frames(20);
    expect(r.ramAt(0x00)).toBe(1);
  });

  it('a blinking dialog arms blink mode in the engine', () => {
    const game = defaultGame();
    const r0 = blankRoom('0', game.palettes[0]!.id);
    game.rooms = [r0];
    game.dialogs['d'] = 'PRESS THE [blink]BUTTON[/blink] NOW';
    game.sprites.push({
      id: 's',
      name: 'npc',
      frames: [game.avatar.frames[0]!],
      sprPal: 0,
      room: '0',
      x: 8,
      y: 7,
      dlgId: 'd',
    });
    game.startX = 6;
    game.startY = 7;
    const r = bootRom(buildRom(game).rom!);
    r.frames(10);
    r.press(Controller.BUTTON_START, 2);
    r.frames(5);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(30);
    expect(r.ramAt(0x00)).toBe(2); // dialog open
    expect(r.ramAt(0x52)).toBe(2); // dlg_cycle = blink mode
    r.frames(64); // a few blink periods, no hang
    r.press(Controller.BUTTON_A, 2);
    r.frames(20);
    expect(r.ramAt(0x00)).toBe(1);
  });

  it('chrgen allocates color variant tiles with ink on color 2', () => {
    const game = defaultGame();
    game.dialogs['d'] = '[col1]A[/col1]';
    const chr = chrgen(game);
    expect(chr.colorTiles.has('A')).toBe(true);
    const idx = chr.colorTiles.get('A')!;
    const tile = chr.chr.subarray(idx * 16, idx * 16 + 16);
    for (let y = 0; y < 8; y++) {
      expect(tile[y]! & tile[y + 8]!).toBe(0); // no color-3 pixels
      expect(tile[y]! | tile[y + 8]!).toBe(0xff); // opaque box fill preserved
    }
  });

  it('a game with colored + cycling dialog boots and opens the dialog', () => {
    const game = defaultGame();
    const r0 = blankRoom('0', game.palettes[0]!.id);
    game.rooms = [r0];
    game.dialogs['d'] = 'SEE THE [col1]RED[/col1] [cycle]KEY[/cycle] NOW';
    game.sprites.push({
      id: 's',
      name: 'npc',
      frames: [game.avatar.frames[0]!],
      sprPal: 0,
      room: '0',
      x: 8,
      y: 7,
      dlgId: 'd',
    });
    game.startX = 6;
    game.startY = 7;
    const rom = buildRom(game).rom!;
    const r = bootRom(rom);
    r.frames(10);
    r.press(Controller.BUTTON_START, 2);
    r.frames(5);
    r.press(Controller.BUTTON_RIGHT, 4); // bump into npc → talk
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(30);
    expect(r.ramAt(0x00)).toBe(2); // game_state = dialog
    expect(r.ramAt(0x52)).toBe(1); // dlg_cycle armed by the stream marker
    r.frames(40); // cycle palette writes happen without hanging
    r.press(Controller.BUTTON_A, 2);
    r.frames(20);
    expect(r.ramAt(0x00)).toBe(1); // back to walk
  });
});
