/** NESty game data model. */
import type { SfxSet, SfxClip } from './sfx';
import type { Song } from './song';

/** NES master palette index, 0..63 ($00-$3F). */
export type NesColor = number;
/** 2bpp pixel: 0 = backdrop (BG) / transparent (sprites), 1-3 = palette slots. */
export type Pixel = 0 | 1 | 2 | 3;
/** 16×16 pixel frame, row-major, length 256. */
export type Frame16 = Pixel[];

export type SubPal = 0 | 1 | 2 | 3;

export interface PaletteSet {
  id: string;
  name: string;
  backdrop: NesColor;
  /** 4 background sub-palettes × 3 colors (slots 1-3). */
  bg: [NesColor, NesColor, NesColor][];
  /** 4 sprite sub-palettes × 3 colors. */
  spr: [NesColor, NesColor, NesColor][];
}

export interface TileDef {
  id: string;
  name: string;
  wall: boolean;
  /** 1 frame (static) or 2 (animated). */
  frames: Frame16[];
}

/** Comparison operator for count/var conditions. */
export type Cmp = '==' | '!=' | '>=' | '<';

/**
 * Condition. 'item' = player has (or, negated, does not have) at least one of
 * an item; 'count' = collected-count compare; 'flag' = boolean flag test;
 * 'var' = numeric variable compare.
 */
export type Cond =
  | { kind: 'item'; itemId: string; negate: boolean }
  | { kind: 'count'; itemId: string; cmp: Cmp; value: number }
  | { kind: 'flag'; flagId: string; negate: boolean }
  | { kind: 'var'; varId: string; cmp: Cmp; value: number };

export interface FlagDef {
  id: string;
  name: string;
}

export interface VarDef {
  id: string;
  name: string;
  /** Initial value at game start, 0-255. */
  initial: number;
}

/** Event action, executed in order when the event fires. */
export type Action =
  | { type: 'setFlag' | 'clearFlag' | 'toggleFlag'; flagId: string }
  | { type: 'setVar'; varId: string; value: number }
  | { type: 'addVar'; varId: string; delta: number }
  | { type: 'showDialog'; dlgId: string }
  | { type: 'spriteAnim'; spriteId: string; mode: 'anim' | 'f0' | 'f1' }
  /** Play a sound: builtin SfxName or a custom SfxClip id. */
  | { type: 'playSfx'; sfxId: string }
  /** Switch the music: a song id, or absent = stop/silence. */
  | { type: 'playSong'; songId?: string };

/** Room cell that runs actions when the player steps on it. */
export interface RoomEvent {
  x: number;
  y: number;
  cond?: Cond;
  /** Fires at most once per playthrough. */
  once?: boolean;
  actions: Action[];
}

/**
 * Cell shows a drawable (instead of the base map tile) while cond is met.
 * The drawable may be a tile (default), or a sprite/item graphic — the latter
 * are compiled into the background bank and render with the cell's BG palette.
 */
export interface TileOverlay {
  x: number;
  y: number;
  /** id within the pool named by `kind`. */
  tileId: string;
  /** which pool tileId belongs to; absent = 'tile'. */
  kind?: 'tile' | 'sprite' | 'item';
  cond: Cond;
}

/** Canonical bgQuads / tileIndex key for an overlay's referenced drawable. */
export function overlayRefKey(ov: TileOverlay): string {
  if (ov.kind === 'sprite') return 'ovl:spr:' + ov.tileId;
  if (ov.kind === 'item') return 'ovl:itm:' + ov.tileId;
  return ov.tileId;
}

export interface Drawable {
  id: string;
  name: string;
  frames: Frame16[];
  sprPal: SubPal;
  dlgId?: string;
  /** When altCond is met, altDlgId is shown instead of dlgId. */
  altCond?: Cond;
  altDlgId?: string;
}

/** The player character. Adds optional directional art + movement facing. */
export interface AvatarDef extends Drawable {
  /** Up-facing frames (1-2). Absent = reuse the side `frames`. */
  framesUp?: Frame16[];
  /** Down-facing frames (1-2). Absent = reuse the side `frames`. */
  framesDown?: Frame16[];
  /** Mirror the side sprite horizontally when walking left. */
  flipOnMove?: boolean;
}

