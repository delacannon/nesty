/**
 * MIO'S FISH QUEST — bundled example game.
 * A little cat's dinner is gone. Yarn buys an owl's secret, the secret finds a
 * key, the key opens the harbor, a coin buys passage to the pier, and a fat
 * silver fish ends the day by the fireplace.
 *
 * 6 rooms · 5 items · locked exits, gated pier, alt dialogs everywhere.
 */
import { blankRoom, frameFromRows } from './defaults';
import { defaultSfxSet } from './sfx';
import { fieldSong } from './song';
import type { Frame16, GameData, PaletteSet, Room, SubPal, TileDef } from './types';

const F = (rows: string[]): Frame16 => frameFromRows(rows);

// ---------------------------------------------------------------- tiles ----

const brick = (): TileDef => ({
  id: 'a',
  name: 'brick wall',
  wall: true,
  frames: [
    F([
      '1111111111111111',
      '1222122212221222',
      '1222122212221222',
      '1111111111111111',
      '1212221222122212',
      '1212221222122212',
      '1111111111111111',
      '1222122212221222',
      '1222122212221222',
      '1111111111111111',
      '1212221222122212',
      '1212221222122212',
      '1111111111111111',
      '1222122212221222',
      '1222122212221222',
      '1111111111111111',
    ]),
  ],
});

const grass = (): TileDef => ({
  id: 's',
  name: 'grass',
  wall: false,
  frames: [
    F([
      '0000000000000000',
      '0010000000010000',
      '0000000100000000',
      '0000000000000000',
      '0000100000000010',
      '0000000000000000',
      '0100000001000000',
      '0000000000000000',
      '0000001000000100',
      '0000000000000000',
      '0010000000000000',
      '0000000010000000',
      '0000010000000001',
      '0000000000000000',
      '0100000000100000',
      '0000000000000000',
    ]),
  ],
});

