/**
 * NOSTROMO — a 5-room survival-horror homage to ALIEN (1979), built with the
 * NESty engine. You wake alone on the commercial towing vessel Nostromo. The
 * crew are gone. MU-TH-UR won't say why. Restore power, drag Special Order 937
 * (CREW EXPENDABLE) out of the mainframe, and purge the thing in engineering
 * through the airlock before it finds you.
 *
 * Exercises 5 rooms, all 5 transitions, flags + 2 counters, step-on events
 * (once + conditional), tile overlays (sealed blast doors, the lurking alien),
 * conditional sprites, layered item/flag gating, a locked ending, and deep
 * dialog with text FX. Fully solvable (see nostromo.gen.test.ts).
 *
 * Art is GBC-sci-fi-lab styled: beveled diamond bulkheads, tiled deck plating,
 * screen-and-button console banks, big viewscreens, striped coolant tanks and a
 * company emblem, recoloured per room (icy cryo, magenta hub, amber bridge,
 * sick-green mess, red-alert engineering).
 */
import { blankRoom, frameFromRows } from './defaults';
import { defaultSfxSet } from './sfx';
import type { Song } from './song';
import type {
  Frame16,
  GameData,
  PaletteSet,
  Room,
  SubPal,
  TileDef,
} from './types';

const F = (rows: string[]): Frame16 => frameFromRows(rows);

/** Tile an 8×8 quad (8 rows of 8 chars) into a 16×16 frame — one CHR tile. */
const q4 = (q: string[]): Frame16 =>
  F(Array.from({ length: 16 }, (_, y) => q[y % 8]!.repeat(2)));

// ----------------------------------------------------------------- tiles ----
// pixel value -> subpalette slot: 0 backdrop (black), 1 dark, 2 mid, 3 light.

// beveled diamond wall panel (light top/left, dark bottom/right, raised centre)
const bulkhead = (): TileDef => ({
  id: 'w',
  name: 'bulkhead',
  wall: true,
  frames: [
    q4([
      '33333332',
      '32222221',
      '32233221',
      '32322321',
      '32233221',
      '32222221',
      '31111111',
      '21111111',
    ]),
  ],
});

// tiled deck plate with a rivet
const grating = (): TileDef => ({
  id: 'f',
  name: 'deck plate',
  wall: false,
  frames: [
    q4([
      '22222221',
      '21111111',
      '21122111',
      '21122111',
      '21111111',
      '21111111',
      '21111111',
      '11111111',
    ]),
  ],
});

// segmented conduit door with a lit iris centre
const door = (): TileDef => ({
  id: 'd',
  name: 'iris door',
  wall: false,
  frames: [
    F([
      '3333333333333333',
      '3111111111111113',
      '3122222222222213',
      '3122333333322213',
      '3122300000032213',
      '3122303113032213',
      '3122303223032213',
      '3122303223032213',
      '3122303223032213',
      '3122303223032213',
      '3122303113032213',
      '3122300000032213',
      '3122333333322213',
      '3122222222222213',
      '3111111111111113',
      '3333333333333333',
    ]),
  ],
});

// heavy sealed blast door with a hazard chevron core
const blastDoor = (): TileDef => ({
  id: 'x',
  name: 'sealed blast door',
  wall: true,
  frames: [
    F([
      '3333333333333333',
      '3111111111111113',
      '3133333333333313',
      '3132222222222313',
      '3132133333312313',
      '3132120000212313',
      '3132120330212313',
      '3132120330212313',
      '3132120330212313',
      '3132120330212313',
      '3132120000212313',
      '3132133333312313',
      '3132222222222313',
      '3133333333333313',
      '3111111111111113',
      '3333333333333333',
    ]),
  ],
});

// console bank: dark screen with readout + a row of buttons (2-frame blink)
const console_ = (): TileDef => ({
  id: 'c',
  name: 'console bank',
  wall: true,
  frames: [
    F([
      '3333333333333333',
      '3111111111111113',
      '3130000000000313',
      '3130133333100313',
      '3130132222100313',
      '3130132332100313',
      '3130132112100313',
      '3130132332100313',
      '3130132222100313',
      '3130133333100313',
      '3130000000000313',
      '3111111111111113',
      '3132103210321013',
      '3130321032103213',
      '3111111111111113',
      '3333333333333333',
    ]),
    F([
      '3333333333333333',
      '3111111111111113',
      '3130000000000313',
      '3130111111100313',
      '3130133333100313',
      '3130132112100313',
      '3130132332100313',
      '3130132112100313',
      '3130133333100313',
      '3130111111100313',
      '3130000000000313',
      '3111111111111113',
      '3130321032103213',
      '3132103210321013',
      '3111111111111113',
      '3333333333333333',
    ]),
  ],
});

