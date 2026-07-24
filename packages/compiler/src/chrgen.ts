/**
 * Pixel art → 8KB CHR-ROM with 8×8-tile deduplication.
 * BG bank ($0000): blank, dialog box pieces, arrow, font, then tile quads.
 * Sprite bank ($1000): avatar / sprite / item quads.
 */
import type { Frame16, GameData } from '@nesty/core';
import { overlayRefKey } from '@nesty/core';
import {
  fontChrTiles,
  fontExtChars,
  fontExtChrTiles,
  FONT_BASE_TILE,
} from './font';
import {
  collectFontChars,
  FX_COLOR_MASK,
  FX_WAVE,
  wrapTextRich,
} from './dialogEncode';
import {
  SPR_QUAD_BASE,
  SPR_TILE_ARROW,
  TILE_ARROW,
  TILE_BOX_BASE,
} from './layout';

export type Quad = [number, number, number, number]; // TL TR BL BR CHR indices

export interface ChrResult {
  chr: Uint8Array; // 8192 bytes
  /** char (glyphKey) -> compacted CHR slot; only rendered glyphs are placed */
  fontSlots: Map<string, number>;
  /** tileId -> [frame0 quad, frame1 quad] (frame1 = frame0 when static) */
  bgQuads: Map<string, [Quad, Quad]>;
  /** 'AVA' | sprite id | item id -> quads (items prefixed 'itm:') */
  sprQuads: Map<string, [Quad, Quad]>;
  /** char -> CHR tile of its 1px-shifted copy, for dialog line 2 */
  line2Tiles: Map<string, number>;
  /** char -> CHR tile drawn in color 2 (dialog highlight), line 1 / line 2 */
  colorTiles: Map<string, number>;
  colorLine2Tiles: Map<string, number>;
  /** char -> even base tile of its wave pair (base = normal, +1 = 1px down) */
  wavyTiles: Map<string, number>;
  /** wave + color effect: pair with highlight-color ink */
  wavyColorTiles: Map<string, number>;
  /** [waveFirst, waveEnd) tile range — engine spots wavy cells by index */
  waveFirst: number;
  waveEnd: number;
  bgTilesUsed: number;
  /** background CHR split: font/UI reserved · dialog glyph variants · tile art */
  bgFontTiles: number;
  bgDialogTiles: number;
  bgTileTiles: number;
  sprTilesUsed: number;
  diagnostics: string[];
}

/** Extract one 8×8 quadrant (q: 0 TL, 1 TR, 2 BL, 3 BR) as 16 CHR bytes. */
function quadrantToChr(frame: Frame16, q: number): Uint8Array {
  const ox = (q & 1) * 8;
  const oy = (q >> 1) * 8;
  const tile = new Uint8Array(16);
  for (let y = 0; y < 8; y++) {
    let p0 = 0;
    let p1 = 0;
    for (let x = 0; x < 8; x++) {
      const px = frame[(oy + y) * 16 + (ox + x)]!;
      if (px & 1) p0 |= 0x80 >> x;
      if (px & 2) p1 |= 0x80 >> x;
    }
    tile[y] = p0;
    tile[y + 8] = p1;
  }
  return tile;
}

function tileKey(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++)
    s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}

class Bank {
  private map = new Map<string, number>();
  next: number;
  constructor(
    private chr: Uint8Array,
    private base: number, // byte offset of tile 0 of this bank
    firstFree: number,
    private limit: number, // exclusive tile index limit
    private name: string,
    private diagnostics: string[],
  ) {
    this.next = firstFree;
  }

  /** Reserve a fixed tile slot (no dedupe). */
  place(index: number, bytes: Uint8Array): void {
    this.chr.set(bytes, this.base + index * 16);
    this.map.set(tileKey(bytes), index);
  }

