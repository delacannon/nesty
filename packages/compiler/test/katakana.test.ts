import { describe, expect, it } from 'vitest';
import { sampleGame } from '@nesty/core';
import { buildRom } from '../src/index';
import { normalizeKana, encodeDialog, wrapText } from '../src/dialogEncode';
import {
  fontExtChars,
  fontExtChrTiles,
  FONT_BASE_TILE,
  FONT_EXT_BASE_TILE,
  KATAKANA_CHARS,
} from '../src/font';

describe('katakana font', () => {
  it('normalizes hiragana and voiced kana to bank chars', () => {
    expect(normalizeKana('こんにちは')).toBe('コンニチハ');
    expect(normalizeKana('ガンバレ')).toBe('カ゛ンハ゛レ');
    expect(normalizeKana('パン')).toBe('ハ゜ン');
    expect(normalizeKana('ヴ')).toBe('ウ゛');
    expect(normalizeKana('コーヒー！')).toBe('コーヒー!');
    expect(normalizeKana('あ　い')).toBe('ア イ');
  });

  it('every normalized char maps to a katakana bank tile', () => {
    const norm = normalizeKana('ドラゴンヲタベル。「ハィ？」ッュ・、');
    for (const ch of norm) {
      if (ch === ' ' || ch === '?') continue; // ascii bank
      expect(KATAKANA_CHARS.indexOf(ch), `missing glyph for ${ch}`).not.toBe(-1);
    }
  });

  it('encodes kana via the ext bank, ascii via the base bank', () => {
    const bytes = encodeDialog('アA', 'katakana');
    expect(bytes[0]).toBe(FONT_EXT_BASE_TILE + KATAKANA_CHARS.indexOf('ア'));
    expect(bytes[1]).toBe(16 + ('A'.charCodeAt(0) - 32)); // FONT_BASE_TILE
    expect(bytes.at(-1)).toBe(0); // DLG_END
  });

  it('wraps unspaced kana runs by hard-splitting at 28 cols', () => {
    const lines = wrapText('ア'.repeat(60), 'katakana');
    expect(lines[0]!.length).toBe(28);
    expect(lines.join('').length).toBe(60);
  });

  it('bank charset and glyph data stay in sync', () => {
    expect(fontExtChars('katakana')).toBe(KATAKANA_CHARS);
    expect(fontExtChrTiles('katakana').length).toBe(KATAKANA_CHARS.length * 16);
    // even a game using the whole katakana charset must leave room for quads:
    // subset font packs from FONT_BASE_TILE, quads follow, all within 256 tiles
    expect(FONT_BASE_TILE + KATAKANA_CHARS.length).toBeLessThan(256);
  });

  it('builds a ROM with katakana dialogs', () => {
    const game = sampleGame();
    game.font = 'katakana';
    game.dialogs['jp'] = 'ようこそ！ここは　ゲームのせかい。';
    const r = buildRom(game);
    expect(r.ok).toBe(true);
    expect(r.rom).toBeDefined();
  });
});