// hypersleep pod: glass canopy over a dim occupant slot
const pod = (): TileDef => ({
  id: 's',
  name: 'hypersleep pod',
  wall: true,
  frames: [
    F([
      '0011111111111100',
      '0132222222222310',
      '1322222222222231',
      '1320333333330231',
      '1320322222230231',
      '1320322112230231',
      '1320322112230231',
      '1320322112230231',
      '1320322112230231',
      '1320322112230231',
      '1320322222230231',
      '1320333333330231',
      '1322222222222231',
      '0132222222222310',
      '0011111111111100',
      '0001100000011000',
    ]),
  ],
});

// mess table with pedestal legs
const table = (): TileDef => ({
  id: 't',
  name: 'mess table',
  wall: true,
  frames: [
    F([
      '0000000000000000',
      '0000000000000000',
      '1111111111111111',
      '1222222222222221',
      '1233333333333321',
      '1222222222222221',
      '1111111111111111',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0011000000001100',
      '0111100000011110',
      '0000000000000000',
      '0000000000000000',
    ]),
  ],
});

// fat vertical conduit with banded segments
const pipe = (): TileDef => ({
  id: 'p',
  name: 'coolant pipe',
  wall: true,
  frames: [
    F([
      '0111111111111110',
      '0132222222222310',
      '0132222222222310',
      '0133333333333310',
      '0132222222222310',
      '0132222222222310',
      '0132222222222310',
      '0133333333333310',
      '0132222222222310',
      '0132222222222310',
      '0132222222222310',
      '0133333333333310',
      '0132222222222310',
      '0132222222222310',
      '0132222222222310',
      '0111111111111110',
    ]),
  ],
});

// louvred air vent (dark slots between bright bars)
const vent = (): TileDef => ({
  id: 'v',
  name: 'air vent',
  wall: true,
  frames: [
    q4([
      '33333333',
      '30000003',
      '31111113',
      '30000003',
      '31111113',
      '30000003',
      '31111113',
      '33333333',
    ]),
  ],
});

// diagonal hazard stripes (cycles the three accent colours)
const hazard = (): TileDef => ({
  id: 'h',
  name: 'hazard stripe',
  wall: false,
  frames: [
    q4([
      '11222331',
      '12223311',
      '22233111',
      '22331112',
      '23311122',
      '33111222',
      '31112223',
      '11122233',
    ]),
  ],
});

// the thing, bled into the wall — biomechanical silhouette
const alienWall = (): TileDef => ({
  id: 'y',
  name: 'thing in the dark',
  wall: true,
  frames: [
    F([
      '0011000000001100',
      '0132100000012310',
      '0123210000123210',
      '0012321112321210',
      '0001233223321000',
      '0011232332322100',
      '0132213223122310',
      '1322103223012231',
      '1321003223001231',
      '0132003223003210',
      '0013203223032100',
      '0001320220231000',
      '0011232002321100',
      '0132210000122310',
      '0123100000013210',
      '0011000000001100',
    ]),
  ],
});

// big wall viewscreen with a scan grid (2-frame scanline)
const monitor = (): TileDef => ({
  id: 'm',
  name: 'viewscreen',
  wall: true,
  frames: [
    F([
      '3333333333333333',
      '3111111111111113',
      '3100000000000013',
      '3101111111111013',
      '3101222222221013',
      '3101211112121013',
      '3101222222221013',
      '3101211112121013',
      '3101222222221013',
      '3101211112121013',
      '3101222222221013',
      '3101111111111013',
      '3100000000000013',
      '3111111111111113',
      '3132132132132113',
      '3333333333333333',
    ]),
    F([
      '3333333333333333',
      '3111111111111113',
      '3100000000000013',
      '3101222222221013',
      '3101211112121013',
      '3101222222221013',
      '3101211112121013',
      '3101222222221013',
      '3101211112121013',
      '3101222222221013',
      '3101111111111013',
      '3101222222221013',
      '3100000000000013',
      '3111111111111113',
      '3121321321321313',
      '3333333333333333',
    ]),
  ],
});

// striped coolant tank / cylinder (diagonal bands)
const tank = (): TileDef => ({
  id: 'g',
  name: 'coolant tank',
  wall: true,
  frames: [
    F([
      '0011111111110000',
      '0133333333331000',
      '0122222222222100',
      '0132233113322310',
      '0121132233112210',
      '0122113322331210',
      '0123311233112310',
      '0121123311233210',
      '0132231132231310',
      '0121322113322110',
      '0122133223113210',
      '0132211332211310',
      '0122222222222100',
      '0133333333331000',
      '0011111111110000',
      '0001111111100000',
    ]),
  ],
});

// company emblem — a walkable deck decal (Weyland-Yutani-ish star)
const emblem = (): TileDef => ({
  id: 'l',
  name: 'company emblem',
  wall: false,
  frames: [
    F([
      '1111111111111111',
      '1222222222222221',
      '1222222112222221',
      '1222213311322221',
      '1222133333312221',
      '1221333333333221',
      '1223333333333321',
      '1233331331333321',
      '1233313113133321',
      '1223333333333321',
      '1221333333333221',
      '1222133333312221',
      '1222213311322221',
      '1222222112222221',
      '1222222222222221',
      '1111111111111111',
    ]),
  ],
});

