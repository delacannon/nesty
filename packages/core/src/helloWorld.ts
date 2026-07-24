/**
 * HELLO WORLD QUEST — bundled example game and feature tour.
 * The Greeting that wakes the realm each morning has been forgotten. Find the
 * two Rune Words (HELLO and WORLD), tame the cave wolf with a bone, let the
 * fairy weave a bridge for three sunherbs, unlock the castle gate and speak
 * the Greeting from the throne.
 *
 * Uses every engine feature: 5 rooms, 5 transitions (scroll/fade/diag/
 * curtain/blinds), 3 songs, flags, a variable, counters, step-on events
 * (once + conditional), tile overlays (bridge, gate), conditional sprites
 * and items, sprite anim switching, alt dialogs, text FX ([col1]/[wave]/
 * [blink]/[cycle]) and THE END screen.
 */
import { blankRoom, frameFromRows } from './defaults';
import { defaultSfxSet } from './sfx';
import { fieldSong, townSong, type Song } from './song';
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

const stoneWall = (): TileDef => ({
  id: 'a',
  name: 'stone wall',
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

const path = (): TileDef => ({
  id: 'p',
  name: 'path',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1222222222222221',
      '1222122222212221',
      '1222222222222221',
      '1222222122222221',
      '1221222222221221',
      '1222222222222221',
      '1222221222122221',
      '1222222222222221',
      '1212222222222121',
      '1222222212222221',
      '1222122222222221',
      '1222222222212221',
      '1222222122222221',
      '1222222222222221',
      '1111111111111111',
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
      '0001112222111000',
      '0011222222221100',
      '0112222112222110',
      '0122221221222210',
      '1222212222122221',
      '1222122222212221',
      '1122222112222211',
      '0112221221222110',
      '0011222222221100',
      '0001112332111000',
      '0000001331000000',
      '0000001331000000',
      '0000013333100000',
      '0000133333310000',
      '0000000000000000',
    ]),
  ],
});

const flower = (): TileDef => ({
  id: 'f',
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

const water = (): TileDef => ({
  id: 'w',
  name: 'river water',
  wall: true, // uncrossable without the fairy bridge overlay
  frames: [
    F([
      '2222222222222222',
      '2222222222222222',
      '2232222322222232',
      '2222222222222222',
      '2222232222232222',
      '2222222222222222',
      '2322222232222223',
      '2222222222222222',
      '2222223222223222',
      '2222222222222222',
      '2232222222322222',
      '2222222222222222',
      '2222232222222322',
      '2222222222222222',
      '2223222223222222',
      '2222222222222222',
    ]),
    F([
      '2222222222222222',
      '2222222222222222',
      '2222232222232222',
      '2222222222222222',
      '2232222322222232',
      '2222222222222222',
      '2222223222223222',
      '2222222222222222',
      '2322222232222223',
      '2222222222222222',
      '2222232222222322',
      '2222222222222222',
      '2232222222322222',
      '2222222222222222',
      '2222222322222232',
      '2222222222222222',
    ]),
  ],
});

const bridge = (): TileDef => ({
  id: 'b',
  name: 'light bridge',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1333333333333331',
      '1222222222222221',
      '1333333333333331',
      '1222222222222221',
      '1333333333333331',
      '1222222222222221',
      '1333333333333331',
      '1222222222222221',
      '1333333333333331',
      '1222222222222221',
      '1333333333333331',
      '1222222222222221',
      '1333333333333331',
      '1222222222222221',
      '1111111111111111',
    ]),
  ],
});

const caveRock = (): TileDef => ({
  id: 'c',
  name: 'cave rock',
  wall: true,
  frames: [
    F([
      '0011111111111100',
      '0122222222222210',
      '1222212222122221',
      '1222222222222221',
      '1221222212222121',
      '1222222222222221',
      '1222221222212221',
      '1212222222222121',
      '1222222122222221',
      '1222122222212221',
      '1222222222222221',
      '1221222212222121',
      '1222222222222221',
      '1222212222122221',
      '0122222222222210',
      '0011111111111100',
    ]),
  ],
});

