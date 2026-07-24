/**
 * WHO GOES THERE? — bundled example game.
 * An antarctic research outpost, a storm that eats radio signals, and
 * something in the ice that wears familiar faces. 80s creature-feature
 * isolation in bitsy form: test your friends, fuel the fire, burn it all.
 *
 * 6 rooms · 5 items · a keycard-locked kennel, paranoid alt dialogs,
 * one bad night. Inspired by a certain 1982 winter at outpost 31.
 */
import { blankRoom, frameFromRows } from './defaults';
import { defaultSfxSet } from './sfx';
import type {
  Frame16,
  GameData,
  PaletteSet,
  Room,
  SubPal,
  TileDef,
} from './types';

const F = (rows: string[]): Frame16 => frameFromRows(rows);

// ---------------------------------------------------------------- tiles ----

// corrugated station wall
const metalWall = (): TileDef => ({
  id: 'a',
  name: 'metal wall',
  wall: true,
  frames: [
    F([
      '2222222222222222',
      '1111111111111111',
      '2222222222222222',
      '2222222222222222',
      '1111111111111111',
      '2222222222222222',
      '2222222222222222',
      '1111111111111111',
      '2222222222222222',
      '2222222222222222',
      '1111111111111111',
      '2222222222222222',
      '2222222222222222',
      '1111111111111111',
      '2222222222222222',
      '2222222222222222',
    ]),
  ],
});

// riveted floor plating
const floor = (): TileDef => ({
  id: 'f',
  name: 'floor plate',
  wall: false,
  frames: [
    F([
      '0000000000000000',
      '0100000000000010',
      '0000000000000000',
      '0000000000000000',
      '0000000110000000',
      '0000000110000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000110000000',
      '0000000110000000',
      '0000000000000000',
      '0000000000000000',
      '0100000000000010',
      '0000000000000000',
    ]),
  ],
});

// bunk bed
const bunk = (): TileDef => ({
  id: 'b',
  name: 'bunk',
  wall: true,
  frames: [
    F([
      '0000000000000000',
      '0110000000000110',
      '0110000000000110',
      '0111111111111110',
      '0122222222222210',
      '0123333222222210',
      '0111111111111110',
      '0110000000000110',
      '0110000000000110',
      '0111111111111110',
      '0122222222222210',
      '0123333222222210',
      '0111111111111110',
      '0110000000000110',
      '0110000000000110',
      '0000000000000000',
    ]),
  ],
});

// radio console, blinking status light
const console_ = (): TileDef => ({
  id: 'c',
  name: 'console',
  wall: true,
  frames: [
    F([
      '0000000000000000',
      '0111111111111110',
      '0122222222222210',
      '0121212121212210',
      '0122222222222210',
      '0121212121212210',
      '0122222222222210',
      '0111111111111110',
      '0122222222222210',
      '0123212321232210',
      '0122222222222210',
      '0122132213221210',
      '0122222222222210',
      '0111111111111110',
      '0011000000001100',
      '0011000000001100',
    ]),
    F([
      '0000000000000000',
      '0111111111111110',
      '0122222222222210',
      '0121212121212210',
      '0122222222222210',
      '0121212121212210',
      '0122222222222210',
      '0111111111111110',
      '0122222222222210',
      '0122212221222210',
      '0122222222222210',
      '0122122212221210',
      '0122222222222210',
      '0111111111111110',
      '0011000000001100',
      '0011000000001100',
    ]),
  ],
});

