/** Shared byte-level layout constants for engine + compiler. */

export const PRG_ORIGIN = 0x8000;

// CHR banks
export const BG_BANK_OFFSET = 0x0000; // $0000 pattern table, 256 tiles
export const SPR_BANK_OFFSET = 0x1000; // $1000 pattern table, 256 tiles

// BG bank tile allocation
export const TILE_BLANK = 0;
export const TILE_BOX_BASE = 1; // 9 dialog box pieces: TL T TR L C R BL B BR
export const TILE_ARROW = 10; // "more text" indicator
export const FONT_BASE = 16; // font glyphs start here (subset packed, see chrgen)
// Dialog box (1..9), arrow (10) and the subset font occupy the low slots; game
// tile-art quads and dialog glyph variants pack immediately after the font.

// Sprite bank allocation
export const SPR_TILE_ARROW = 0; // dialog "more text" bobbing arrow
export const SPR_QUAD_BASE = 1; // game quads from 1

// Room geometry
export const ROOM_W = 16;
export const ROOM_H = 15;
export const CELL_COUNT = ROOM_W * ROOM_H; // 240
