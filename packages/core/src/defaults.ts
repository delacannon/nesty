import type {
  Drawable,
  Frame16,
  GameData,
  PaletteSet,
  Pixel,
  Room,
  SplashScreen,
  SubPal,
  TileDef,
} from './types';
import { CELL_COUNT, SPLASH_CELLS } from './types';
import { defaultSfxSet } from './sfx';
import { townSong } from './song';

export function blankFrame(): Frame16 {
  return new Array<Pixel>(256).fill(0);
}

/** Parse 16 rows of 16 chars '0'-'3' into a Frame16. */
export function frameFromRows(rows: string[]): Frame16 {
  const f = blankFrame();
  for (let y = 0; y < 16; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < 16; x++) {
      const c = row[x];
      f[y * 16 + x] = (c === '1' || c === '2' || c === '3' ? Number(c) : 0) as Pixel;
    }
  }
  return f;
}

export function frameToRows(f: Frame16): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    rows.push(
      f
        .slice(y * 16, y * 16 + 16)
        .map(String)
        .join(''),
    );
  }
  return rows;
}

export function defaultPalette(): PaletteSet {
  return {
    id: '0',
    name: 'default',
    backdrop: 0x0f,
    bg: [
      [0x21, 0x11, 0x30],
      [0x27, 0x17, 0x30],
      [0x29, 0x19, 0x30],
      [0x24, 0x14, 0x30],
    ],
    spr: [
      [0x30, 0x27, 0x16],
      [0x21, 0x11, 0x30],
      [0x29, 0x19, 0x30],
      [0x24, 0x14, 0x30],
    ],
  };
}

function defaultAvatarFrames(): Frame16[] {
  const rows1 = [
    '0000000000000000',
    '0000011111100000',
    '0000122222210000',
    '0001223223221000',
    '0001222222221000',
    '0001223333221000',
    '0000122222210000',
    '0000011111100000',
    '0000001221000000',
    '0000012222100000',
    '0000122222210000',
    '0001221221221000',
    '0000101221010000',
    '0000001221000000',
    '0000012012100000',
    '0000120000210000',
  ];
  const rows2 = rows1.slice(0, 14).concat(['0000012112100000', '0000012002100000']);
  return [frameFromRows(rows1), frameFromRows(rows2)];
}

function defaultBlockTile(): TileDef {
  const rows = [
    '3333333333333332',
    '3222222222222212',
    '3222222222222212',
    '3222111111122212',
    '3222122222122212',
    '3222122222122212',
    '3222122222122212',
    '3222111111122212',
    '3222222222222212',
    '3222222222222212',
    '3222222222222212',
    '3222222222222212',
    '3222222222222212',
    '3222222222222212',
    '3111111111111112',
    '2222222222222222',
  ];
  return { id: 'a', name: 'block', wall: true, frames: [frameFromRows(rows)] };
}

export function blankRoom(id: string, palId = '0'): Room {
  return {
    id,
    name: 'room ' + id,
    palId,
    tiles: new Array<string>(CELL_COUNT).fill('0'),
    pmap: new Array<SubPal>(CELL_COUNT).fill(0),
    exits: [],
    endings: [],
    items: [],
    events: [],
    overlays: [],
  };
}

/**
 * Scroll direction for a 'scroll' exit, from the room edge it sits on
 * (E/W checked before N/S for corner cells). Interior exits → undefined
 * (the engine falls back to an instant cut).
 */
export function exitScrollDir(ex: {
  x: number;
  y: number;
}): 'E' | 'W' | 'N' | 'S' | undefined {
  if (ex.x === 15) return 'E';
  if (ex.x === 0) return 'W';
  if (ex.y === 0) return 'N';
  if (ex.y === 14) return 'S';
  return undefined;
}

export function blankSplash(palId = '0'): SplashScreen {
  return {
    palId,
    tiles: new Array<string>(SPLASH_CELLS).fill('0'),
    pmap: new Array<SubPal>(SPLASH_CELLS).fill(0),
  };
}

/** A splash counts as present only when it has at least one non-empty cell. */
export function splashHasContent(s: SplashScreen | undefined): s is SplashScreen {
  return !!s && s.tiles.some((t) => t !== '0');
}

export function defaultAvatar(): Drawable {
  return { id: 'A', name: 'avatar', frames: defaultAvatarFrames(), sprPal: 0 };
}

export function defaultGame(): GameData {
  const room = blankRoom('0');
  room.songId = 'town';
  const block = defaultBlockTile();
  // border of wall tiles
  for (let x = 0; x < 16; x++) {
    room.tiles[x] = block.id;
    room.tiles[14 * 16 + x] = block.id;
  }
  for (let y = 0; y < 15; y++) {
    room.tiles[y * 16] = block.id;
    room.tiles[y * 16 + 15] = block.id;
  }
  return {
    title: 'my nesty game',
    version: 2,
    startRoom: '0',
    startX: 7,
    startY: 7,
    textSpeed: 'turbo',
    smoothMove: false,
    moveSpeed: 4,
    font: 'classic',
    palettes: [defaultPalette()],
    tiles: [block],
    sprites: [],
    items: [],
    flags: [],
    variables: [],
    rooms: [room],
    dialogs: {},
    avatar: defaultAvatar(),
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [townSong()],
  };
}