export interface SpriteDef extends Drawable {
  room: string;
  x: number;
  y: number;
  /** Sprite only present (visible, talkable, blocking) while met. */
  appearCond?: Cond;
}

export type ItemDef = Drawable;

/**
 * Room-change effect. Absent = instant cut.
 * 'scroll' = Zelda-style directional scroll (direction from the exit's room
 * edge; interior exits fall back to a cut), 'diag' = diagonal wipe to black
 * blocks, 'fade' = palette fade out/in, 'curtain' = black columns close from
 * both edges, 'blinds' = venetian row blinds.
 */
export type ExitTransition = 'scroll' | 'diag' | 'fade' | 'curtain' | 'blinds';

export interface Exit {
  x: number;
  y: number;
  destRoom: string;
  destX: number;
  destY: number;
  /** Exit only works when met; otherwise blocked (+ optional locked dialog). */
  req?: Cond;
  lockedDlgId?: string;
  transition?: ExitTransition;
}

export interface Ending {
  x: number;
  y: number;
  dlgId: string;
  req?: Cond;
  lockedDlgId?: string;
}

export interface ItemPlacement {
  itemId: string;
  x: number;
  y: number;
  /** Item only present (visible, collectable) while met. */
  appearCond?: Cond;
}

export interface Room {
  id: string;
  name: string;
  palId: string;
  /** Song that loops while the player is in this room (absent = silence). */
  songId?: string;
  /** 240 tile ids row-major ('0' = empty). */
  tiles: string[];
  /** 240 BG sub-palette indices. */
  pmap: SubPal[];
  exits: Exit[];
  endings: Ending[];
  items: ItemPlacement[];
  events: RoomEvent[];
  overlays: TileOverlay[];
}

/** Dialog typewriter pacing. 'instant' = whole page at once (effect off). */
export type TextSpeed = 'instant' | 'slow' | 'normal' | 'fast' | 'turbo';

/** Font style; only the selected one is compiled into CHR. */
export type FontStyle = 'classic' | 'thin' | 'bold' | 'scifi' | 'katakana';

/**
 * Optional title/splash screen: a 16×14-cell (256×224 px) map of game tiles
 * with its own palette. When any cell is non-empty the engine shows it at
 * boot instead of the text title.
 */
export interface SplashScreen {
  palId: string;
  /** 224 tile ids row-major ('0' = empty). */
  tiles: string[];
  /** 224 BG sub-palette indices. */
  pmap: SubPal[];
  /** Song that loops on the splash screen (absent = silent title). */
  songId?: string;
}

export interface GameData {
  title: string;
  version: number;
  startRoom: string;
  startX: number;
  startY: number;
  textSpeed: TextSpeed;
  /** Play the 'type' SFX once per typed char (only when typewriter is on). */
  typewriterSfx?: boolean;
  /** Avatar slides between tiles instead of instant grid-snap. Movement stays
   *  grid-locked and orthogonal; only the visual transition is tweened. */
  smoothMove?: boolean;
  /** Slide speed in px/frame when smoothMove is on (cell = 16px). Default 4. */
  moveSpeed?: number;
  /** Keep gliding tile-to-tile while a direction is held (smooth mode only). */
  moveCont?: boolean;
  font: FontStyle;
  /** Compile the font's extended glyph set (accents / katakana). Default true.
   *  When false the ext glyphs are dropped, freeing background CHR. */
  extChars?: boolean;
  palettes: PaletteSet[];
  tiles: TileDef[];
  sprites: SpriteDef[];
  items: ItemDef[];
  flags: FlagDef[];
  variables: VarDef[];
  rooms: Room[];
  dialogs: Record<string, string>;
  avatar: AvatarDef;
  sfx: SfxSet;
  /** User-created sounds, triggerable from events/logic. */
  customSfx: SfxClip[];
  songs: Song[];
  splash?: SplashScreen;
}

export const ROOM_W = 16;
export const ROOM_H = 15;
export const CELL_COUNT = ROOM_W * ROOM_H;
export const SPLASH_W = 16;
export const SPLASH_H = 14;
export const SPLASH_CELLS = SPLASH_W * SPLASH_H;

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  where?: string; // e.g. "ROOM 0", "TIL a"
}
