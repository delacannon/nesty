import type { GameData, Pixel, TileDef } from './types';
import { blankRoom, defaultAvatar, defaultPalette, frameFromRows } from './defaults';
import { defaultSfxSet } from './sfx';

function solid(v: Pixel): string[] {
  return new Array(16).fill(String(v).repeat(16));
}

function blockTile(): TileDef {
  return { id: 'a', name: 'block', wall: true, frames: [frameFromRows(solid(1))] };
}

function flowerTile(): TileDef {
  const f0 = solid(0).map((r, y) => (y > 10 ? '0000000333000000' : r));
  const f1 = solid(0).map((r, y) => (y > 9 && y < 15 ? '0000003330000000' : r));
  return { id: 'f', name: 'flower', wall: false, frames: [frameFromRows(f0), frameFromRows(f1)] };
}

function catFrames() {
  const rows = solid(0).map((r, y) => (y >= 8 ? '0011111111111100' : y >= 6 ? '0011000000001100' : r));
  return [frameFromRows(rows), frameFromRows(rows.slice(1).concat(['0000000000000000']))];
}

function keyFrames() {
  const rows = solid(0).map((r, y) => (y >= 6 && y <= 10 ? '0000011222110000' : r));
  return [frameFromRows(rows)];
}

/**
 * Room 0: bordered room. cat sprite at (7,5), key item at (5,7),
 * exit at (15,7) -> room 1 (1,7), flowers sprinkled. Start (7,7).
 * Room 1: bordered room with ending at (3,7).
 */
export function sampleGame(): GameData {
  const block = blockTile();
  const flower = flowerTile();

  const room0 = blankRoom('0');
  const room1 = blankRoom('1');
  for (const room of [room0, room1]) {
    for (let x = 0; x < 16; x++) {
      room.tiles[x] = block.id;
      room.tiles[14 * 16 + x] = block.id;
    }
    for (let y = 0; y < 15; y++) {
      room.tiles[y * 16] = block.id;
      room.tiles[y * 16 + 15] = block.id;
    }
  }
  room0.tiles[3 * 16 + 3] = flower.id;
  room0.tiles[11 * 16 + 12] = flower.id;
  room0.exits.push({
    x: 15,
    y: 7,
    destRoom: '1',
    destX: 1,
    destY: 7,
    req: { kind: 'item', itemId: 'k', negate: false },
    lockedDlgId: 'd',
  });
  room0.items.push({ itemId: 'k', x: 5, y: 7 });
  room1.endings.push({ x: 3, y: 7, dlgId: 'e' });
  // clean sub-palettes: everything on sub-pal 0, flowers accented with 1
  room0.pmap[3 * 16 + 3] = 1;
  room0.pmap[11 * 16 + 12] = 1;

  return {
    title: 'sample quest',
    version: 1,
    startRoom: '0',
    startX: 7,
    startY: 7,
    textSpeed: 'turbo',
    font: 'classic',
    palettes: [defaultPalette()],
    tiles: [block, flower],
    sprites: [
      {
        id: 'c',
        name: 'cat',
        frames: catFrames(),
        sprPal: 1,
        dlgId: 'c',
        altCond: { kind: 'item', itemId: 'k', negate: false },
        altDlgId: 'a',
        room: '0',
        x: 7,
        y: 5,
      },
    ],
    items: [{ id: 'k', name: 'key', frames: keyFrames(), sprPal: 2, dlgId: 'k' }],
    flags: [],
    variables: [],
    rooms: [room0, room1],
    dialogs: {
      c: 'Meow. The cave is deeper than it looks. Take the key and go east.',
      k: 'You found a key!',
      e: 'You reached the end. Thanks for playing!',
      d: 'The east door is locked. Find the key.',
      a: 'You have the key! The east door will open now.',
    },
    avatar: defaultAvatar(),
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [],
  };
}