// mess table
const table = (): TileDef => ({
  id: 't',
  name: 'table',
  wall: true,
  frames: [
    F([
      '0000000000000000',
      '0000000000000000',
      '0111111111111110',
      '1222222222222221',
      '1222222222222221',
      '1111111111111111',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

// kennel fence
const fence = (): TileDef => ({
  id: 'e',
  name: 'kennel fence',
  wall: true,
  frames: [
    F([
      '0000000000000000',
      '0110011001100110',
      '0110011001100110',
      '1111111111111111',
      '0110011001100110',
      '0110011001100110',
      '0110011001100110',
      '0110011001100110',
      '1111111111111111',
      '0110011001100110',
      '0110011001100110',
      '0110011001100110',
      '0110011001100110',
      '1111111111111111',
      '0110011001100110',
      '0000000000000000',
    ]),
  ],
});

// jagged ice wall
const iceWall = (): TileDef => ({
  id: 'w',
  name: 'ice wall',
  wall: true,
  frames: [
    F([
      '1111211112111121',
      '1222122221222212',
      '2122212212212221',
      '2212221122122212',
      '1221122212211222',
      '2122212122221221',
      '1222122212212212',
      '2212212122122121',
      '1122122212212212',
      '2212212122121221',
      '1221122211221212',
      '2122212122212122',
      '1222122212122212',
      '2212212121221221',
      '1122122212212122',
      '1211121121112111',
    ]),
  ],
});

// quiet snow, drifting flake
const snow = (): TileDef => ({
  id: 's',
  name: 'snow',
  wall: false,
  frames: [
    F([
      '0000000000000000',
      '0020000000002000',
      '0000000000000000',
      '0000000200000000',
      '0000000000000000',
      '0000000000000020',
      '0200000000000000',
      '0000000000000000',
      '0000002000000000',
      '0000000000000000',
      '0000000000020000',
      '0020000000000000',
      '0000000000000000',
      '0000000020000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    F([
      '0000000000000000',
      '0000000000000000',
      '0020000000002000',
      '0000000000000000',
      '0000000200000000',
      '0000000000000000',
      '0000000000000020',
      '0200000000000000',
      '0000000000000000',
      '0000002000000000',
      '0000000000000000',
      '0000000000020000',
      '0020000000000000',
      '0000000000000000',
      '0000000020000000',
      '0000000000000000',
    ]),
  ],
});

// wind-blasted snow (static — the drifting flakes live in the 's' tile,
// which is animated and rationed to stay under the 32 animated-cell cap)
const blizzard = (): TileDef => ({
  id: 'z',
  name: 'blizzard',
  wall: false,
  frames: [
    F([
      '0200002000200020',
      '0000200002000002',
      '2002000020002000',
      '0020002000200002',
      '0200020000020020',
      '0002000200200000',
      '2000200002000202',
      '0020000200020000',
      '0200202000200020',
      '2000000202000002',
      '0020020000020200',
      '0200200020200000',
      '0002000202000020',
      '2020020000202002',
      '0200200020020020',
      '0020002002000200',
    ]),
  ],
});

// hatch / doorway floor
const hatch = (): TileDef => ({
  id: 'd',
  name: 'hatch',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1000000000000001',
      '1022222222222201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1020000000000201',
      '1022222222222201',
      '1000000000000001',
      '1111111111111111',
    ]),
  ],
});

// -------------------------------------------------------------- drawables ----

const avatarParka = () => ({
  id: 'AVA',
  name: 'macgregor',
  sprPal: 0 as SubPal,
  frames: [
    F([
      '0000011111100000',
      '0000122222210000',
      '0001222222221000',
      '0001223333221000',
      '0001233333321000',
      '0001233133132100',
      '0001233333321000',
      '0000123333210000',
      '0001222222221000',
      '0012222222222100',
      '0012122222121000',
      '0012122222121000',
      '0001222222210000',
      '0000122122100000',
      '0000111011100000',
      '0000000000000000',
    ]),
    F([
      '0000000000000000',
      '0000011111100000',
      '0000122222210000',
      '0001222222221000',
      '0001223333221000',
      '0001233333321000',
      '0001233133132100',
      '0001233333321000',
      '0000123333210000',
      '0001222222221000',
      '0012222222222100',
      '0012122222121000',
      '0001222222210000',
      '0000121121210000',
      '0000111011100000',
      '0000000000000000',
    ]),
  ],
});

const husky = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0110000000001100',
    '0111000000011100',
    '0113100000111000',
    '0111111111110000',
    '0113311111110000',
    '0111111111111000',
    '0011111111111100',
    '0011111111111100',
    '0011011111101100',
    '0011011111101100',
    '0011011111101100',
    '0110011001100110',
    '0000000000000000',
    '0000000000000000',
  ]);