// twin storage lockers with handles
const locker = (): TileDef => ({
  id: 'b',
  name: 'storage locker',
  wall: true,
  frames: [
    F([
      '3333333333333333',
      '3111111111111113',
      '3122211112221113',
      '3122211112221113',
      '3122211112221113',
      '3123311113321113',
      '3122211112221113',
      '3122211112221113',
      '3122211112221113',
      '3123311113321113',
      '3122211112221113',
      '3122211112221113',
      '3122211112221113',
      '3122211112221113',
      '3111111111111113',
      '3333333333333333',
    ]),
  ],
});

// -------------------------------------------------------------- sprites ----

// third officer in an EVA suit — helmet visor, chest pack, two-frame walk
const crewFrames = (): Frame16[] => [
  F([
    '0000111111000000',
    '0001222222100000',
    '0012333333210000',
    '0012311113210000',
    '0012322223210000',
    '0012333333210000',
    '0001222222100000',
    '0011122211110000',
    '0111222222111000',
    '0111233332111000',
    '0011222222110000',
    '0011221221100000',
    '0001221221100000',
    '0001100110000000',
    '0011100011100000',
    '0000000000000000',
  ]),
  F([
    '0000111111000000',
    '0001222222100000',
    '0012333333210000',
    '0012311113210000',
    '0012322223210000',
    '0012333333210000',
    '0001222222100000',
    '0011122211110000',
    '0111222222111000',
    '0111233332111000',
    '0011222222110000',
    '0011221221100000',
    '0001221221100000',
    '0000110011000000',
    '0001110001110000',
    '0000000000000000',
  ]),
];

// Kane — the crewmate who never woke, slumped, eyes half-frosted shut
const kaneFrame = (): Frame16 =>
  F([
    '0000111111000000',
    '0001333333100000',
    '0013333333310000',
    '0013311331310000',
    '0013333333310000',
    '0001333333100000',
    '0000133331000000',
    '0001111111100000',
    '0011122211110000',
    '0011122211110000',
    '0011122211110000',
    '0001122211100000',
    '0000111111000000',
    '0000011110000000',
    '0000000000000000',
    '0000000000000000',
  ]);

// MU-TH-UR 6000 — a great glowing eye of readouts behind glass (blink)
const motherFrames = (): Frame16[] => [
  F([
    '1111111111111111',
    '1222222222222221',
    '1233333333333321',
    '1230000000000321',
    '1230011111100321',
    '1230122222210321',
    '1230123333210321',
    '1230123223210321',
    '1230123223210321',
    '1230123333210321',
    '1230122222210321',
    '1230011111100321',
    '1230000000000321',
    '1233333333333321',
    '1222222222222221',
    '1111111111111111',
  ]),
  F([
    '1111111111111111',
    '1222222222222221',
    '1233333333333321',
    '1230000000000321',
    '1230011111100321',
    '1230122222210321',
    '1230122222210321',
    '1230123223210321',
    '1230123223210321',
    '1230122222210321',
    '1230122222210321',
    '1230011111100321',
    '1230000000000321',
    '1233333333333321',
    '1222222222222221',
    '1111111111111111',
  ]),
];

// the xenomorph — elongated skull, ribbed carapace, bared inner jaw (2-frame)
const alienFrames = (): Frame16[] => [
  F([
    '0000000110000000',
    '0000001221000000',
    '0000012332100000',
    '0000123223210000',
    '0001232332321000',
    '0012322112232100',
    '0123221111223210',
    '0122321111232210',
    '0012322112232100',
    '0001232332321000',
    '0000123223210000',
    '0000012112100000',
    '0000123113210000',
    '0001230000321000',
    '0012300000032100',
    '0000000000000000',
  ]),
  F([
    '0000001100000000',
    '0000012210000000',
    '0000123321000000',
    '0001232232100000',
    '0012323323210000',
    '0123221122321000',
    '1232211112232100',
    '1223211112322100',
    '0123221122321000',
    '0012323323210000',
    '0001232232100000',
    '0000121121000000',
    '0000123311230000',
    '0001230000321000',
    '0012310000123000',
    '0000000000000000',
  ]),
];

// ------------------------------------------------------------- item art ----

const cardArt = (): Frame16 =>
  F([
    '0000000000000000',
    '0011111111111100',
    '0122222222222210',
    '0123333333333210',
    '0123000000003210',
    '0123033330303210',
    '0123000000003210',
    '0122222222222210',
    '0121111111112210',
    '0121222222212210',
    '0121111111112210',
    '0122222222222210',
    '0011111111111100',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ]);

const coolantArt = (): Frame16 =>
  F([
    '0000111111000000',
    '0001222222100000',
    '0012333333210000',
    '0012322223210000',
    '0012311113210000',
    '0012322223210000',
    '0012322223210000',
    '0012311113210000',
    '0012322223210000',
    '0012322223210000',
    '0012333333210000',
    '0001222222100000',
    '0000122221000000',
    '0000011110000000',
    '0000000000000000',
    '0000000000000000',
  ]);