  alloc(bytes: Uint8Array): number {
    const key = tileKey(bytes);
    const hit = this.map.get(key);
    if (hit !== undefined) return hit;
    if (this.next >= this.limit) {
      this.diagnostics.push(
        `${this.name} CHR bank overflow (limit ${this.limit} tiles)`,
      );
      return 0;
    }
    const idx = this.next++;
    this.chr.set(bytes, this.base + idx * 16);
    this.map.set(key, idx);
    return idx;
  }

  /** Two consecutive tiles at an even index (no dedupe) — for wave pairs. */
  allocPair(a: Uint8Array, b: Uint8Array): number {
    if (this.next & 1) this.next++;
    if (this.next + 2 > this.limit) {
      this.diagnostics.push(
        `${this.name} CHR bank overflow (limit ${this.limit} tiles)`,
      );
      return 0;
    }
    const idx = this.next;
    this.chr.set(a, this.base + idx * 16);
    this.chr.set(b, this.base + (idx + 1) * 16);
    this.next += 2;
    return idx;
  }
}

function framesToQuads(frames: Frame16[], bank: Bank): [Quad, Quad] {
  const q0 = [0, 1, 2, 3].map((q) =>
    bank.alloc(quadrantToChr(frames[0]!, q)),
  ) as Quad;
  const q1 =
    frames.length > 1
      ? ([0, 1, 2, 3].map((q) =>
          bank.alloc(quadrantToChr(frames[1]!, q)),
        ) as Quad)
      : q0; // static: frame 1 reuses frame 0 slots for free
  return [q0, q1];
}

/**
 * Dialog box pieces: solid color-1 fill with color-3 border lines,
 * so the box is opaque like an RPG dialog panel.
 */
function boxPieces(): Uint8Array[] {
  const line = 0xff;
  const mk = (
    rows: number[],
    vertBit: 'left' | 'right' | 'none',
    full = false,
  ): Uint8Array => {
    const t = new Uint8Array(16);
    for (let y = 0; y < 8; y++) {
      let bits = rows.includes(y) || full ? line : 0;
      if (vertBit === 'left') bits |= 0xc0;
      if (vertBit === 'right') bits |= 0x03;
      t[y] = 0xff; // plane 0: filled interior (color 1)
      t[y + 8] = bits; // plane 1: border lines become color 3
    }
    return t;
  };
  const TL = mk([0, 1], 'left');
  const T = mk([0, 1], 'none');
  const TR = mk([0, 1], 'right');
  const L = mk([], 'left');
  const C = mk([], 'none'); // interior: solid fill
  const R = mk([], 'right');
  const BL = mk([6, 7], 'left');
  const B = mk([6, 7], 'none');
  const BR = mk([6, 7], 'right');
  return [TL, T, TR, L, C, R, BL, B, BR];
}

function arrowTile(): Uint8Array {
  const t = new Uint8Array(16);
  t.fill(0xff, 0, 8); // plane 0: filled interior (color 1)
  const rows = [0b00000000, 0b01111110, 0b00111100, 0b00011000, 0, 0, 0, 0];
  rows.forEach((bits, y) => {
    t[y + 2 + 8] = bits; // plane 1: arrow becomes color 3
  });
  return t.slice(0, 16);
}

/** Sprite-bank arrow: color 3 on transparent, for the bobbing OAM arrow. */
function sprArrowTile(): Uint8Array {
  const t = new Uint8Array(16);
  const rows = [0b01111110, 0b00111100, 0b00011000, 0, 0, 0, 0, 0];
  rows.forEach((bits, y) => {
    t[y + 2] = bits;
    t[y + 2 + 8] = bits;
  });
  return t.slice(0, 16);
}

/**
 * Unique sprite/item drawables referenced by conditional overlays. These are
 * compiled into the background bank (rendered with the cell's BG palette) so
 * an overlay can swap a cell to a sprite/item graphic. Keyed by overlayRefKey.
 */