const flower = (): TileDef => ({
  id: 'g',
  name: 'flower',
  wall: false,
  frames: [
    F([
      '0000000000000000',
      '0000000000000000',
      '0000023200000000',
      '0000232320000000',
      '0000023200000000',
      '0000001000000000',
      '0000001000023200',
      '0000001000232320',
      '0000011100023200',
      '0000001000001000',
      '0000001000001000',
      '0000001000011100',
      '0000001000001000',
      '0000001000001000',
      '0000000000000000',
      '0000000000000000',
    ]),
    F([
      '0000000000000000',
      '0000023200000000',
      '0000232320000000',
      '0000023200000000',
      '0000001000000000',
      '0000001000000000',
      '0000001000000000',
      '0000001000023200',
      '0000011100232320',
      '0000001000023200',
      '0000001000001000',
      '0000001000001000',
      '0000001000011100',
      '0000001000001000',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

const tree = (): TileDef => ({
  id: 't',
  name: 'tree',
  wall: true,
  frames: [
    F([
      '0000011111100000',
      '0001122222110000',
      '0011222222211000',
      '0112222222221100',
      '0122222222222100',
      '1222222222222210',
      '1222222222222210',
      '0122222222222100',
      '0011222222211000',
      '0000112211110000',
      '0000001331000000',
      '0000001331000000',
      '0000001331000000',
      '0000013333100000',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

const water = (): TileDef => ({
  id: 'w',
  name: 'water',
  wall: true,
  frames: [
    F([
      '1111111111111111',
      '1111111111111111',
      '1112211111122111',
      '1111111111111111',
      '1111111221111111',
      '1111111111111111',
      '1221111111112211',
      '1111111111111111',
      '1111112211111111',
      '1111111111111111',
      '1122111111122111',
      '1111111111111111',
      '1111111122111111',
      '1111111111111111',
      '1112211111111221',
      '1111111111111111',
    ]),
    F([
      '1111111111111111',
      '1112211111122111',
      '1111111111111111',
      '1111111221111111',
      '1111111111111111',
      '1221111111112211',
      '1111111111111111',
      '1111112211111111',
      '1111111111111111',
      '1122111111122111',
      '1111111111111111',
      '1111111122111111',
      '1111111111111111',
      '1112211111111221',
      '1111111111111111',
      '1111111111111111',
    ]),
  ],
});

// same look as water frame 1, but static — for large areas (32 animated cells/room cap)
const stillWater = (): TileDef => {
  const w = water();
  return { id: 'v', name: 'still water', wall: true, frames: [w.frames[0]!] };
};

const house = (): TileDef => ({
  id: 'h',
  name: 'house',
  wall: true,
  frames: [
    F([
      '0000001111000000',
      '0000111111110000',
      '0011111111111100',
      '0111111111111110',
      '1111111111111111',
      '0222222222222220',
      '0222233222332220',
      '0222233222332220',
      '0222222222222220',
      '0222222222222220',
      '0222233222222220',
      '0222233222332220',
      '0222233222332220',
      '0222233222222220',
      '0222222222222220',
      '0222222222222220',
    ]),
  ],
});

const rug = (): TileDef => ({
  id: 'r',
  name: 'rug',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1222222222222221',
      '1211112222111121',
      '1212212222122121',
      '1211112222111121',
      '1222222222222221',
      '1222222112222221',
      '1222221221222221',
      '1222221221222221',
      '1222222112222221',
      '1222222222222221',
      '1211112222111121',
      '1212212222122121',
      '1211112222111121',
      '1222222222222221',
      '1111111111111111',
    ]),
  ],
});

const path = (): TileDef => ({
  id: 'p',
  name: 'path',
  wall: false,
  frames: [
    F([
      '0000000000000000',
      '0011000110001100',
      '0111101111011110',
      '0011000110001100',
      '0000000000000000',
      '0001100011000110',
      '0011110111101111',
      '0001100011000110',
      '0000000000000000',
      '0011000110001100',
      '0111101111011110',
      '0011000110001100',
      '0000000000000000',
      '0001100011000110',
      '0011110111101111',
      '0001100011000110',
    ]),
  ],
});

const planks = (): TileDef => ({
  id: 'l',
  name: 'pier planks',
  wall: false,
  frames: [
    F([
      '2222222222222222',
      '2222222122222221',
      '2222222122222221',
      '1111111111111111',
      '2122222221222222',
      '2122222221222222',
      '2222222222222222',
      '1111111111111111',
      '2222212222222122',
      '2222212222222122',
      '2222222222222222',
      '1111111111111111',
      '2221222222212222',
      '2221222222212222',
      '2222222222222222',
      '1111111111111111',
    ]),
  ],
});

const fence = (): TileDef => ({
  id: 'e',
  name: 'fence',
  wall: true,
  frames: [
    F([
      '0000000000000000',
      '0000000000000000',
      '0110011001100110',
      '0330033003300330',
      '0110011001100110',
      '1111111111111111',
      '0110011001100110',
      '0110011001100110',
      '1111111111111111',
      '0110011001100110',
      '0110011001100110',
      '0110011001100110',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

const fireplace = (): TileDef => ({
  id: 'z',
  name: 'fireplace',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1222222222222221',
      '1221111111111221',
      '1221000000001221',
      '1221000300001221',
      '1221003330001221',
      '1221033233001221',
      '1221332223301221',
      '1221322222301221',
      '1221111111111221',
      '1222222222222221',
      '1111111111111111',
      '0011111111111100',
      '0011111111111100',
      '0000000000000000',
      '0000000000000000',
    ]),
    F([
      '1111111111111111',
      '1222222222222221',
      '1221111111111221',
      '1221003000001221',
      '1221033300301221',
      '1221032330301221',
      '1221332233001221',
      '1221322222301221',
      '1221222222201221',
      '1221111111111221',
      '1222222222222221',
      '1111111111111111',
      '0011111111111100',
      '0011111111111100',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

// ------------------------------------------------------------- drawables ----

const avatarCat = () => ({
  id: 'A',
  name: 'mio',
  sprPal: 0 as SubPal,
  frames: [
    F([
      '0010000000000100',
      '0011000000001100',
      '0012100000012100',
      '0012221111222100',
      '0012222222222100',
      '0122232222322210',
      '0122222222222210',
      '0122223223222210',
      '0012222222222100',
      '0001222222221000',
      '0001222222221000',
      '0012222222222100',
      '0012212222122100',
      '0012212222122100',
      '0001100110011000',
      '0000000000000000',
    ]),
    F([
      '0010000000000100',
      '0011000000001100',
      '0012100000012100',
      '0012221111222100',
      '0012222222222100',
      '0122232222322210',
      '0122222222222210',
      '0122223223222210',
      '0012222222222100',
      '0001222222221000',
      '0001222222221000',
      '0012222222222100',
      '0012122222212100',
      '0001212222121000',
      '0000110110110000',
      '0000000000000000',
    ]),
  ],
});

const mamaCat = () =>
  F([
    '0100000000000010',
    '0110000000000110',
    '0121000000001210',
    '0122211111122210',
    '1222222222222221',
    '1223222222232221',
    '1222222222222221',
    '1222232232222221',
    '1222222222222221',
    '0122222222222210',
    '0122222222222210',
    '1222222222222221',
    '1222122222212221',
    '1222122222212221',
    '0111001111001110',
    '0000000000000000',
  ]);

const mouse = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0011000110000000',
    '0121101221000000',
    '0112212222100000',
    '0012222222210000',
    '0122232232221000',
    '1222222222222111',
    '0122222222221000',
    '0012211112210000',
    '0001100001100000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const owl = () =>
  F([
    '0001100000011000',
    '0012210000122100',
    '0012221111222100',
    '0122222222222210',
    '0122322332232210',
    '0123223223222310',
    '0122322332232210',
    '0122222332222210',
    '0122222222222210',
    '0122122222212210',
    '0122112222112210',
    '0012211111122100',
    '0001222222221000',
    '0000122222210000',
    '0000011001100000',
    '0000000000000000',
  ]);

const dog = () =>
  F([
    '0110000000000000',
    '1221000000000000',
    '1222100000000110',
    '1222211111111210',
    '0122222222222210',
    '0123222222232210',
    '0122222222222210',
    '0122232232222100',
    '0012222222221000',
    '0122222222222100',
    '0122222222222100',
    '1222122222122210',
    '1222122222122210',
    '0111001111011100',
    '0000000000000000',
    '0000000000000000',
  ]);

const fisher = () =>
  F([
    '0000011111100000',
    '0000122222210000',
    '0000122222210000',
    '0001222222221000',
    '0001232232221000',
    '0001222222221000',
    '0001222332221000',
    '0000122222210000',
    '0001111111111000',
    '0012222222222100',
    '0112222222222110',
    '0102222222222010',
    '0001222112221000',
    '0001221001221000',
    '0001221001221000',
    '0011100000111000',
  ]);

const ghostCat = () =>
  F([
    '0010000000000100',
    '0011000000001100',
    '0012100000012100',
    '0012211111122100',
    '0122222222222210',
    '0122322222322210',
    '0122222222222210',
    '0122223223222210',
    '0012222222222100',
    '0012222222222100',
    '0122222222222210',
    '0122222222222210',
    '0121221221221210',
    '0110110110110110',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemYarn = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000011111000000',
    '0000122232100000',
    '0001232222210000',
    '0001222322210000',
    '0001223222210000',
    '0001222223210000',
    '0000123222100000',
    '0000011111000000',
    '0000000001100000',
    '0000000000011000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemKey = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000011100000000',
    '0000102010000000',
    '0000100010000000',
    '0000102010000000',
    '0000011100000000',
    '0000001000000000',
    '0000001000000000',
    '0000001100000000',
    '0000001000000000',
    '0000001100000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemCoin = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000001111000000',
    '0000012222100000',
    '0000122322210000',
    '0000122232210000',
    '0000122322210000',
    '0000012222100000',
    '0000001111000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemFish = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000011110000010',
    '0000122221000110',
    '0001222322101210',
    '0012222222212210',
    '0001222222101210',
    '0000122221000110',
    '0000011110000010',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemCatnip = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000010001000000',
    '0000121012100000',
    '0000012121000000',
    '0000001210000000',
    '0000121012100000',
    '0000012121000000',
    '0000001110000000',
    '0000000100000000',
    '0000000100000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

// -------------------------------------------------------------- palettes ----

const SPR: PaletteSet['spr'] = [
  [0x16, 0x27, 0x30], // 0: orange cat (outline red-brown, body orange, white)
  [0x00, 0x10, 0x30], // 1: grays (mouse, ghost)
  [0x17, 0x28, 0x30], // 2: browns/yellow (owl, dog, yarn, coin, key)
  [0x01, 0x21, 0x30], // 3: blues (fisherman, fish)
];

const palettes = (): PaletteSet[] => [
  {
    id: '0',
    name: 'home',
    backdrop: 0x0f,
    bg: [
      [0x07, 0x17, 0x27], // wood
      [0x06, 0x16, 0x28], // fireplace: brick reds + flame yellow
      [0x03, 0x13, 0x23], // rug purples
      [0x09, 0x19, 0x29],
    ],
    spr: SPR,
  },
  {
    id: '1',
    name: 'outdoor',
    backdrop: 0x0b,
    bg: [
      [0x09, 0x19, 0x1a], // greens (trees, grass)
      [0x0f, 0x15, 0x30], // flowers: stems dark, petals red/white
      [0x08, 0x18, 0x28], // path/fence browns
      [0x07, 0x17, 0x27], // house browns
    ],
    spr: SPR,
  },
  {
    id: '2',
    name: 'dark',
    backdrop: 0x0f,
    bg: [
      [0x0c, 0x1c, 0x2c], // cold blue-gray stone
      [0x09, 0x19, 0x1a], // green canopy
      [0x03, 0x13, 0x23], // purple glow
      [0x07, 0x17, 0x27],
    ],
    spr: SPR,
  },
  {
    id: '3',
    name: 'harbor',
    backdrop: 0x0c,
    bg: [
      [0x07, 0x17, 0x27], // planks
      [0x01, 0x11, 0x21], // water blues
      [0x08, 0x18, 0x28], // sand
      [0x00, 0x10, 0x20],
    ],
    spr: SPR,
  },
];

// ------------------------------------------------------------- room build ----

interface Painter {
  room: Room;
  put: (x: number, y: number, id: string) => void;
  row: (y: number, x0: number, x1: number, id: string) => void;
  col: (x: number, y0: number, y1: number, id: string) => void;
  border: (id: string) => void;
  palAt: (id: string, sub: SubPal) => void;
}

function painter(id: string, palId: string): Painter {
  const room = blankRoom(id, palId);
  const put = (x: number, y: number, tid: string) => {
    room.tiles[y * 16 + x] = tid;
  };
  const row = (y: number, x0: number, x1: number, tid: string) => {
    for (let x = x0; x <= x1; x++) put(x, y, tid);
  };
  const col = (x: number, y0: number, y1: number, tid: string) => {
    for (let y = y0; y <= y1; y++) put(x, y, tid);
  };
  const border = (tid: string) => {
    row(0, 0, 15, tid);
    row(14, 0, 15, tid);
    col(0, 0, 14, tid);
    col(15, 0, 14, tid);
  };
  const palAt = (tid: string, sub: SubPal) => {
    room.tiles.forEach((t, i) => {
      if (t === tid) room.pmap[i] = sub;
    });
  };
  return { room, put, row, col, border, palAt };
}

// ------------------------------------------------------------------ game ----

export function catQuest(): GameData {
  // ---- room 0: HOME ----
  const home = painter('0', '0');
  home.room.name = 'home';
  home.border('a');
  home.put(15, 7, 'a'); // door arch (exit sits on it)
  home.row(2, 7, 9, 'z'); // fireplace wall
  home.put(7, 2, 'a');
  home.put(9, 2, 'a');
  home.row(6, 5, 10, 'r');
  home.row(7, 5, 10, 'r');
  home.row(8, 5, 10, 'r');
  home.palAt('z', 1);
  home.palAt('r', 2);
  home.room.exits.push({ x: 15, y: 7, destRoom: '1', destX: 1, destY: 7 });
  home.room.endings.push({
    x: 8,
    y: 3,
    dlgId: 'e',
    req: { kind: 'item', itemId: 'f', negate: false },
    lockedDlgId: 'n',
  });

  // ---- room 1: GARDEN ----
  const garden = painter('1', '1');
  garden.room.name = 'garden';
  garden.room.songId = 'field'; // peaceful flower-field loop
  garden.border('t');
  garden.put(7, 0, 's'); // north gap -> forest
  garden.put(0, 7, 's'); // west gap -> home
  garden.put(15, 7, 's'); // east gap -> village
  for (const [x, y] of [
    [3, 3],
    [12, 4],
    [4, 11],
    [10, 2],
    [13, 11],
    [2, 8],
  ] as const)
    garden.put(x, y, 'g');
  garden.row(7, 1, 14, 'p');
  garden.col(7, 1, 6, 'p');
  garden.room.tiles = garden.room.tiles.map((t) => (t === '0' ? 's' : t));
  garden.palAt('g', 1);
  garden.palAt('p', 2);
  garden.room.exits.push(
    { x: 7, y: 0, destRoom: '2', destX: 7, destY: 13 },
    { x: 0, y: 7, destRoom: '0', destX: 14, destY: 7 },
    { x: 15, y: 7, destRoom: '3', destX: 1, destY: 7 },
  );
  garden.room.items.push({ itemId: 'y', x: 12, y: 10 });

  // ---- room 2: FOREST ----
  const forest = painter('2', '2');
  forest.room.name = 'forest';
  forest.border('t');
  forest.put(7, 14, 's'); // south gap -> garden
  for (const [x, y] of [
    [4, 4],
    [11, 5],
    [5, 9],
    [12, 10],
    [9, 8],
    [2, 6],
    [13, 3],
  ] as const)
    forest.put(x, y, 't');
  forest.put(3, 12, 'a'); // cave mouth
  forest.room.tiles = forest.room.tiles.map((t) => (t === '0' ? 's' : t));
  forest.palAt('t', 1);
  forest.palAt('a', 0);
  forest.room.exits.push(
    { x: 7, y: 14, destRoom: '1', destX: 7, destY: 1 },
    { x: 3, y: 12, destRoom: '5', destX: 7, destY: 2 },
  );

  // ---- room 3: VILLAGE ----
  const village = painter('3', '1');
  village.room.name = 'village';
  village.border('e');
  village.put(0, 7, 'p'); // west gap -> garden
  village.put(15, 7, 'e'); // harbor gate (locked exit sits on fence)
  for (const [x, y] of [
    [3, 2],
    [7, 2],
    [11, 2],
    [3, 5],
    [11, 5],
    [5, 11],
    [10, 11],
  ] as const)
    village.put(x, y, 'h');
  village.row(7, 1, 14, 'p');
  village.room.tiles = village.room.tiles.map((t) => (t === '0' ? 's' : t));
  village.palAt('h', 3);
  village.palAt('p', 2);
  village.palAt('e', 2);
  village.room.exits.push(
    { x: 0, y: 7, destRoom: '1', destX: 14, destY: 7 },
    {
      x: 15,
      y: 7,
      destRoom: '4',
      destX: 1,
      destY: 7,
      req: { kind: 'item', itemId: 'k', negate: false },
      lockedDlgId: 'l',
    },
  );
  village.room.items.push({ itemId: 'c', x: 3, y: 10 });

  // ---- room 4: DOCK ----
  const dock = painter('4', '3');
  dock.room.name = 'dock';
  dock.border('v');
  dock.put(0, 7, 'l'); // west gap -> village
  // sand shore on the left, plank pier to the right, water gap at x=11
  for (let y = 1; y <= 13; y++)
    for (let x = 1; x <= 9; x++) dock.put(x, y, y < 4 ? 's' : 'p');
  dock.col(10, 1, 13, 'l');
  dock.col(11, 1, 13, 'w'); // animated water in the gap the ferryman rows across
  dock.col(12, 1, 13, 'l');
  dock.col(13, 1, 13, 'l');
  dock.col(14, 1, 13, 'l');
  dock.palAt('w', 1);
  dock.palAt('v', 1);
  dock.palAt('s', 2);
  dock.palAt('p', 2);
  dock.room.exits.push(
    { x: 0, y: 7, destRoom: '3', destX: 14, destY: 7 },
    {
      x: 10,
      y: 7,
      destRoom: '4',
      destX: 12,
      destY: 7,
      req: { kind: 'item', itemId: 'c', negate: false },
      lockedDlgId: 'm',
    },
    { x: 12, y: 7, destRoom: '4', destX: 9, destY: 7 }, // row back is free
  );
  dock.room.items.push({ itemId: 'f', x: 14, y: 7 });

  // ---- room 5: CAVE ----
  const cave = painter('5', '2');
  cave.room.name = 'cave';
  cave.border('a');
  cave.put(7, 1, 'a'); // ladder back up (exit sits on it)
  for (const [x, y] of [
    [4, 4],
    [11, 4],
    [6, 10],
    [10, 9],
  ] as const)
    cave.put(x, y, 'a');
  cave.palAt('a', 0);
  cave.room.exits.push({ x: 7, y: 1, destRoom: '2', destX: 3, destY: 11 });
  cave.room.items.push({ itemId: 'k', x: 12, y: 11 }, { itemId: 'n', x: 2, y: 3 });

  // ---- assemble ----
  return {
    title: "mio's fish quest",
    version: 1,
    startRoom: '0',
    startX: 5,
    startY: 7,
    textSpeed: 'normal',
    font: 'classic',
    palettes: palettes(),
    tiles: [
      brick(),
      grass(),
      flower(),
      tree(),
      water(),
      stillWater(),
      house(),
      rug(),
      path(),
      planks(),
      fence(),
      fireplace(),
    ],
    sprites: [
      {
        id: 'M',
        name: 'mama cat',
        frames: [mamaCat()],
        sprPal: 0,
        dlgId: 'a',
        altCond: { kind: 'item', itemId: 'f', negate: false },
        altDlgId: 'b',
        room: '0',
        x: 4,
        y: 4,
      },
      {
        id: 'U',
        name: 'mouse',
        frames: [mouse()],
        sprPal: 1,
        dlgId: 'o',
        room: '1',
        x: 5,
        y: 4,
      },
      {
        id: 'O',
        name: 'owl',
        frames: [owl()],
        sprPal: 2,
        dlgId: 'c',
        altCond: { kind: 'item', itemId: 'y', negate: false },
        altDlgId: 'd',
        room: '2',
        x: 8,
        y: 3,
      },
      {
        id: 'D',
        name: 'dog',
        frames: [dog()],
        sprPal: 2,
        dlgId: 'h',
        altCond: { kind: 'item', itemId: 'n', negate: false },
        altDlgId: 'i',
        room: '3',
        x: 6,
        y: 6,
      },
      {
        id: 'F',
        name: 'fisherman',
        frames: [fisher()],
        sprPal: 3,
        dlgId: 'j',
        altCond: { kind: 'item', itemId: 'c', negate: false },
        altDlgId: 'k',
        room: '4',
        x: 5,
        y: 5,
      },
      {
        id: 'G',
        name: 'ghost cat',
        frames: [ghostCat()],
        sprPal: 1,
        dlgId: 'f',
        altCond: { kind: 'item', itemId: 'k', negate: false },
        altDlgId: 'g',
        room: '5',
        x: 4,
        y: 7,
      },
    ],
    items: [
      { id: 'y', name: 'yarn ball', frames: [itemYarn()], sprPal: 2, dlgId: 'p' },
      { id: 'k', name: 'shiny key', frames: [itemKey()], sprPal: 2, dlgId: 'q' },
      { id: 'c', name: 'coin', frames: [itemCoin()], sprPal: 2, dlgId: 'r' },
      { id: 'f', name: 'silver fish', frames: [itemFish()], sprPal: 3, dlgId: 's' },
      { id: 'n', name: 'catnip', frames: [itemCatnip()], sprPal: 1, dlgId: 't' },
    ],
    flags: [],
    variables: [],
    rooms: [home.room, garden.room, forest.room, village.room, dock.room, cave.room],
    dialogs: {
      a: "Mama: our dinner is gone, Mio! The gulls took the fish. Go east, little one, and don't come back without a big one.",
      b: 'Mama: a silver fish! You wonderful cat. Set it down by the fireplace.',
      o: 'Mouse: psst. The owl in the north woods knows where the harbor key sleeps. She trades secrets for soft yarn.',
      c: 'Owl: hoo. A cat with empty paws. Bring me soft yarn and I will tell you a secret worth keeping.',
      d: 'Owl: ooh, lovely yarn... Listen: a shiny key sleeps in the cave below the old stone door. Take the dark stairs.',
      f: 'Ghost cat: long ago I guarded the harbor key... now I only guard the dark.',
      g: 'Ghost cat: you found it. Take good care of the harbor, little cousin.',
      h: 'Dog: WOOF. The fisherman trades fish for coins. Somebody dropped one behind the houses. Not that I can pick it up.',
      i: 'Dog: woof?? you smell AMAZING. Best cat. Ten out of ten.',
      j: 'Fisherman: the sea was kind today, cat. A fish for a coin, that is the deal. No coin, no crossing to the pier.',
      k: 'Fisherman: a coin! From a cat! Hop in, I will row you across. Take the fat one from the barrel.',
      l: 'The harbor gate is locked tight. It needs a key.',
      m: 'The fisherman blocks the plank. "No coin, no crossing."',
      n: 'The fireplace crackles. Dinner spot. Still no fish.',
      e: 'Mio curls up by the fire with mama. Best fish dinner ever. THE END.',
      p: 'A ball of the softest yarn! An owl would love this.',
      q: 'The shiny harbor key! It is cold and smells of salt.',
      r: 'A lost coin! It glints like a tiny moon.',
      s: 'A fat silver fish! Heavy. Perfect. Do not eat it yet.',
      t: 'Catnip. For... later. Definitely for later.',
    },
    avatar: avatarCat(),
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [fieldSong()],
  };
}