// -------------------------------------------------------------- palettes ----
// subpalettes per room: 0 walls, 1 deck/pipes, 2 machines/screens, 3 accents.

const SPR: PaletteSet['spr'] = [
  [0x0f, 0x12, 0x30], // 0 crew: black suit, blue, white
  [0x07, 0x28, 0x37], // 1 MU-TH-UR / card: amber, gold, cream
  [0x0f, 0x03, 0x24], // 2 alien: black, deep purple, magenta-violet
  [0x06, 0x16, 0x30], // 3 kane / blood: dark red, red, white
];

const palettes = (): PaletteSet[] => [
  {
    id: '0',
    name: 'cryo',
    backdrop: 0x0f,
    bg: [
      [0x02, 0x12, 0x22], // blue steel walls
      [0x0c, 0x1c, 0x3c], // icy deck
      [0x00, 0x21, 0x30], // pod glass: dark, blue, white
      [0x12, 0x2c, 0x30], // frost accents
    ],
    spr: SPR,
  },
  {
    id: '1',
    name: 'corridor',
    backdrop: 0x0f,
    bg: [
      [0x04, 0x14, 0x24], // magenta lab panels
      [0x0c, 0x1c, 0x3c], // teal deck
      [0x00, 0x2a, 0x30], // console: dark screen, green, white
      [0x14, 0x2c, 0x30], // accents: magenta / cyan / white (hazard, tanks)
    ],
    spr: SPR,
  },
  {
    id: '2',
    name: 'bridge',
    backdrop: 0x0f,
    bg: [
      [0x07, 0x17, 0x28], // amber panels
      [0x00, 0x10, 0x2d], // grey deck
      [0x00, 0x28, 0x37], // MU-TH-UR glow: dark, amber, cream
      [0x07, 0x28, 0x37], // amber accents
    ],
    spr: SPR,
  },
  {
    id: '3',
    name: 'mess',
    backdrop: 0x0f,
    bg: [
      [0x09, 0x19, 0x29], // sickly green panels
      [0x00, 0x10, 0x2d], // grey deck
      [0x00, 0x1a, 0x2a], // console: dark, green screen
      [0x06, 0x16, 0x30], // blood accents
    ],
    spr: SPR,
  },
  {
    id: '4',
    name: 'engineering',
    backdrop: 0x0f,
    bg: [
      [0x06, 0x16, 0x26], // red-alert panels
      [0x00, 0x10, 0x2d], // grey deck
      [0x00, 0x27, 0x37], // console: dark, orange, amber
      [0x16, 0x2c, 0x30], // red / cyan / white hazard
    ],
    spr: SPR,
  },
];

// ------------------------------------------------------------ room paint ----

interface Painter {
  room: Room;
  put: (x: number, y: number, id: string) => void;
  row: (y: number, x0: number, x1: number, id: string) => void;
  col: (x: number, y0: number, y1: number, id: string) => void;
  rect: (x0: number, y0: number, x1: number, y1: number, id: string) => void;
  /** Wrap the painted (non-void) shape in a 1-cell hull wall; the rest stays
   *  void (black), so the room silhouette is whatever shape you painted. */
  wallAround: () => void;
  palAt: (id: string, sub: SubPal) => void;
  palCell: (x: number, y: number, sub: SubPal) => void;
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
  const rect = (x0: number, y0: number, x1: number, y1: number, tid: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, tid);
  };
  const wallAround = () => {
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ] as const;
    const next = [...room.tiles];
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 16; x++) {
        if (room.tiles[y * 16 + x] !== '0') continue;
        let touch = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx > 15 || ny < 0 || ny > 14) continue;
          const t = room.tiles[ny * 16 + nx]!;
          if (t !== '0' && t !== 'w') { touch = true; break; }
        }
        if (touch) next[y * 16 + x] = 'w';
      }
    room.tiles = next;
  };
  const palAt = (tid: string, sub: SubPal) => {
    room.tiles.forEach((t, i) => {
      if (t === tid) room.pmap[i] = sub;
    });
  };
  const palCell = (x: number, y: number, sub: SubPal) => {
    room.pmap[y * 16 + x] = sub;
  };
  return { room, put, row, col, rect, wallAround, palAt, palCell };
}

/** paint every tile of a kind onto its subpalette (shared across rooms). */
function paintPal(p: Painter) {
  p.palAt('w', 0);
  p.palAt('b', 0);
  p.palAt('f', 1);
  p.palAt('p', 1);
  p.palAt('h', 3);
  p.palAt('g', 3);
  p.palAt('l', 3);
  p.palAt('c', 2);
  p.palAt('m', 2);
  p.palAt('s', 2);
  p.palAt('t', 2);
  p.palAt('v', 1);
  p.palAt('d', 3);
  p.palAt('x', 0);
}