export function overlayBgRefs(
  game: GameData,
): { key: string; frames: Frame16[] }[] {
  const out = new Map<string, Frame16[]>();
  for (const room of game.rooms)
    for (const ov of room.overlays) {
      if (!ov.kind || ov.kind === 'tile') continue;
      const key = overlayRefKey(ov);
      if (out.has(key)) continue;
      const d =
        ov.kind === 'sprite'
          ? game.sprites.find((s) => s.id === ov.tileId)
          : game.items.find((i) => i.id === ov.tileId);
      if (d) out.set(key, d.frames);
    }
  return [...out].map(([key, frames]) => ({ key, frames }));
}

export function chrgen(game: GameData): ChrResult {
  const chr = new Uint8Array(0x2000);
  const diagnostics: string[] = [];

  const useExt = game.extChars !== false;
  const extChars = useExt ? fontExtChars(game.font) : '';
  const font = fontChrTiles(game.font);
  const ext = fontExtChrTiles(game.font);
  // glyph bitmap for a char: its ext glyph, its ascii glyph, or '?' fallback
  // (same resolution the encoder keys on via glyphKey).
  const baseTileBytes = (ch: string): Uint8Array => {
    const ei = extChars.indexOf(ch);
    if (ei !== -1) return ext.subarray(ei * 16, ei * 16 + 16);
    let c = ch.charCodeAt(0);
    if (c < 32 || c >= 96) c = 0x3f; // '?'
    return font.subarray((c - 32) * 16, (c - 32) * 16 + 16);
  };

  // Font subsetting: place only the glyphs this game renders (static UI +
  // dialogs), packed from FONT_BASE_TILE. Tile-art quads then start right after,
  // reclaiming the ~50 slots the full 64-glyph ascii + ext font would reserve.
  const fontChars = collectFontChars(
    game.title || 'UNTITLED',
    Object.values(game.dialogs),
    game.font,
    extChars,
  );
  const fontSlots = new Map<string, number>();
  fontChars.forEach((ch, i) => fontSlots.set(ch, FONT_BASE_TILE + i));

  const bg = new Bank(
    chr,
    0x0000,
    FONT_BASE_TILE + fontChars.length,
    256,
    'background',
    diagnostics,
  );
  boxPieces().forEach((bytes, i) => bg.place(TILE_BOX_BASE + i, bytes));
  bg.place(TILE_ARROW, arrowTile());
  fontChars.forEach((ch, i) => bg.place(FONT_BASE_TILE + i, baseTileBytes(ch)));

  // usage breakdown: reserved font/box/arrow block, then dialog variants,
  // then game tile quads
  const bgFontTiles = bg.next;

  // Line-2 glyphs shifted 1px down -> 2px gap between dialog text lines.
  // Allocated (deduped) only for chars the dialogs actually put on line 2.
  // Plane 0 stays solid (opaque box fill); plane 1 rows shift down.
  const shifted = (t: Uint8Array): Uint8Array => {
    const s = new Uint8Array(16);
    s.fill(0xff, 0, 8);
    for (let y = 7; y >= 1; y--) s[8 + y] = t[8 + y - 1]!;
    return s;
  };
  // ink → color 2 (highlight), box fill stays color 1
  const colorVariant = (t: Uint8Array): Uint8Array => {
    const c = new Uint8Array(16);
    for (let y = 0; y < 8; y++) {
      c[y] = t[y]! & ~t[y + 8]!;
      c[y + 8] = t[y + 8]!;
    }
    return c;
  };
  const line2Tiles = new Map<string, number>();
  const colorTiles = new Map<string, number>();
  const colorLine2Tiles = new Map<string, number>();
  for (const text of Object.values(game.dialogs)) {
    wrapTextRich(text, game.font).forEach((line, i) => {
      const onLine2 = i % 2 === 1;
      [...line.text].forEach((ch, j) => {
        if (ch === ' ') return;
        const mark = line.marks[j] ?? 0;
        if (mark & FX_WAVE) return; // handled by the wave pair pass
        const colored = (mark & FX_COLOR_MASK) !== 0;
        if (colored) {
          if (onLine2) {
            if (!colorLine2Tiles.has(ch))
              colorLine2Tiles.set(
                ch,
                bg.alloc(colorVariant(shifted(baseTileBytes(ch)))),
              );
          } else if (!colorTiles.has(ch))
            colorTiles.set(ch, bg.alloc(colorVariant(baseTileBytes(ch))));
        } else if (onLine2 && !line2Tiles.has(ch)) {
          line2Tiles.set(ch, bg.alloc(shifted(baseTileBytes(ch))));
        }
      });
    });
  }

  // wave pairs: contiguous even-aligned run so the engine can test tile
  // range membership and toggle base↔base+1. Plain-ink and highlight-ink
  // (wave + color effect) flavors both live in the range.
  const wavyTiles = new Map<string, number>();
  const wavyColorTiles = new Map<string, number>();
  const wavyChars = new Set<string>();
  const wavyColorChars = new Set<string>();
  for (const text of Object.values(game.dialogs)) {
    for (const line of wrapTextRich(text, game.font)) {
      [...line.text].forEach((ch, j) => {
        const mark = line.marks[j] ?? 0;
        if (ch === ' ' || !(mark & FX_WAVE)) return;
        if (mark & FX_COLOR_MASK) wavyColorChars.add(ch);
        else wavyChars.add(ch);
      });
    }
  }
  let waveFirst = 0;
  let waveEnd = 0;
  if (wavyChars.size + wavyColorChars.size > 0) {
    if (bg.next & 1) bg.next++;
    waveFirst = bg.next;
    for (const ch of wavyChars) {
      const base = baseTileBytes(ch);
      wavyTiles.set(ch, bg.allocPair(base, shifted(base)));
    }
    for (const ch of wavyColorChars) {
      const base = colorVariant(baseTileBytes(ch));
      wavyColorTiles.set(
        ch,
        bg.allocPair(base, colorVariant(shifted(baseTileBytes(ch)))),
      );
    }
    waveEnd = bg.next;
  }

  const bgDialogTiles = bg.next - bgFontTiles; // line-2 / color / wave glyphs

  const bgQuads = new Map<string, [Quad, Quad]>();
  for (const tile of game.tiles)
    bgQuads.set(tile.id, framesToQuads(tile.frames, bg));
  // sprite/item drawables referenced by overlays also live in the BG bank
  for (const ref of overlayBgRefs(game))
    bgQuads.set(ref.key, framesToQuads(ref.frames, bg));
  const bgTileTiles = bg.next - bgFontTiles - bgDialogTiles; // unique art quads

  const spr = new Bank(chr, 0x1000, SPR_QUAD_BASE, 256, 'sprite', diagnostics);
  spr.place(SPR_TILE_ARROW, sprArrowTile());
  const sprQuads = new Map<string, [Quad, Quad]>();
  sprQuads.set('AVA', framesToQuads(game.avatar.frames, spr));
  // directional avatar art: up/down fall back to the side frames when absent
  sprQuads.set(
    'AVU',
    framesToQuads(game.avatar.framesUp ?? game.avatar.frames, spr),
  );
  sprQuads.set(
    'AVD',
    framesToQuads(game.avatar.framesDown ?? game.avatar.frames, spr),
  );
  for (const s of game.sprites)
    sprQuads.set(s.id, framesToQuads(s.frames, spr));
  for (const i of game.items)
    sprQuads.set('itm:' + i.id, framesToQuads(i.frames, spr));

  return {
    chr,
    fontSlots,
    bgQuads,
    sprQuads,
    line2Tiles,
    colorTiles,
    colorLine2Tiles,
    wavyTiles,
    wavyColorTiles,
    waveFirst,
    waveEnd,
    bgTilesUsed: bg.next,
    bgFontTiles,
    bgDialogTiles,
    bgTileTiles,
    sprTilesUsed: spr.next,
    diagnostics,
  };
}