const radioOp = () =>
  F([
    '0000011111100000',
    '0000121111210000',
    '0001211111121000',
    '0001133333110000',
    '0001333333310000',
    '0001331331331000',
    '0001333333310000',
    '0000133113100000',
    '0000122222100000',
    '0001222222210000',
    '0012222222221000',
    '0012122222121000',
    '0001222222210000',
    '0000122122100000',
    '0000110011000000',
    '0000000000000000',
  ]);

const biologist = () =>
  F([
    '0000001111000000',
    '0000013333100000',
    '0000133333310000',
    '0000133133310000',
    '0000133333310000',
    '0000013313100000',
    '0000113333110000',
    '0001222222221000',
    '0012222222222100',
    '0012322222232100',
    '0012322222232100',
    '0001222222221000',
    '0000122222210000',
    '0000122012210000',
    '0000110001100000',
    '0000000000000000',
  ]);

const commander = () =>
  F([
    '0000011111100000',
    '0000111111110000',
    '0001111111111000',
    '0001133333110000',
    '0001333333310000',
    '0001331331331000',
    '0001333333310000',
    '0000133333100000',
    '0000123331000000',
    '0001222222210000',
    '0012222222221000',
    '0012122222121000',
    '0001222222210000',
    '0000122122100000',
    '0000110011000000',
    '0000000000000000',
  ]);

// the shape thawing out of the ice
const frozenShape = () => [
  F([
    '0011111111111100',
    '0111111111111110',
    '0111122221111110',
    '0111233332111110',
    '0111232232111110',
    '0111233332111110',
    '0111122221211110',
    '0111212122121110',
    '0111121221211110',
    '0111212112121110',
    '0111121221212110',
    '0111112112121110',
    '0111121221211110',
    '0111111111111110',
    '0011111111111100',
    '0000000000000000',
  ]),
  F([
    '0011111111111100',
    '0111111111111110',
    '0111122221111110',
    '0111233332111110',
    '0111223322111110',
    '0111233332111110',
    '0111122221211110',
    '0111212122121110',
    '0111121221211110',
    '0111212112121110',
    '0111121221212110',
    '0111112112121110',
    '0111121221211110',
    '0111111111111110',
    '0011111111111100',
    '0000000000000000',
  ]),
];

// ----- items -----