// ----------------------------------------------------------------- build ----

export function nostromo(): GameData {
  // ============================ ROOM 0: HYPERSLEEP =======================
  const cryo = painter('0', '0');
  cryo.room.name = 'hypersleep';
  cryo.room.songId = 'drone';
  // octagonal vault: a wide chamber with its four corners cut away, opening
  // through a short east neck to the corridor
  cryo.rect(3, 1, 12, 12, 'f');
  cryo.rect(1, 3, 14, 10, 'f');
  cryo.rect(13, 6, 14, 8, 'f'); // east exit neck
  cryo.wallAround();
  cryo.put(15, 7, 'd'); // east door -> corridor
  // pods set into the curved upper wall; two more down the flanks
  cryo.put(3, 2, 's');
  cryo.put(6, 2, 's');
  cryo.put(9, 2, 's');
  cryo.put(12, 2, 's');
  cryo.put(2, 5, 's');
  cryo.put(13, 5, 's');
  cryo.put(7, 1, 'm'); // status viewscreen crowning the vault
  cryo.put(1, 8, 'b'); // gear lockers
  cryo.put(14, 4, 'b');
  cryo.put(2, 10, 'g'); // coolant tanks flank the floor
  cryo.put(13, 10, 'g');
  cryo.put(4, 12, 'p'); // conduits underfoot
  cryo.put(11, 12, 'p');
  cryo.row(12, 6, 9, 'h'); // hazard apron on the deck
  cryo.put(5, 11, 'l'); // deck emblems (walkable)
  cryo.put(10, 11, 'l');
  paintPal(cryo);
  cryo.room.exits.push({
    x: 15,
    y: 7,
    destRoom: '1',
    destX: 1,
    destY: 7,
    transition: 'fade',
  });
  // waking log fires once, one step off the pod
  cryo.room.events.push({
    x: 7,
    y: 9,
    once: true,
    actions: [
      { type: 'setFlag', flagId: 'wk' },
      { type: 'showDialog', dlgId: 'wake' },
    ],
  });
  // your access card, left clipped to your open pod
  cryo.room.items.push({ itemId: 'k', x: 7, y: 6 });

  // ============================ ROOM 1: CORRIDOR (hub) ===================
  const hall = painter('1', '1');
  hall.room.name = 'corridor';
  hall.room.songId = 'drone';
  // a cross-shaped corridor: three-wide arms to each door, a wider junction
  // node in the middle, and two service alcoves for the breakers. The four
  // corners are open void — this reads as a corridor, not a room.
  hall.rect(1, 6, 14, 8, 'f'); // east–west arm
  hall.rect(6, 1, 8, 13, 'f'); // north–south arm
  hall.rect(5, 5, 9, 9, 'f'); // junction node
  hall.rect(3, 4, 3, 6, 'f'); // breaker-A alcove (branches up off the W arm)
  hall.rect(12, 8, 12, 10, 'f'); // breaker-B alcove (branches down off the E arm)
  hall.wallAround();
  hall.put(0, 7, 'd'); // west -> hypersleep
  hall.put(7, 0, 'd'); // north -> bridge
  hall.put(15, 7, 'd'); // east -> mess
  hall.put(7, 14, 'd'); // south -> engineering
  hall.put(3, 3, 'c'); // breaker A console (caps the alcove)
  hall.put(12, 11, 'c'); // breaker B console
  hall.put(5, 2, 'b'); // lockers flanking the north door
  hall.put(9, 2, 'b');
  hall.put(2, 5, 'm'); // wall viewscreens along the arms
  hall.put(13, 9, 'm');
  hall.put(2, 8, 'g'); // coolant tanks at the arm mouths
  hall.put(13, 6, 'g');
  hall.put(5, 12, 'v'); // vents by the south door
  hall.put(9, 12, 'v');
  hall.put(7, 11, 'l'); // deck emblem (walkable)
  paintPal(hall);
  hall.room.exits.push(
    { x: 0, y: 7, destRoom: '0', destX: 14, destY: 7, transition: 'scroll' },
    { x: 7, y: 0, destRoom: '2', destX: 7, destY: 12, transition: 'curtain' },
    { x: 15, y: 7, destRoom: '3', destX: 1, destY: 7, transition: 'blinds' },
    { x: 7, y: 14, destRoom: '4', destX: 7, destY: 1, transition: 'diag' },
  );
  // three doors sealed until both breakers are thrown (var pw >= 2)
  const powerSeal = { kind: 'var', varId: 'pw', cmp: '<', value: 2 } as const;
  hall.room.overlays.push(
    { x: 7, y: 0, tileId: 'x', cond: powerSeal },
    { x: 15, y: 7, tileId: 'x', cond: powerSeal },
    { x: 7, y: 14, tileId: 'x', cond: powerSeal },
  );
  // the engineering door also needs your access card, one step in
  hall.room.overlays.push({
    x: 7,
    y: 13,
    tileId: 'x',
    cond: { kind: 'item', itemId: 'k', negate: true },
  });
  hall.room.events.push(
    {
      x: 3,
      y: 4,
      once: true,
      actions: [
        { type: 'addVar', varId: 'pw', delta: 1 },
        { type: 'showDialog', dlgId: 'brkA' },
      ],
    },
    {
      x: 12,
      y: 10,
      once: true,
      actions: [
        { type: 'addVar', varId: 'pw', delta: 1 },
        { type: 'showDialog', dlgId: 'brkB' },
      ],
    },
    {
      x: 7,
      y: 6,
      once: true,
      cond: { kind: 'var', varId: 'pw', cmp: '>=', value: 2 },
      actions: [
        { type: 'setFlag', flagId: 'pd' },
        { type: 'showDialog', dlgId: 'power' },
      ],
    },
    // the empty-ship dread beat
    {
      x: 7,
      y: 9,
      once: true,
      actions: [{ type: 'showDialog', dlgId: 'alone' }],
    },
  );

  // ============================ ROOM 2: BRIDGE (MU-TH-UR) ================
  const bridge = painter('2', '2');
  bridge.room.name = 'bridge';
  bridge.room.songId = 'drone';
  // a cockpit: a wide command deck up top that narrows through a stem corridor
  // to the door. MU-TH-UR presides over the deck behind a wall of viewscreens.
  bridge.rect(2, 2, 13, 6, 'f'); // command deck
  bridge.rect(6, 6, 8, 12, 'f'); // stem corridor down to the door
  bridge.wallAround();
  bridge.put(7, 13, 'd'); // south -> corridor
  bridge.row(2, 3, 12, 'c'); // MU-TH-UR's console bank across the deck head
  bridge.put(5, 2, 'm'); // the main viewscreen array set into the bank
  bridge.put(6, 2, 'm');
  bridge.put(8, 2, 'm');
  bridge.put(9, 2, 'm');
  bridge.put(2, 5, 'c'); // flanking control stations
  bridge.put(13, 5, 'c');
  bridge.put(3, 6, 'p'); // conduit runs framing the stem
  bridge.put(12, 6, 'p');
  bridge.put(2, 6, 'g'); // coolant tanks at the deck corners
  bridge.put(13, 6, 'g');
  bridge.put(7, 9, 'l'); // deck emblem in the stem (walkable)
  paintPal(bridge);
  bridge.room.exits.push({
    x: 7,
    y: 13,
    destRoom: '1',
    destX: 7,
    destY: 1,
    transition: 'fade',
  });
  // Special Order 937: unlocked once you carry the science officer's code
  bridge.room.events.push({
    x: 7,
    y: 5,
    once: true,
    cond: { kind: 'flag', flagId: 'kn', negate: false },
    actions: [
      { type: 'setFlag', flagId: 'or' },
      { type: 'showDialog', dlgId: 'o937' },
    ],
  });

  // ============================ ROOM 3: MESS HALL =======================
  const mess = painter('3', '3');
  mess.room.name = 'mess';
  // an L-shaped hall: a broad dining room on the left, a narrow galley alcove
  // reaching to the right where the thing later drops from the vent
  mess.rect(1, 2, 8, 12, 'f'); // dining hall
  mess.rect(8, 6, 13, 9, 'f'); // galley alcove (right)
  mess.wallAround();
  mess.put(0, 7, 'd'); // west -> corridor
  mess.put(7, 5, 't'); // the dinner table
  mess.put(3, 3, 'c'); // science log terminal
  mess.put(2, 2, 'm'); // wall screen
  mess.put(10, 5, 'v'); // vents the thing comes through
  mess.put(12, 5, 'v');
  mess.put(2, 11, 'g'); // tanks
  mess.put(6, 12, 'g');
  mess.put(2, 5, 'b'); // pantry locker
  mess.put(13, 9, 'p'); // galley conduit
  mess.put(10, 7, 'l'); // deck emblem (walkable)
  paintPal(mess);
  mess.room.exits.push({
    x: 0,
    y: 7,
    destRoom: '1',
    destX: 14,
    destY: 7,
    transition: 'scroll',
  });
  // reading the log gives the override code AND wakes the horror
  mess.room.events.push(
    {
      x: 3,
      y: 4,
      once: true,
      actions: [
        { type: 'setFlag', flagId: 'kn' },
        { type: 'setFlag', flagId: 'al' },
        { type: 'showDialog', dlgId: 'log' },
      ],
    },
    // it drops from the vent the moment you turn away
    {
      x: 10,
      y: 8,
      once: true,
      cond: { kind: 'flag', flagId: 'al', negate: false },
      actions: [{ type: 'showDialog', dlgId: 'drop' }],
    },
  );
  // coolant cell for the airlock purge, tucked behind the table
  mess.room.items.push({ itemId: 'q', x: 7, y: 3 });
  // the thing, once loose, bleeds into the far wall of the mess
  mess.room.overlays.push({
    x: 12,
    y: 8,
    tileId: 'y',
    cond: { kind: 'flag', flagId: 'al', negate: false },
  });
  mess.palCell(12, 8, 3);

  // ============================ ROOM 4: ENGINEERING / AIRLOCK ===========
  const eng = painter('4', '4');
  eng.room.name = 'engineering';
  eng.room.songId = 'drone';
  // a vertical purge shaft on three tiers: the valve deck up top, a mid catwalk,
  // then the airlock chamber. The two bulkheads are the void gaps between tiers
  // (walled automatically) — breach them in SERIES via the coolant and 937 gaps.
  eng.rect(2, 1, 13, 8, 'f'); // valve deck
  eng.put(4, 9, 'f'); // coolant gap through bulkhead 1
  eng.rect(4, 10, 11, 10, 'f'); // mid catwalk
  eng.put(11, 11, 'f'); // override gap through bulkhead 2
  eng.rect(5, 12, 11, 13, 'f'); // airlock chamber
  eng.wallAround();
  eng.put(7, 0, 'd'); // north -> corridor
  eng.put(2, 4, 'c'); // valve 1
  eng.put(13, 4, 'c'); // valve 2
  eng.put(7, 6, 'c'); // valve 3
  eng.put(2, 1, 'm'); // status screens across the deck head
  eng.put(13, 1, 'm');
  eng.put(5, 1, 'v'); // reactor vents
  eng.put(10, 1, 'v');
  eng.put(4, 12, 'g'); // coolant tanks flanking the airlock (in the walls)
  eng.put(12, 12, 'g');
  eng.row(13, 6, 10, 'h'); // the airlock plate
  eng.put(7, 12, 'l'); // deck emblem before the lock (walkable)
  paintPal(eng);
  eng.room.exits.push({
    x: 7,
    y: 0,
    destRoom: '1',
    destX: 7,
    destY: 13,
    transition: 'fade',
  });
  // series locks: coolant to breach bulkhead 1, Order 937 to breach bulkhead 2
  eng.room.overlays.push(
    {
      x: 4,
      y: 9,
      tileId: 'x',
      cond: { kind: 'item', itemId: 'q', negate: true },
    },
    {
      x: 11,
      y: 11,
      tileId: 'x',
      cond: { kind: 'flag', flagId: 'or', negate: true },
    },
  );
  // purge valves must be thrown in order 1 -> 2 -> 3 (counter sq)
  eng.room.events.push(
    {
      x: 2,
      y: 5,
      cond: { kind: 'var', varId: 'sq', cmp: '==', value: 0 },
      actions: [
        { type: 'addVar', varId: 'sq', delta: 1 },
        { type: 'showDialog', dlgId: 'valv1' },
      ],
    },
    {
      x: 13,
      y: 5,
      cond: { kind: 'var', varId: 'sq', cmp: '==', value: 1 },
      actions: [
        { type: 'addVar', varId: 'sq', delta: 1 },
        { type: 'showDialog', dlgId: 'valv2' },
      ],
    },
    {
      x: 7,
      y: 7,
      cond: { kind: 'var', varId: 'sq', cmp: '==', value: 2 },
      actions: [
        { type: 'addVar', varId: 'sq', delta: 1 },
        { type: 'showDialog', dlgId: 'valv3' },
      ],
    },
  );
  // the airlock: eject once the purge sequence is complete
  eng.room.endings.push({
    x: 7,
    y: 13,
    dlgId: 'endWin',
    req: { kind: 'var', varId: 'sq', cmp: '>=', value: 3 },
    lockedDlgId: 'endLock',
  });

  // ------------------------------------------------------------- assemble ----
  return {
    title: 'NOSTROMO',
    version: 2,
    startRoom: '0',
    startX: 7,
    startY: 7,
    textSpeed: 'normal',
    typewriterSfx: true,
    font: 'classic',
    smoothMove: true,
    moveSpeed: 2,
    palettes: palettes(),
    tiles: [
      bulkhead(),
      grating(),
      door(),
      blastDoor(),
      console_(),
      pod(),
      table(),
      pipe(),
      vent(),
      hazard(),
      alienWall(),
      monitor(),
      tank(),
      emblem(),
      locker(),
    ],
    sprites: [
      {
        id: 'K',
        name: 'kane',
        frames: [kaneFrame()],
        sprPal: 3,
        dlgId: 'kane',
        room: '0',
        x: 6,
        y: 3,
      },
      {
        id: 'M',
        name: 'mu-th-ur',
        frames: motherFrames(),
        sprPal: 1,
        dlgId: 'moth0',
        altCond: { kind: 'flag', flagId: 'kn', negate: false },
        altDlgId: 'moth1',
        room: '2',
        x: 7,
        y: 4,
      },
      {
        id: 'X',
        name: 'xenomorph',
        frames: alienFrames(),
        sprPal: 2,
        dlgId: 'xeno',
        room: '4',
        x: 12,
        y: 12,
        appearCond: { kind: 'flag', flagId: 'al', negate: false },
      },
    ],
    items: [
      { id: 'k', name: 'access card', frames: [cardArt()], sprPal: 1, dlgId: 'pcard' },
      { id: 'q', name: 'coolant cell', frames: [coolantArt()], sprPal: 0, dlgId: 'pcool' },
    ],
    flags: [
      { id: 'wk', name: 'woken' },
      { id: 'pd', name: 'power restored' },
      { id: 'kn', name: 'override code known' },
      { id: 'or', name: 'order 937 unsealed' },
      { id: 'al', name: 'alien loose' },
    ],
    variables: [
      { id: 'pw', name: 'breakers thrown', initial: 0 },
      { id: 'sq', name: 'purge sequence', initial: 0 },
    ],
    rooms: [cryo.room, hall.room, bridge.room, mess.room, eng.room],
    dialogs: {
      wake: 'MU-TH-UR: [cycle]GOOD MORNING.[/cycle] Stasis terminated. One crew member revived. The others... are not in their pods. There is no explanation on file. Please proceed to your duties.',
      kane: 'Kane never woke. Frost has sealed his eyes half-open. Whatever tore through this ship, it started with him. You are alone with the sleepers now.',
      pcard: 'Your access card. A dead woman’s thumbprint is still on it. It will open the ways the ship decides you are allowed to walk.',
      brkA: 'Breaker A groans over. Somewhere deep in the hull, a fan shudders back to life. [blink]ONE OF TWO.[/blink]',
      brkB: 'Breaker B bites shut. Green light crawls down the corridor like something waking. [blink]TWO OF TWO.[/blink]',
      power: 'Main power sighs back on. The sealed doors unclench, one by one. The ship is listening again. So is whatever else is aboard.',
      alone: 'The corridor stretches empty in both directions. You can hear your own blood. Seven names on the roster. Six pods, cold. And you.',
      moth0: 'MU-TH-UR: [cycle]I cannot discuss crew disposition. Special directives are sealed to science division clearance. Return to your station.[/cycle] The amber light does not blink. It never blinks.',
      moth1: 'MU-TH-UR: [cycle]Clearance recognised. Science override active. You have read what Ash read. Then you already understand what you are to me.[/cycle]',
      o937: 'SPECIAL ORDER 937 — [blink]CREW EXPENDABLE.[/blink] Priority one: ensure return of organism for weapons division. All other considerations secondary. You were never meant to wake. You were meant to arrive as cargo.',
      log: 'Science officer, personal log: [wave]I admire its purity.[/wave] A survivor, unclouded by conscience, remorse, or delusions of morality. Override code: [col1]937[/col1]. The Company already knew. We are all expendable. Even me. Even you.',
      pcool: 'A coolant cell, skin-frosting cold. Heavy enough to charge the airlock purge — if you can reach it.',
      drop: 'Behind you the vent grille peels open without a sound. Something wet unfolds into the dark and is gone before you turn. [wave]It knows you are here now.[/wave]',
      xeno: 'It hangs in the pipework, more machine than animal, breathing your air. It does not charge. It waits. Purge the lock while it still lets you.',
      valv1: 'Purge valve ONE engaged. Coolant screams through the line. [blink]SEQUENCE 1 OF 3.[/blink]',
      valv2: 'Purge valve TWO engaged. The airlock plate frosts white. [blink]SEQUENCE 2 OF 3.[/blink]',
      valv3: 'Purge valve THREE engaged. Emergency purge [blink]ARMED.[/blink] The outer door is one step away. So is the void.',
      endLock: 'The airlock stays sealed. The purge line is dead — the valves must be thrown in sequence, ONE then TWO then THREE, and the override loaded. It is still in here with you.',
      endWin: 'You slam the eject. The lock blows. For one heartbeat the thing is a black star against the void, then it is nothing, then it is gone. [cycle]Final report of the commercial starship Nostromo. Third officer reporting. The others are dead. I am signing off.[/cycle] Alone, you set course, and sleep.',
    },
    avatar: {
      id: 'A',
      name: 'ripley',
      frames: crewFrames(),
      sprPal: 0,
      flipOnMove: true,
    },
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [droneSong()],
  };
}

// slow, dread-soaked minor drone for the whole ship
function droneSong(): Song {
  return {
    id: 'drone',
    name: 'nostromo drone',
    bpm: 54,
    root: 45,
    scale: 'minor' as const,
    lead: { duty: 0, decay: 4, octave: 1 },
    melody: { duty: 1, decay: 14, octave: 0 },
    bassOctave: -1,
    drumDecay: 5,
    drumMode: 1,
    patterns: [
      {
        melody: [1, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
        lead: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0],
        bass: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        drum: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0],
      },
      {
        melody: [4, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
        lead: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0],
        bass: [5, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0],
        drum: [0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
    order: [0, 0, 1, 0],
  };
}