const caveFloor = (): TileDef => ({
  id: 'd',
  name: 'cave floor',
  wall: false,
  frames: [
    F([
      '0000000000000000',
      '0000000000000000',
      '0001000000000000',
      '0000000000010000',
      '0000000000000000',
      '0000000100000000',
      '0000000000000000',
      '0010000000000100',
      '0000000000000000',
      '0000000010000000',
      '0000000000000000',
      '0001000000000010',
      '0000000000000000',
      '0000001000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

const castleWall = (): TileDef => ({
  id: 'e',
  name: 'castle wall',
  wall: true,
  frames: [
    F([
      '1111111111111111',
      '1223122231222312',
      '1222122221222212',
      '1111111111111111',
      '2312223122231222',
      '2212222122221222',
      '1111111111111111',
      '1223122231222312',
      '1222122221222212',
      '1111111111111111',
      '2312223122231222',
      '2212222122221222',
      '1111111111111111',
      '1223122231222312',
      '1222122221222212',
      '1111111111111111',
    ]),
  ],
});

const castleFloor = (): TileDef => ({
  id: 'q',
  name: 'flagstone',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1222222212222222',
      '1222222212222222',
      '1222222212222222',
      '1222222212222222',
      '1222222212222222',
      '1222222212222222',
      '1111111111111111',
      '2222122222221222',
      '2222122222221222',
      '2222122222221222',
      '2222122222221222',
      '2222122222221222',
      '2222122222221222',
      '2222122222221222',
      '1111111111111111',
    ]),
  ],
});

const carpet = (): TileDef => ({
  id: 'r',
  name: 'royal carpet',
  wall: false,
  frames: [
    F([
      '1222222222222221',
      '1233333333333321',
      '1232222222222321',
      '1232333333332321',
      '1232322222232321',
      '1232323333232321',
      '1232322222232321',
      '1232333333332321',
      '1232222222222321',
      '1233333333333321',
      '1232222222222321',
      '1232333333332321',
      '1232322222232321',
      '1232333333332321',
      '1232222222222321',
      '1233333333333321',
    ]),
  ],
});

const runePlate = (): TileDef => ({
  id: 'u',
  name: 'rune plate',
  wall: false,
  frames: [
    F([
      '0111111111111110',
      '1222222222222221',
      '1223333333333221',
      '1223222222232221',
      '1223233333232221',
      '1223232223232221',
      '1223232323232221',
      '1223232323232221',
      '1223232323232221',
      '1223232223232221',
      '1223233333232221',
      '1223222222232221',
      '1223333333333221',
      '1222222222222221',
      '0111111111111110',
      '0000000000000000',
    ]),
  ],
});

const well = (): TileDef => ({
  id: 'l',
  name: 'village well',
  wall: true,
  frames: [
    F([
      '0000111111110000',
      '0001222222221000',
      '0012211111122100',
      '0122122222212210',
      '0122123333212210',
      '0122123333212210',
      '0122122222212210',
      '0012211111122100',
      '0001222222221000',
      '0011111111111100',
      '0122222222222210',
      '1222111111112221',
      '1221222222212221',
      '1221222222212221',
      '1222111111112221',
      '0111111111111110',
    ]),
  ],
});

const torch = (): TileDef => ({
  id: 'o',
  name: 'wall torch',
  wall: true,
  frames: [
    F([
      '0000000330000000',
      '0000003333000000',
      '0000033333300000',
      '0000033233300000',
      '0000003223000000',
      '0000000220000000',
      '0000001111000000',
      '0000012222100000',
      '0000001221000000',
      '0000000110000000',
      '0000000110000000',
      '0000000110000000',
      '0000001111000000',
      '0000011111100000',
      '0000000000000000',
      '0000000000000000',
    ]),
    F([
      '0000003300000000',
      '0000033330000000',
      '0000333333000000',
      '0000332333300000',
      '0000032230000000',
      '0000002200000000',
      '0000001111000000',
      '0000012222100000',
      '0000001221000000',
      '0000000110000000',
      '0000000110000000',
      '0000000110000000',
      '0000001111000000',
      '0000011111100000',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

// -------------------------------------------------------------- sprites ----

// chibi JRPG hero: spiky fringe with hair-shine, big anime eyes, trimmed tunic
const heroFrames = (): Frame16[] => [
  F([
    '0000011111000000',
    '0000111111100000',
    '0001111111110000',
    '0011113311110000',
    '0011331133110000',
    '0011222222110000',
    '0011211211210000',
    '0011222222110000',
    '0001221221100000',
    '0000112211000000',
    '0001122222110000',
    '0011222222221000',
    '0011322222231000',
    '0001122112211000',
    '0000110000110000',
    '0000111000111000',
  ]),
  F([
    '0000011111000000',
    '0000111111100000',
    '0001111111110000',
    '0011113311110000',
    '0011331133110000',
    '0011222222110000',
    '0011211211210000',
    '0011222222110000',
    '0001221221100000',
    '0000112211000000',
    '0001122222110000',
    '0011222222221000',
    '0011322222231000',
    '0001122112211000',
    '0000011001100000',
    '0000111001110000',
  ]),
];

// robed elder with a long flowing beard and hooded brow
const elderFrame = (): Frame16 =>
  F([
    '0000001111000000',
    '0000011111100000',
    '0000133333100000',
    '0001333333310000',
    '0001322322310000',
    '0001333333310000',
    '0000132223100000',
    '0000013333100000',
    '0000113113100000',
    '0001113311110000',
    '0011113311111000',
    '0011113311111000',
    '0001113311110000',
    '0000113311100000',
    '0000013331000000',
    '0000011111000000',
  ]);

// big-eyed anime fairy, gossamer wings flapping between the two frames
const fairyFrames = (): Frame16[] => [
  F([
    '0000000110000000',
    '0002001111002000',
    '0022013333120220',
    '0222133223312220',
    '0222133333312220',
    '0022213333122200',
    '0000021331200000',
    '0000002112000000',
    '0000021111200000',
    '0000211111120000',
    '0002211111122000',
    '0000021111200000',
    '0000002112000000',
    '0000000110000000',
    '0000000000000000',
    '0000000000000000',
  ]),
  F([
    '0000000110000000',
    '0020001111000200',
    '0022013333120220',
    '0222133223312220',
    '0222133333312220',
    '0222213333122220',
    '0000021331200000',
    '0000002112000000',
    '0000021111200000',
    '0000211111120000',
    '0002211111122000',
    '0000021111200000',
    '0000002112000000',
    '0000000110000000',
    '0000000000000000',
    '0000000000000000',
  ]),
];

// leaner, fiercer wolf: pricked ears, bared fangs, four planted paws
const wolfFrame = (): Frame16 =>
  F([
    '0000000000000000',
    '0110000000011000',
    '1221000000012210',
    '1222100000122210',
    '0122210001222210',
    '0012222222232210',
    '0001222222233210',
    '0001222222222100',
    '0012222222222100',
    '0012222222221000',
    '0012112221121000',
    '0011011011011000',
    '0011011011011000',
    '0011000000011000',
    '0000000000000000',
    '0000000000000000',
  ]);

// ethereal river spirit: glowing eyes, robe dissolving into wisps
const spiritFrame = (): Frame16 =>
  F([
    '0000001111000000',
    '0000013333100000',
    '0000133333310000',
    '0001332332331000',
    '0001333333331000',
    '0001333333331000',
    '0000133333310000',
    '0000113333110000',
    '0011333333331100',
    '0011333333331100',
    '0011333333331100',
    '0001333333331000',
    '0000133113310000',
    '0000013301330000',
    '0000001100110000',
    '0000000000000000',
  ]);

const kingFrames = (): Frame16[] => [
  // seated on the throne, tall jewelled crown, arms down
  F([
    '0000232323200000',
    '0002323232320000',
    '0000133333100000',
    '0001333333310000',
    '0001322322310000',
    '0001333333310000',
    '0000133333100000',
    '0000111111100000',
    '0001122222110000',
    '0011122222111000',
    '0011122222111000',
    '0001122222110000',
    '0001122222110000',
    '0011111111111000',
    '0011000000110000',
    '0011000000110000',
  ]),
  // risen, arms flung wide for the Greeting
  F([
    '0020232323202000',
    '0202323232320200',
    '0020133333102000',
    '0200133333310020',
    '0200132232310020',
    '0020133333310200',
    '0000133333100000',
    '0000111111100000',
    '0011122222110000',
    '0111122222111100',
    '1111122222111110',
    '0001122222110000',
    '0001122222110000',
    '0011111111111000',
    '0011000000110000',
    '0011000000110000',
  ]),
];

// ------------------------------------------------------- item sprites ----

const itemHerb = (): Frame16 =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000020002000000',
    '0000212021200000',
    '0000021212000000',
    '0000002120000000',
    '0000212021200000',
    '0000021212000000',
    '0000002120000000',
    '0000000100000000',
    '0000000100000000',
    '0000000100000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemBone = (): Frame16 =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0011000000001100',
    '0122100000012210',
    '0122211111122210',
    '0012222222222100',
    '0122211111122210',
    '0122100000012210',
    '0011000000001100',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemKey = (): Frame16 =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000011110000000',
    '0000122221000000',
    '0000120021000000',
    '0000122221000000',
    '0000011110000000',
    '0000001100000000',
    '0000001100000000',
    '0000001110000000',
    '0000001100000000',
    '0000001110000000',
    '0000001100000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const itemGem = (): Frame16 =>
  F([
    '0000000000000000',
    '0000000000000000',
    '0000001111000000',
    '0000013333100000',
    '0000133223310000',
    '0001332222331000',
    '0001322222231000',
    '0001322222231000',
    '0000132222310000',
    '0000013223100000',
    '0000001331000000',
    '0000000110000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

// -------------------------------------------------------------- palettes ----

const SPR: PaletteSet['spr'] = [
  [0x16, 0x27, 0x30], // 0: hero — red-brown outline, warm skin, white
  [0x01, 0x21, 0x30], // 1: fairy/spirit — deep blue, sky, white
  [0x07, 0x17, 0x27], // 2: elder/wolf/bone — browns
  [0x17, 0x28, 0x30], // 3: king/key/gem — brown, gold, white
];

const palettes = (): PaletteSet[] => [
  {
    id: '0',
    name: 'village',
    backdrop: 0x0b,
    bg: [
      [0x09, 0x19, 0x1a], // grass greens
      [0x0f, 0x15, 0x30], // flowers
      [0x00, 0x10, 0x20], // stone grays (walls, well, cobble path)
      [0x08, 0x18, 0x28], // browns (unused by large areas: subpal 3 is
      // hijacked by the dialog palette while a dialog is open)
    ],
    spr: SPR,
  },
  {
    id: '1',
    name: 'meadow',
    backdrop: 0x0b,
    bg: [
      [0x09, 0x19, 0x1a], // greens
      [0x0f, 0x16, 0x30], // flowers, red petals
      [0x08, 0x18, 0x28], // earth
      [0x09, 0x29, 0x30], // sunherbs bright
    ],
    spr: SPR,
  },
  {
    id: '2',
    name: 'cave',
    backdrop: 0x0f,
    bg: [
      [0x0c, 0x1c, 0x2c], // cold blue-gray stone
      [0x03, 0x13, 0x23], // purple glow rocks
      [0x08, 0x18, 0x28], // browns
      [0x09, 0x19, 0x1a],
    ],
    spr: SPR,
  },
  {
    id: '3',
    name: 'river',
    backdrop: 0x0b,
    bg: [
      [0x09, 0x19, 0x1a], // banks
      [0x01, 0x11, 0x21], // water blues
      [0x17, 0x28, 0x30], // light bridge, golden
      [0x0f, 0x15, 0x30], // flowers
    ],
    spr: SPR,
  },
  {
    id: '4',
    name: 'castle',
    backdrop: 0x0f,
    bg: [
      [0x07, 0x17, 0x28], // gold stone
      [0x06, 0x16, 0x26], // royal carpet reds
      [0x07, 0x17, 0x28], // torch browns + flame
      [0x01, 0x21, 0x2c], // rune glow blues
    ],
    spr: SPR,
  },
];

// ----------------------------------------------------------------- song ----

/** Slow minor drips for the wolf cave (original composition). */
function caveSong(): Song {
  const steps = (v: number[]) => v;
  return {
    id: 'cave',
    name: 'wolf cave',
    bpm: 66,
    root: 57,
    scale: 'minor',
    lead: { duty: 0, decay: 6, octave: 1 },
    melody: { duty: 0, decay: 12, octave: 0 },
    bassOctave: -1,
    drumDecay: 6,
    drumMode: 1,
    patterns: [
      {
        melody: steps([1, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0]),
        bass: steps([1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0]),
      },
      {
        melody: steps([3, 0, 0, 0, 5, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0]),
        bass: steps([4, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 1, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 14, 0, 0, 0]),
      },
    ],
    order: [0, 0, 1, 0],
  };
}

// ------------------------------------------------------------- room build ----

interface Painter {
  room: Room;
  put: (x: number, y: number, id: string) => void;
  row: (y: number, x0: number, x1: number, id: string) => void;
  col: (x: number, y0: number, y1: number, id: string) => void;
  border: (id: string) => void;
  fill: (id: string) => void;
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
  const fill = (tid: string) => {
    room.tiles = room.tiles.map((t) => (t === '0' ? tid : t));
  };
  const palAt = (tid: string, sub: SubPal) => {
    room.tiles.forEach((t, i) => {
      if (t === tid) room.pmap[i] = sub;
    });
  };
  return { room, put, row, col, border, fill, palAt };
}

// ------------------------------------------------------------------ game ----

export function helloWorld(): GameData {
  // ---- room 0: VILLAGE OF MORNINGVALE ----
  const village = painter('0', '0');
  village.room.name = 'village';
  village.room.songId = 'town';
  village.border('a');
  // two stone houses
  for (const [x, y] of [
    [2, 2],
    [3, 2],
    [2, 3],
    [3, 3],
    [12, 2],
    [13, 2],
    [12, 3],
    [13, 3],
  ] as const)
    village.put(x, y, 'a');
  village.row(7, 1, 14, 'p'); // east road
  village.col(7, 8, 13, 'p'); // road to the square
  village.put(4, 9, 'l'); // the well
  for (const [x, y] of [
    [10, 10],
    [2, 12],
    [13, 11],
    [10, 3],
  ] as const)
    village.put(x, y, 'f');
  village.fill('s');
  village.palAt('a', 2);
  village.palAt('f', 1);
  village.palAt('p', 2);
  village.palAt('l', 2);
  village.room.exits.push({
    x: 15,
    y: 7,
    destRoom: '1',
    destX: 1,
    destY: 7,
    transition: 'scroll',
  });
  village.room.items.push({ itemId: 'n', x: 3, y: 10 });
  // a second sunherb tucked in the far corner of the village square
  village.room.items.push({ itemId: 'h', x: 11, y: 11 });

  // ---- room 1: SUNHERB MEADOW ----
  const meadow = painter('1', '1');
  meadow.room.name = 'meadow';
  meadow.room.songId = 'field';
  meadow.border('t');
  meadow.put(0, 7, 's'); // west gap -> village
  meadow.put(15, 7, 's'); // east gap -> river
  meadow.put(7, 0, 's'); // north gap -> cave
  for (const [x, y] of [
    [5, 4],
    [10, 9],
    [12, 5],
    [3, 8],
  ] as const)
    meadow.put(x, y, 't');
  for (const [x, y] of [
    [3, 3],
    [12, 11],
    [4, 12],
    [11, 2],
    [2, 10],
  ] as const)
    meadow.put(x, y, 'f');
  meadow.fill('s');
  meadow.palAt('f', 1);
  meadow.room.exits.push(
    { x: 0, y: 7, destRoom: '0', destX: 14, destY: 7, transition: 'scroll' },
    { x: 15, y: 7, destRoom: '3', destX: 1, destY: 7, transition: 'scroll' },
    { x: 7, y: 0, destRoom: '2', destX: 7, destY: 13, transition: 'fade' },
  );
  // only one of the three sunherbs grows here now — the others are hidden
  // across the realm, so the bridge (needs 3) forces real exploration
  meadow.room.items.push({ itemId: 'h', x: 3, y: 4 });
  // welcome plate just inside the meadow — fires once when stepped on
  // (one cell east of the entry landing: landing on a cell does not trigger it)
  meadow.room.events.push({
    x: 2,
    y: 7,
    once: true,
    actions: [{ type: 'showDialog', dlgId: 'm1' }],
  });

  // ---- room 2: WOLF CAVE ----
  const cave = painter('2', '2');
  cave.room.name = 'cave';
  cave.room.songId = 'cave';
  cave.border('c');
  // narrow single-file corridor: the ONLY way to the key chamber runs up
  // column 7 past the wolf. Walls seal rows 1..9 so the top can't be
  // reached by skirting around the side — you must tame the wolf first.
  cave.col(6, 1, 9, 'c');
  cave.col(8, 1, 9, 'c');
  for (const [x, y] of [
    [3, 4],
    [12, 5],
    [4, 11],
    [11, 11],
    [2, 8],
    [13, 9],
  ] as const)
    cave.put(x, y, 'c');
  cave.fill('d');
  cave.palAt('c', 0);
  // glow on the corridor rocks
  cave.room.pmap[2 * 16 + 6] = 1;
  cave.room.pmap[2 * 16 + 8] = 1;
  cave.room.pmap[9 * 16 + 6] = 1;
  cave.room.pmap[9 * 16 + 8] = 1;
  cave.room.exits.push({
    x: 7,
    y: 14,
    destRoom: '1',
    destX: 7,
    destY: 1,
    transition: 'diag',
  });
  cave.room.items.push({ itemId: 'k', x: 7, y: 2 });
  // the third sunherb grows in the sealed chamber — you only reach it by
  // taming the wolf, so the river bridge can't be built before the cave is won
  cave.room.items.push({ itemId: 'h', x: 7, y: 4 });
  // toss the bone from the corridor mouth — tames the wolf (hides the sprite)
  cave.room.events.push({
    x: 7,
    y: 9,
    once: true,
    cond: { kind: 'item', itemId: 'n', negate: false },
    actions: [
      { type: 'setFlag', flagId: 't' },
      { type: 'showDialog', dlgId: 'c2' },
    ],
  });

  // ---- room 3: GLIMMER RIVER ----
  const river = painter('3', '3');
  river.room.name = 'river';
  river.room.songId = 'field';
  river.border('t');
  river.put(0, 7, 's'); // west gap -> meadow
  river.put(15, 7, 's'); // east gap -> castle
  river.col(8, 1, 13, 'w');
  river.col(9, 1, 13, 'w');
  for (const [x, y] of [
    [3, 3],
    [4, 11],
    [12, 12],
  ] as const)
    river.put(x, y, 'f');
  river.fill('s');
  river.palAt('w', 1);
  river.palAt('f', 1);
  river.room.exits.push(
    { x: 0, y: 7, destRoom: '1', destX: 14, destY: 7, transition: 'scroll' },
    { x: 15, y: 7, destRoom: '4', destX: 1, destY: 7, transition: 'curtain' },
  );
  // the fairy's bridge of light spans the river once you carry 3 sunherbs
  river.room.overlays.push(
    {
      x: 8,
      y: 7,
      tileId: 'b',
      cond: { kind: 'count', itemId: 'h', cmp: '>=', value: 3 },
    },
    {
      x: 9,
      y: 7,
      tileId: 'b',
      cond: { kind: 'count', itemId: 'h', cmp: '>=', value: 3 },
    },
  );
  // the river spirit's gift appears only after the wolf is tamed
  river.room.items.push({
    itemId: 'j',
    x: 12,
    y: 10,
    appearCond: { kind: 'flag', flagId: 't', negate: false },
  });

  // ---- room 4: CASTLE OF DAWN ----
  const castle = painter('4', '4');
  castle.room.name = 'castle';
  castle.room.songId = 'town';
  castle.border('e');
  castle.put(4, 2, 'o'); // wall torches by the throne
  castle.put(11, 2, 'o');
  castle.row(5, 1, 14, 'e'); // gate wall...
  castle.put(7, 5, 'q'); // ...with an arch (sealed by an overlay until the key)
  castle.put(4, 8, 'u'); // rune plates
  castle.put(11, 8, 'u');
  castle.col(7, 6, 13, 'r'); // carpet to the gate
  castle.row(7, 1, 6, 'q'); // entry hall floor
  castle.row(7, 8, 14, 'q');
  castle.col(7, 1, 4, 'r'); // carpet to the throne
  castle.fill('q');
  castle.palAt('e', 0);
  castle.palAt('r', 1);
  castle.palAt('o', 2);
  castle.palAt('u', 2);
  castle.room.exits.push({
    x: 0,
    y: 7,
    destRoom: '3',
    destX: 14,
    destY: 7,
    transition: 'blinds',
  });
  // gate arch sealed while the player lacks the key
  castle.room.overlays.push({
    x: 7,
    y: 5,
    tileId: 'e',
    cond: { kind: 'item', itemId: 'k', negate: true },
  });
  // rune plates teach the two Words; throne step wakes the king
  castle.room.events.push(
    {
      x: 4,
      y: 8,
      once: true,
      actions: [
        { type: 'addVar', varId: 'w', delta: 1 },
        { type: 'showDialog', dlgId: 'rA' },
      ],
    },
    {
      x: 11,
      y: 8,
      once: true,
      actions: [
        { type: 'addVar', varId: 'w', delta: 1 },
        { type: 'showDialog', dlgId: 'rB' },
      ],
    },
    {
      x: 7,
      y: 4,
      once: true,
      cond: { kind: 'var', varId: 'w', cmp: '>=', value: 2 },
      actions: [
        { type: 'spriteAnim', spriteId: 'G', mode: 'f1' },
        { type: 'showDialog', dlgId: 'kR' },
      ],
    },
  );
  castle.room.endings.push({
    x: 7,
    y: 3,
    dlgId: 'en',
    req: { kind: 'var', varId: 'w', cmp: '>=', value: 2 },
    lockedDlgId: 'kL',
  });

  // ---- assemble ----
  return {
    title: 'hello world quest',
    version: 2,
    startRoom: '0',
    startX: 7,
    startY: 10,
    textSpeed: 'normal',
    font: 'classic',
    palettes: palettes(),
    tiles: [
      stoneWall(),
      grass(),
      path(),
      tree(),
      flower(),
      water(),
      bridge(),
      caveRock(),
      caveFloor(),
      castleWall(),
      castleFloor(),
      carpet(),
      runePlate(),
      well(),
      torch(),
    ],
    sprites: [
      {
        id: 'E',
        name: 'elder',
        frames: [elderFrame()],
        sprPal: 2,
        dlgId: 'a',
        altCond: { kind: 'item', itemId: 'j', negate: false },
        altDlgId: 'b',
        room: '0',
        x: 7,
        y: 4,
      },
      {
        id: 'F',
        name: 'fairy',
        frames: fairyFrames(),
        sprPal: 1,
        dlgId: 'c',
        altCond: { kind: 'count', itemId: 'h', cmp: '>=', value: 3 },
        altDlgId: 'd',
        room: '1',
        x: 10,
        y: 4,
      },
      {
        id: 'W',
        name: 'wolf',
        frames: [wolfFrame()],
        sprPal: 2,
        dlgId: 'e',
        room: '2',
        x: 7,
        y: 7,
        appearCond: { kind: 'flag', flagId: 't', negate: true },
      },
      {
        id: 'S',
        name: 'river spirit',
        frames: [spiritFrame()],
        sprPal: 1,
        dlgId: 'f',
        room: '3',
        x: 12,
        y: 4,
        appearCond: { kind: 'flag', flagId: 't', negate: false },
      },
      {
        id: 'G',
        name: 'sleeping king',
        frames: kingFrames(),
        sprPal: 3,
        dlgId: 'g',
        altCond: { kind: 'var', varId: 'w', cmp: '>=', value: 2 },
        altDlgId: 'h',
        room: '4',
        x: 6,
        y: 3,
      },
    ],
    items: [
      { id: 'h', name: 'sunherb', frames: [itemHerb()], sprPal: 3, dlgId: 'ph' },
      { id: 'n', name: 'old bone', frames: [itemBone()], sprPal: 2, dlgId: 'pn' },
      { id: 'k', name: 'gate key', frames: [itemKey()], sprPal: 3, dlgId: 'pk' },
      { id: 'j', name: 'river gem', frames: [itemGem()], sprPal: 1, dlgId: 'pj' },
    ],
    flags: [{ id: 't', name: 'wolf tamed' }],
    variables: [{ id: 'w', name: 'rune words', initial: 0 }],
    rooms: [village.room, meadow.room, cave.room, river.room, castle.room],
    dialogs: {
      a: 'Elder: hello, world... nothing. The Greeting is broken, child. Two Rune Words sleep in the castle east of the river. Speak them from the throne and wake the realm.',
      b: 'Elder: a river gem! The spirit trusts you. Go on — the realm is waiting for its Greeting.',
      c: 'Fairy: the river runs too deep to wade. Bring me three sunherbs from across the realm and I will weave you a bridge of light.',
      d: 'Fairy: three sunherbs, warm as little suns! The bridge is woven. Cross where the water narrows.',
      e: 'The wolf bares its teeth. [blink]GRR.[/blink] It looks hungry... and it will not move.',
      f: 'Spirit: you were kind to the wolf, so I am kind to you. My gem waits on the far bank. Show it to the elder some day.',
      g: 'The king sleeps on his throne. He mumbles: "...hello...? no... how did it go..."',
      h: 'King: you carry both Words?! Step onto the dais and speak, hero!',
      m1: 'The meadow hums with bees. Only one sunherb grows here — the others hide across the realm. East a river glitters; north a cave breathes cold air.',
      c2: 'You toss the old bone. The wolf snatches it, wags its tail like a puppy, and pads away into the dark.',
      rA: 'The plate glows. A word rises: [col1]HELLO[/col1]. It tastes like morning.',
      rB: 'The plate glows. A word rises: [col1]WORLD[/col1]. It sounds like everything at once.',
      kR: 'The king rises from his throne, arms wide! "The Words! Say them together!"',
      kL: 'The dais hums, waiting for Words you do not yet carry. The rune plates lie south of the gate.',
      en: 'You take a breath and speak: [cycle]HELLO WORLD![/cycle] Light rolls across the realm like a sunrise. Every door opens. Every bird answers. The realm is awake.',
      ph: 'A sunherb! It glows faintly, warm in your hand.',
      pn: 'An old bone from beside the well. Some dog — or wolf — would love this.',
      pk: 'The gate key! Heavy, golden, and humming with castle-magic.',
      pj: 'The river gem. Deep inside it, a tiny river flows.',
    },
    avatar: { id: 'A', name: 'hero', frames: heroFrames(), sprPal: 0 },
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [townSong(), fieldSong(), caveSong()],
  };
}