const testKit = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000111111110000',
    '0001222222221000',
    '0001232323221000',
    '0001222222221000',
    '0001222222221000',
    '0000111111110000',
    '0000001221000000',
    '0000001221000000',
    '0000001331000000',
    '0000001331000000',
    '0000000110000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const keycard = () =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000111111110000',
    '0001222222221000',
    '0001233222221000',
    '0001233222221000',
    '0001222222221000',
    '0001222112221000',
    '0001222112221000',
    '0000111111110000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const fuelCan = () =>
  F([
    '0000000000000000',
    '0000011111000000',
    '0000012221000000',
    '0000011111000000',
    '0001111111111000',
    '0012222222222100',
    '0012223322222100',
    '0012232232222100',
    '0012232232222100',
    '0012223322222100',
    '0012222222222100',
    '0012222222222100',
    '0001111111111000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const flare = () =>
  F([
    '0000000000000000',
    '0000000330000000',
    '0000003333000000',
    '0000033333300000',
    '0000003333000000',
    '0000000330000000',
    '0000000220000000',
    '0000000220000000',
    '0000000220000000',
    '0000000220000000',
    '0000000220000000',
    '0000000110000000',
    '0000000110000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const bottle = () =>
  F([
    '0000000000000000',
    '0000000110000000',
    '0000000110000000',
    '0000000110000000',
    '0000001111000000',
    '0000012222100000',
    '0000012222100000',
    '0000012332100000',
    '0000012332100000',
    '0000012222100000',
    '0000012222100000',
    '0000001111000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

// -------------------------------------------------------------- palettes ----

const SPR: PaletteSet['spr'] = [
  [0x07, 0x27, 0x30], // 0: parka crew (dark trim, orange coat, white)
  [0x00, 0x10, 0x30], // 1: husky / frozen shape grays
  [0x06, 0x16, 0x30], // 2: reds (kit, flare, fuel, the thing)
  [0x01, 0x21, 0x30], // 3: cold blues
];

const palettes = (): PaletteSet[] => [
  {
    id: '0',
    name: 'station',
    backdrop: 0x0f,
    bg: [
      [0x00, 0x10, 0x20], // metal grays
      [0x07, 0x17, 0x27], // bunk browns
      [0x01, 0x11, 0x2b], // console blues + readout green
      [0x06, 0x16, 0x26], // warning reds
    ],
    spr: SPR,
  },
  {
    id: '1',
    name: 'ice',
    backdrop: 0x0c,
    bg: [
      [0x01, 0x11, 0x21], // deep ice blues
      [0x10, 0x21, 0x30], // driven snow
      [0x00, 0x10, 0x20], // metal
      [0x06, 0x16, 0x26],
    ],
    spr: SPR,
  },
  {
    id: '2',
    name: 'kennel',
    backdrop: 0x0f,
    bg: [
      [0x00, 0x10, 0x20], // metal
      [0x08, 0x18, 0x28], // straw / fence browns
      [0x01, 0x11, 0x21], // ice seeping in
      [0x06, 0x16, 0x26],
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

export function theThing(): GameData {
  // ---- room 0: BUNKS ----
  const bunks = painter('0', '0');
  bunks.room.name = 'bunks';
  bunks.border('a');
  bunks.room.tiles = bunks.room.tiles.map((t) => (t === '0' ? 'f' : t));
  bunks.col(2, 2, 3, 'b');
  bunks.col(2, 6, 7, 'b');
  bunks.col(2, 10, 11, 'b');
  bunks.col(13, 2, 3, 'b');
  bunks.col(13, 6, 7, 'b');
  bunks.put(15, 7, 'd'); // east hatch -> corridor
  bunks.palAt('b', 1);
  bunks.palAt('d', 0);
  bunks.room.exits.push({ x: 15, y: 7, destRoom: '1', destX: 1, destY: 7 });
  bunks.room.items.push({ itemId: 'y', x: 13, y: 11 });

  // ---- room 1: RADIO ROOM (hub corridor) ----
  const radio = painter('1', '0');
  radio.room.name = 'radio room';
  radio.border('a');
  radio.room.tiles = radio.room.tiles.map((t) => (t === '0' ? 'f' : t));
  radio.row(1, 5, 10, 'c'); // radio wall
  radio.put(0, 7, 'd'); // west -> bunks
  radio.put(15, 7, 'd'); // east -> mess
  radio.put(7, 14, 'd'); // south -> lab
  radio.put(3, 0, 'd'); // north hatch -> kennel (keycard)
  radio.palAt('c', 2);
  radio.room.exits.push(
    { x: 0, y: 7, destRoom: '0', destX: 14, destY: 7 },
    { x: 15, y: 7, destRoom: '2', destX: 1, destY: 7 },
    { x: 7, y: 14, destRoom: '3', destX: 7, destY: 1 },
    {
      x: 3,
      y: 0,
      destRoom: '4',
      destX: 3,
      destY: 13,
      req: { kind: 'item', itemId: 'y', negate: false },
      lockedDlgId: 'n',
    },
  );

  // ---- room 2: MESS HALL ----
  const mess = painter('2', '0');
  mess.room.name = 'mess hall';
  mess.border('a');
  mess.room.tiles = mess.room.tiles.map((t) => (t === '0' ? 'f' : t));
  mess.row(5, 5, 10, 't');
  mess.row(9, 5, 10, 't');
  mess.put(0, 7, 'd'); // west -> radio room
  mess.palAt('t', 1);
  mess.room.exits.push({ x: 0, y: 7, destRoom: '1', destX: 14, destY: 7 });
  mess.room.items.push({ itemId: 'l', x: 12, y: 3 }, { itemId: 'j', x: 8, y: 7 });

  // ---- room 3: LAB ----
  const lab = painter('3', '0');
  lab.room.name = 'lab';
  lab.border('a');
  lab.room.tiles = lab.room.tiles.map((t) => (t === '0' ? 'f' : t));
  lab.row(13, 4, 11, 'c');
  lab.put(7, 0, 'd'); // north -> radio room
  lab.palAt('c', 2);
  lab.room.exits.push({ x: 7, y: 0, destRoom: '1', destX: 7, destY: 13 });
  lab.room.items.push({ itemId: 'k', x: 3, y: 11 });

  // ---- room 4: KENNEL ----
  const kennel = painter('4', '2');
  kennel.room.name = 'kennel';
  kennel.border('a');
  kennel.room.tiles = kennel.room.tiles.map((t) => (t === '0' ? 'f' : t));
  kennel.row(4, 2, 13, 'e');
  kennel.col(2, 5, 10, 'e');
  kennel.col(13, 5, 10, 'e');
  kennel.row(10, 2, 13, 'e');
  kennel.put(7, 10, 'f'); // pen gate, torn open
  kennel.put(11, 0, 'z'); // ripped wall -> the ice
  kennel.put(3, 14, 'd'); // south hatch -> radio room
  kennel.palAt('e', 1);
  kennel.palAt('z', 2);
  kennel.room.exits.push(
    { x: 3, y: 14, destRoom: '1', destX: 3, destY: 1 },
    { x: 11, y: 0, destRoom: '5', destX: 11, destY: 13 },
  );
  kennel.room.items.push({ itemId: 'u', x: 12, y: 12 });

  // ---- room 5: THE ICE ----
  const ice = painter('5', '1');
  ice.room.name = 'the ice';
  ice.border('w');
  ice.room.tiles = ice.room.tiles.map((t) => (t === '0' ? 'z' : t));
  for (const [x, y] of [
    [4, 3],
    [12, 5],
    [3, 9],
    [9, 11],
    [13, 10],
  ] as const)
    ice.put(x, y, 'w');
  ice.row(4, 6, 9, 's'); // the dig site: quiet snow around the crater
  ice.row(5, 6, 9, 's');
  ice.put(11, 14, 'z'); // back to the kennel
  ice.palAt('s', 1);
  ice.room.exits.push({ x: 11, y: 14, destRoom: '4', destX: 11, destY: 1 });
  ice.room.endings.push({
    x: 7,
    y: 4,
    dlgId: 'e',
    req: { kind: 'item', itemId: 'u', negate: false },
    lockedDlgId: 'm',
  });

  // ---- assemble ----
  return {
    title: 'WHO GOES THERE?',
    version: 1,
    startRoom: '0',
    startX: 5,
    startY: 7,
    textSpeed: 'normal',
    font: 'thin',
    palettes: palettes(),
    tiles: [
      metalWall(),
      floor(),
      bunk(),
      console_(),
      table(),
      fence(),
      iceWall(),
      snow(),
      blizzard(),
      hatch(),
    ],
    sprites: [
      {
        id: 'R',
        name: 'radio op',
        frames: [radioOp()],
        sprPal: 0,
        dlgId: 'c',
        room: '1',
        x: 7,
        y: 2,
      },
      {
        id: 'M',
        name: 'commander',
        frames: [commander()],
        sprPal: 0,
        dlgId: 'a',
        altCond: { kind: 'item', itemId: 'u', negate: false },
        altDlgId: 'b',
        room: '2',
        x: 7,
        y: 3,
      },
      {
        id: 'B',
        name: 'biologist',
        frames: [biologist()],
        sprPal: 3,
        dlgId: 'd',
        altCond: { kind: 'item', itemId: 'k', negate: false },
        altDlgId: 'g',
        room: '3',
        x: 10,
        y: 6,
      },
      {
        id: 'D',
        name: 'husky',
        frames: [husky()],
        sprPal: 1,
        dlgId: 'h',
        room: '4',
        x: 6,
        y: 7,
      },
      {
        id: 'C',
        name: 'the shape',
        frames: frozenShape(),
        sprPal: 1,
        dlgId: 'i',
        room: '5',
        x: 7,
        y: 3,
      },
    ],
    items: [
      { id: 'y', name: 'keycard', frames: [keycard()], sprPal: 3, dlgId: 'v' },
      { id: 'k', name: 'test kit', frames: [testKit()], sprPal: 2, dlgId: 'p' },
      { id: 'l', name: 'flare', frames: [flare()], sprPal: 2, dlgId: 'q' },
      { id: 'u', name: 'fuel can', frames: [fuelCan()], sprPal: 2, dlgId: 'r' },
      { id: 'j', name: 'bottle', frames: [bottle()], sprPal: 3, dlgId: 's' },
    ],
    flags: [],
    variables: [],
    rooms: [bunks.room, radio.room, mess.room, lab.room, kennel.room, ice.room],
    dialogs: {
      a: 'COMMANDER: NOBODY LEAVES. NOBODY SLEEPS. NOT UNTIL WE KNOW WHO IS STILL HUMAN.',
      b: 'COMMANDER: FUEL? GOOD. IF IT MOVES OUT THERE, YOU BURN IT. BURN ALL OF IT.',
      c: 'RADIO OP: RADIO IS DEAD. THE STORM EATS EVERY SIGNAL. WE ARE ALONE DOWN HERE.',
      d: 'BIOLOGIST: I AM FINE. WHY IS EVERYONE LOOKING AT ME LIKE THAT?',
      g: 'BIOLOGIST: KEEP THAT NEEDLE AWAY FROM ME. I SAID I AM FINE.',
      h: 'THE HUSKY STARES PAST YOU AT THE DOOR. IT HAS NOT BARKED IN THREE DAYS.',
      i: 'THE ICE IS CRACKED OPEN FROM THE INSIDE. WHATEVER THE DIG TEAM FOUND... IT LEFT.',
      v: 'A KENNEL KEYCARD, STILL WARM. SOMEBODY DROPPED IT RUNNING.',
      p: 'A BLOOD TEST KIT. ONE HOT NEEDLE TELLS YOU WHO IS REAL.',
      q: 'A FLARE. RED LIGHT FOR A WHITE NIGHT.',
      r: 'A FUEL CAN, HEAVY AND SLOSHING. ENOUGH TO LIGHT UP THE DARK.',
      s: 'SOMEONE LEFT THE BOTTLE HALF FULL. THAT IS NOT LIKE THEM AT ALL.',
      n: 'THE KENNEL HATCH IS SEALED. THE LOCK WANTS A KEYCARD.',
      m: 'THE CRATER BREATHES. NOT YET. YOU NEED SOMETHING THAT BURNS.',
      e: 'YOU EMPTY THE CAN INTO THE CRATER AND DROP THE FLARE. THE NIGHT GOES ORANGE. IF ANY OF IT IS STILL YOU, LET IT END HERE. THE END.',
    },
    avatar: avatarParka(),
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [],
  };
}
