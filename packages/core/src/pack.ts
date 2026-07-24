/**
 * Compact binary codec for GameData — the "ultra compressed" export format.
 *
 * The verbose text format (see serialize.ts) is ~16 KB for the sample games,
 * ~3.5 KB even after deflate, because every 16×16 art frame is 256 ASCII
 * chars and structure is spelled out in keywords. This codec packs the model
 * to a dense binary (2 bits per pixel, indexed room grids, packed sub-palette
 * maps, varint-length strings) so that after deflate-raw the whole game fits
 * in ~2.5 KB. The editor deflates packGame() output for download and inflates
 * before unpackGame() on import; the two are exact inverses.
 */
import {
  defaultSfxSet,
  SFX_NAMES,
  type SfxClip,
  type SfxName,
  type SfxNote,
  type SfxSet,
} from './sfx';
import type { Song, SongChannelParams, SongPattern, SongScale } from './song';
import type {
  Action,
  Cond,
  Drawable,
  Ending,
  Exit,
  Frame16,
  GameData,
  ItemDef,
  ItemPlacement,
  PaletteSet,
  Pixel,
  Room,
  RoomEvent,
  SpriteDef,
  SplashScreen,
  SubPal,
  TileDef,
  TileOverlay,
} from './types';

export const PACK_MAGIC = 0x4e5a; // 'NZ'
export const PACK_VERSION = 3; // v3 adds typewriterSfx flag, 'type' sfx + customSfx

/** Builtin sfx present before v3 (v3 appends 'type'). */
const SFX_NAMES_V2 = ['walk', 'talk', 'pickup', 'exit', 'ending'] as const;

const SPEEDS = ['instant', 'slow', 'normal', 'fast', 'turbo'] as const;
const FONTS = ['classic', 'thin', 'bold', 'scifi', 'katakana'] as const;
const CMPS = ['==', '!=', '>=', '<'] as const;
const SCALES = ['major', 'minor', 'penta', 'chromatic'] as const;
const ANIM_MODES = ['anim', 'f0', 'f1'] as const;
const ACTION_TYPES = [
  'setFlag',
  'clearFlag',
  'toggleFlag',
  'setVar',
  'addVar',
  'showDialog',
  'spriteAnim',
  'playSfx',
  'playSong',
] as const;

// ------------------------------------------------------------- writer ----

class Writer {
  private buf = new Uint8Array(1024);
  private len = 0;
  private grow(n: number) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  u8(v: number) {
    this.grow(1);
    this.buf[this.len++] = v & 0xff;
  }
  bytes(b: Uint8Array) {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  /** unsigned LEB128 */
  varint(v: number) {
    let n = v >>> 0;
    while (n >= 0x80) {
      this.u8((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    this.u8(n);
  }
  /** zigzag-encoded signed LEB128 (octaves can be negative) */
  svarint(v: number) {
    this.varint((v << 1) ^ (v >> 31));
  }
  str(s: string) {
    const b = new TextEncoder().encode(s);
    this.varint(b.length);
    this.bytes(b);
  }
  bool(v: boolean) {
    this.u8(v ? 1 : 0);
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  private p = 0;
  constructor(private buf: Uint8Array) {}
  u8(): number {
    return this.buf[this.p++]!;
  }
  varint(): number {
    let shift = 0;
    let out = 0;
    for (;;) {
      const b = this.u8();
      out |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return out >>> 0;
  }
  svarint(): number {
    const u = this.varint();
    return (u >>> 1) ^ -(u & 1);
  }
  str(): string {
    const n = this.varint();
    const s = new TextDecoder().decode(this.buf.subarray(this.p, this.p + n));
    this.p += n;
    return s;
  }
  bool(): boolean {
    return this.u8() !== 0;
  }
  take(n: number): Uint8Array {
    const s = this.buf.subarray(this.p, this.p + n);
    this.p += n;
    return s;
  }
}

// ------------------------------------------------------- primitives ----

/** 256 pixels (0-3) -> 64 bytes, 4 px each (MSB first). */
function writeFrame(w: Writer, px: Frame16) {
  for (let i = 0; i < 64; i++)
    w.u8(
      ((px[i * 4]! & 3) << 6) |
        ((px[i * 4 + 1]! & 3) << 4) |
        ((px[i * 4 + 2]! & 3) << 2) |
        (px[i * 4 + 3]! & 3),
    );
}
function readFrame(r: Reader): Frame16 {
  const px: Pixel[] = [];
  for (let i = 0; i < 64; i++) {
    const b = r.u8();
    px.push(((b >> 6) & 3) as Pixel, ((b >> 4) & 3) as Pixel);
    px.push(((b >> 2) & 3) as Pixel, (b & 3) as Pixel);
  }
  return px;
}

function writeFrames(w: Writer, frames: Frame16[]) {
  w.u8(frames.length);
  for (const f of frames) writeFrame(w, f);
}
function readFrames(r: Reader): Frame16[] {
  const n = r.u8();
  const out: Frame16[] = [];
  for (let i = 0; i < n; i++) out.push(readFrame(r));
  return out;
}

/** 2-bit-pack an array of SubPal (0-3). */
function writeSubPals(w: Writer, sp: SubPal[]) {
  for (let i = 0; i < sp.length; i += 4)
    w.u8(
      ((sp[i]! & 3) << 6) |
        (((sp[i + 1] ?? 0) & 3) << 4) |
        (((sp[i + 2] ?? 0) & 3) << 2) |
        ((sp[i + 3] ?? 0) & 3),
    );
}
function readSubPals(r: Reader, count: number): SubPal[] {
  const out: SubPal[] = [];
  for (let i = 0; i < count; i += 4) {
    const b = r.u8();
    out.push(((b >> 6) & 3) as SubPal, ((b >> 4) & 3) as SubPal);
    out.push(((b >> 2) & 3) as SubPal, (b & 3) as SubPal);
  }
  return out.slice(0, count);
}

function writeOpt<T>(w: Writer, v: T | undefined, fn: (v: T) => void) {
  if (v === undefined) {
    w.bool(false);
    return;
  }
  w.bool(true);
  fn(v);
}
function readOpt<T>(r: Reader, fn: () => T): T | undefined {
  return r.bool() ? fn() : undefined;
}

// ------------------------------------------------------------ cond ----

function writeCond(w: Writer, c: Cond) {
  switch (c.kind) {
    case 'item':
      w.u8(0);
      w.str(c.itemId);
      w.bool(c.negate);
      break;
    case 'count':
      w.u8(1);
      w.str(c.itemId);
      w.u8(CMPS.indexOf(c.cmp));
      w.varint(c.value);
      break;
    case 'flag':
      w.u8(2);
      w.str(c.flagId);
      w.bool(c.negate);
      break;
    case 'var':
      w.u8(3);
      w.str(c.varId);
      w.u8(CMPS.indexOf(c.cmp));
      w.varint(c.value);
      break;
  }
}
function readCond(r: Reader): Cond {
  const k = r.u8();
  if (k === 0) return { kind: 'item', itemId: r.str(), negate: r.bool() };
  if (k === 1)
    return {
      kind: 'count',
      itemId: r.str(),
      cmp: CMPS[r.u8()]!,
      value: r.varint(),
    };
  if (k === 2) return { kind: 'flag', flagId: r.str(), negate: r.bool() };
  return { kind: 'var', varId: r.str(), cmp: CMPS[r.u8()]!, value: r.varint() };
}

// -------------------------------------------------------- drawable ----

function writeDrawable(w: Writer, d: Drawable) {
  w.str(d.id);
  w.str(d.name);
  writeFrames(w, d.frames);
  w.u8(d.sprPal);
  writeOpt(w, d.dlgId, (v) => w.str(v));
  writeOpt(w, d.altCond, (v) => writeCond(w, v));
  writeOpt(w, d.altDlgId, (v) => w.str(v));
}
function readDrawable(r: Reader): Drawable {
  return {
    id: r.str(),
    name: r.str(),
    frames: readFrames(r),
    sprPal: r.u8() as SubPal,
    dlgId: readOpt(r, () => r.str()),
    altCond: readOpt(r, () => readCond(r)),
    altDlgId: readOpt(r, () => r.str()),
  };
}

// ------------------------------------------------------------ room ----

function writeAction(w: Writer, a: Action) {
  w.u8(ACTION_TYPES.indexOf(a.type));
  switch (a.type) {
    case 'setFlag':
    case 'clearFlag':
    case 'toggleFlag':
      w.str(a.flagId);
      break;
    case 'setVar':
      w.str(a.varId);
      w.varint(a.value);
      break;
    case 'addVar':
      w.str(a.varId);
      w.varint(a.delta);
      break;
    case 'showDialog':
      w.str(a.dlgId);
      break;
    case 'spriteAnim':
      w.str(a.spriteId);
      w.u8(ANIM_MODES.indexOf(a.mode));
      break;
    case 'playSfx':
      w.str(a.sfxId);
      break;
    case 'playSong':
      writeOpt(w, a.songId, (v) => w.str(v));
      break;
  }
}
function readAction(r: Reader): Action {
  const t = ACTION_TYPES[r.u8()]!;
  switch (t) {
    case 'setFlag':
    case 'clearFlag':
    case 'toggleFlag':
      return { type: t, flagId: r.str() };
    case 'setVar':
      return { type: t, varId: r.str(), value: r.varint() };
    case 'addVar':
      return { type: t, varId: r.str(), delta: r.varint() };
    case 'showDialog':
      return { type: t, dlgId: r.str() };
    case 'spriteAnim':
      return { type: t, spriteId: r.str(), mode: ANIM_MODES[r.u8()]! };
    case 'playSfx':
      return { type: t, sfxId: r.str() };
    default:
      return { type: 'playSong', songId: readOpt(r, () => r.str()) };
  }
}

/** Room tile grids reference tile ids; store each cell as an index into a
 * table ['0', ...tileIds] so ids of any length stay compact (1 byte/cell). */
function writeGrid(w: Writer, tiles: string[], table: Map<string, number>) {
  for (const id of tiles) w.u8(table.get(id) ?? 0);
}
function readGrid(r: Reader, count: number, list: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(list[r.u8()] ?? '0');
  return out;
}

function writeRoom(w: Writer, room: Room, table: Map<string, number>) {
  w.str(room.id);
  w.str(room.name);
  w.str(room.palId);
  writeOpt(w, room.songId, (v) => w.str(v));
  writeGrid(w, room.tiles, table);
  writeSubPals(w, room.pmap);
  w.varint(room.exits.length);
  for (const e of room.exits) writeExit(w, e);
  w.varint(room.endings.length);
  for (const e of room.endings) writeEnding(w, e);
  w.varint(room.items.length);
  for (const it of room.items) writePlacement(w, it);
  w.varint(room.events.length);
  for (const ev of room.events) writeEvent(w, ev);
  w.varint(room.overlays.length);
  for (const ov of room.overlays) writeOverlay(w, ov);
}
function readRoom(r: Reader, list: string[]): Room {
  const id = r.str();
  const name = r.str();
  const palId = r.str();
  const songId = readOpt(r, () => r.str());
  const tiles = readGrid(r, 240, list);
  const pmap = readSubPals(r, 240);
  const exits: Exit[] = [];
  for (let n = r.varint(); n-- > 0; ) exits.push(readExit(r));
  const endings: Ending[] = [];
  for (let n = r.varint(); n-- > 0; ) endings.push(readEnding(r));
  const items: ItemPlacement[] = [];
  for (let n = r.varint(); n-- > 0; ) items.push(readPlacement(r));
  const events: RoomEvent[] = [];
  for (let n = r.varint(); n-- > 0; ) events.push(readEvent(r));
  const overlays: TileOverlay[] = [];
  for (let n = r.varint(); n-- > 0; ) overlays.push(readOverlay(r));
  return { id, name, palId, songId, tiles, pmap, exits, endings, items, events, overlays };
}

function writeExit(w: Writer, e: Exit) {
  w.u8(e.x);
  w.u8(e.y);
  w.str(e.destRoom);
  w.u8(e.destX);
  w.u8(e.destY);
  writeOpt(w, e.req, (v) => writeCond(w, v));
  writeOpt(w, e.lockedDlgId, (v) => w.str(v));
  writeOpt(w, e.transition, (v) => w.str(v));
}
function readExit(r: Reader): Exit {
  const x = r.u8();
  const y = r.u8();
  const destRoom = r.str();
  const destX = r.u8();
  const destY = r.u8();
  const req = readOpt(r, () => readCond(r));
  const lockedDlgId = readOpt(r, () => r.str());
  const transition = readOpt(r, () => r.str()) as Exit['transition'];
  return { x, y, destRoom, destX, destY, req, lockedDlgId, transition };
}

function writeEnding(w: Writer, e: Ending) {
  w.u8(e.x);
  w.u8(e.y);
  w.str(e.dlgId);
  writeOpt(w, e.req, (v) => writeCond(w, v));
  writeOpt(w, e.lockedDlgId, (v) => w.str(v));
}
function readEnding(r: Reader): Ending {
  return {
    x: r.u8(),
    y: r.u8(),
    dlgId: r.str(),
    req: readOpt(r, () => readCond(r)),
    lockedDlgId: readOpt(r, () => r.str()),
  };
}

function writePlacement(w: Writer, it: ItemPlacement) {
  w.str(it.itemId);
  w.u8(it.x);
  w.u8(it.y);
  writeOpt(w, it.appearCond, (v) => writeCond(w, v));
}
function readPlacement(r: Reader): ItemPlacement {
  return {
    itemId: r.str(),
    x: r.u8(),
    y: r.u8(),
    appearCond: readOpt(r, () => readCond(r)),
  };
}

function writeEvent(w: Writer, ev: RoomEvent) {
  w.u8(ev.x);
  w.u8(ev.y);
  writeOpt(w, ev.cond, (v) => writeCond(w, v));
  w.bool(!!ev.once);
  w.varint(ev.actions.length);
  for (const a of ev.actions) writeAction(w, a);
}
function readEvent(r: Reader): RoomEvent {
  const x = r.u8();
  const y = r.u8();
  const cond = readOpt(r, () => readCond(r));
  const once = r.bool();
  const actions: Action[] = [];
  for (let n = r.varint(); n-- > 0; ) actions.push(readAction(r));
  const ev: RoomEvent = { x, y, actions };
  if (cond) ev.cond = cond;
  if (once) ev.once = true;
  return ev;
}

function writeOverlay(w: Writer, ov: TileOverlay) {
  w.u8(ov.x);
  w.u8(ov.y);
  // kind is folded into the ref string ('spr:'/'itm:' prefix) so the room
  // format is unchanged across pack versions
  w.str(
    ov.kind === 'sprite'
      ? 'spr:' + ov.tileId
      : ov.kind === 'item'
        ? 'itm:' + ov.tileId
        : ov.tileId,
  );
  writeCond(w, ov.cond);
}
function readOverlay(r: Reader): TileOverlay {
  const x = r.u8();
  const y = r.u8();
  const ref = r.str();
  const cond = readCond(r);
  if (ref.startsWith('spr:')) return { x, y, tileId: ref.slice(4), kind: 'sprite', cond };
  if (ref.startsWith('itm:')) return { x, y, tileId: ref.slice(4), kind: 'item', cond };
  return { x, y, tileId: ref, cond };
}

// -------------------------------------------------------- palettes ----

function writePalette(w: Writer, p: PaletteSet) {
  w.str(p.id);
  w.str(p.name);
  w.u8(p.backdrop);
  for (const row of p.bg) for (const c of row) w.u8(c);
  for (const row of p.spr) for (const c of row) w.u8(c);
}
function readPalette(r: Reader): PaletteSet {
  const id = r.str();
  const name = r.str();
  const backdrop = r.u8();
  const triple = (): [number, number, number] => [r.u8(), r.u8(), r.u8()];
  return {
    id,
    name,
    backdrop,
    bg: [triple(), triple(), triple(), triple()],
    spr: [triple(), triple(), triple(), triple()],
  };
}

// ------------------------------------------------------------- sfx ----

function writeSfxNote(w: Writer, n: SfxNote) {
  w.varint(n.freq);
  w.u8(n.frames);
  w.u8(n.vol);
  w.u8(n.duty);
}
function readSfxNote(r: Reader): SfxNote {
  return { freq: r.varint(), frames: r.u8(), vol: r.u8(), duty: r.u8() as 0 };
}

// ------------------------------------------------------------ song ----

function writeChan(w: Writer, c: SongChannelParams) {
  w.u8(c.duty);
  w.u8(c.decay);
  w.svarint(c.octave);
}
function readChan(r: Reader): SongChannelParams {
  return { duty: r.u8() as 0, decay: r.u8(), octave: r.svarint() };
}
function writePattern(w: Writer, p: SongPattern) {
  for (const step of p.lead) w.u8(step);
  for (const step of p.melody) w.u8(step);
  for (const step of p.bass) w.u8(step);
  for (const step of p.drum) w.u8(step);
}
function readSteps(r: Reader): number[] {
  const out: number[] = [];
  for (let i = 0; i < 16; i++) out.push(r.u8());
  return out;
}
function writeSong(w: Writer, s: Song) {
  w.str(s.id);
  w.str(s.name);
  w.varint(s.bpm);
  w.u8(s.root);
  w.u8(SCALES.indexOf(s.scale));
  writeChan(w, s.lead);
  writeChan(w, s.melody);
  w.svarint(s.bassOctave);
  w.u8(s.drumDecay);
  w.u8(s.drumMode);
  w.u8(s.patterns.length);
  for (const p of s.patterns) writePattern(w, p);
  w.u8(s.order.length);
  for (const o of s.order) w.u8(o);
}
function readSong(r: Reader): Song {
  const id = r.str();
  const name = r.str();
  const bpm = r.varint();
  const root = r.u8();
  const scale = SCALES[r.u8()] as SongScale;
  const lead = readChan(r);
  const melody = readChan(r);
  const bassOctave = r.svarint();
  const drumDecay = r.u8();
  const drumMode = r.u8() as 0 | 1;
  const patterns: SongPattern[] = [];
  for (let n = r.u8(); n-- > 0; )
    patterns.push({
      lead: readSteps(r),
      melody: readSteps(r),
      bass: readSteps(r),
      drum: readSteps(r),
    });
  const order: number[] = [];
  for (let n = r.u8(); n-- > 0; ) order.push(r.u8());
  return {
    id,
    name,
    bpm,
    root,
    scale,
    lead,
    melody,
    bassOctave,
    drumDecay,
    drumMode,
    patterns,
    order,
  };
}

// ---------------------------------------------------------- splash ----

function writeSplash(w: Writer, s: SplashScreen, table: Map<string, number>) {
  w.str(s.palId);
  writeGrid(w, s.tiles, table);
  writeSubPals(w, s.pmap);
  writeOpt(w, s.songId, (v) => w.str(v));
}
function readSplash(r: Reader, list: string[]): SplashScreen {
  return {
    palId: r.str(),
    tiles: readGrid(r, 224, list),
    pmap: readSubPals(r, 224),
    songId: readOpt(r, () => r.str()),
  };
}

// ------------------------------------------------------- top level ----

/** Encode a game to compact binary (uncompressed — caller deflates it). */
export function packGame(g: GameData): Uint8Array {
  const w = new Writer();
  w.u8(PACK_MAGIC >> 8);
  w.u8(PACK_MAGIC & 0xff);
  w.u8(PACK_VERSION);

  w.str(g.title);
  w.varint(g.version);
  w.str(g.startRoom);
  w.u8(g.startX);
  w.u8(g.startY);
  w.u8(SPEEDS.indexOf(g.textSpeed));
  w.u8(FONTS.indexOf(g.font));
  w.u8(g.extChars === false ? 0 : 1);
  w.u8(g.typewriterSfx ? 1 : 0);

  w.varint(g.palettes.length);
  for (const p of g.palettes) writePalette(w, p);

  w.varint(g.tiles.length);
  for (const t of g.tiles) {
    w.str(t.id);
    w.str(t.name);
    w.bool(t.wall);
    writeFrames(w, t.frames);
  }

  // tile-id table shared by every room/splash grid
  const table = new Map<string, number>([['0', 0]]);
  g.tiles.forEach((t, i) => table.set(t.id, i + 1));

  w.varint(g.sprites.length);
  for (const s of g.sprites) {
    writeDrawable(w, s);
    w.str(s.room);
    w.u8(s.x);
    w.u8(s.y);
    writeOpt(w, s.appearCond, (v) => writeCond(w, v));
  }

  w.varint(g.items.length);
  for (const it of g.items) writeDrawable(w, it);

  w.varint(g.flags.length);
  for (const f of g.flags) {
    w.str(f.id);
    w.str(f.name);
  }

  w.varint(g.variables.length);
  for (const v of g.variables) {
    w.str(v.id);
    w.str(v.name);
    w.u8(v.initial);
  }

  w.varint(g.rooms.length);
  for (const room of g.rooms) writeRoom(w, room, table);

  const dlgKeys = Object.keys(g.dialogs);
  w.varint(dlgKeys.length);
  for (const k of dlgKeys) {
    w.str(k);
    w.str(g.dialogs[k]!);
  }

  writeDrawable(w, g.avatar);

  for (const name of SFX_NAMES) {
    const notes = g.sfx[name] ?? [];
    w.varint(notes.length);
    for (const n of notes) writeSfxNote(w, n);
  }

  w.varint(g.customSfx.length);
  for (const c of g.customSfx) {
    w.str(c.id);
    w.str(c.name);
    w.varint(c.notes.length);
    for (const n of c.notes) writeSfxNote(w, n);
  }

  w.varint(g.songs.length);
  for (const s of g.songs) writeSong(w, s);

  writeOpt(w, g.splash, (v) => writeSplash(w, v, table));

  return w.done();
}

// -------------------------------------------------- cartridge image ----
//
// The compressed game bytes can be laid out as the pixels of a square image
// (3 bytes -> one RGB pixel), scaled up to look like an NES cartridge label.
// These two DOM-free helpers do the byte<->pixel-grid framing; the editor
// wraps them with a canvas to emit / read an actual PNG.

const CART_MAGIC = 0x4e; // 'N' in pixel 0's red channel
const CART_HEADER = 8;

/**
 * Lay `data` out as a square RGB pixel grid. Returns the grid side (in data
 * pixels) and the row-major RGB bytes (side*side*3, zero-padded). Pixel 0
 * carries {magic, scale, side} so a reader can recover the geometry.
 */
export function frameCartridge(
  data: Uint8Array,
  scale: number,
): { side: number; rgb: Uint8Array } {
  const pixels = Math.ceil((CART_HEADER + data.length) / 3);
  const side = Math.max(1, Math.ceil(Math.sqrt(pixels)));
  if (side > 255) throw new Error('game too large for a cartridge image');
  const rgb = new Uint8Array(side * side * 3);
  rgb[0] = CART_MAGIC;
  rgb[1] = scale & 0xff;
  rgb[2] = side & 0xff;
  rgb[3] = 0x54; // 'T' — format tag
  rgb[4] = data.length & 0xff;
  rgb[5] = (data.length >> 8) & 0xff;
  rgb[6] = (data.length >> 16) & 0xff;
  rgb[7] = (data.length >> 24) & 0xff;
  rgb.set(data, CART_HEADER);
  return { side, rgb };
}

/** Read the {scale, side} geometry from pixel 0 of a cartridge image. */
export function cartridgeGeometry(pixel0: [number, number, number]): {
  scale: number;
  side: number;
} {
  if (pixel0[0] !== CART_MAGIC) throw new Error('not a NESty cartridge image');
  return { scale: pixel0[1], side: pixel0[2] };
}

/**
 * Recover the framed data. `readPixel(i)` returns the RGB of data-pixel i
 * (the caller samples the top-left of each scaled block).
 */
export function unframeCartridge(
  readPixel: (i: number) => [number, number, number],
): Uint8Array {
  const { side } = cartridgeGeometry(readPixel(0));
  const rgb = new Uint8Array(side * side * 3);
  for (let i = 0; i < side * side; i++) {
    const [r, g, b] = readPixel(i);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  const len = rgb[4]! | (rgb[5]! << 8) | (rgb[6]! << 16) | (rgb[7]! << 24);
  return rgb.slice(CART_HEADER, CART_HEADER + len);
}

/** Decode compact binary back to a GameData (inverse of packGame). */
export function unpackGame(bytes: Uint8Array): GameData {
  const r = new Reader(bytes);
  const magic = (r.u8() << 8) | r.u8();
  if (magic !== PACK_MAGIC) throw new Error('not a NESty pack');
  const version = r.u8();
  if (version > PACK_VERSION)
    throw new Error(`unsupported pack version ${version}`);

  const title = r.str();
  const ver = r.varint();
  const startRoom = r.str();
  const startX = r.u8();
  const startY = r.u8();
  const textSpeed = SPEEDS[r.u8()]!;
  const font = FONTS[r.u8()]!;
  const extChars = version >= 2 ? r.u8() !== 0 : true;
  const typewriterSfx = version >= 3 ? r.u8() !== 0 : false;

  const palettes: PaletteSet[] = [];
  for (let n = r.varint(); n-- > 0; ) palettes.push(readPalette(r));

  const tiles: TileDef[] = [];
  for (let n = r.varint(); n-- > 0; )
    tiles.push({ id: r.str(), name: r.str(), wall: r.bool(), frames: readFrames(r) });

  const list = ['0', ...tiles.map((t) => t.id)];

  const sprites: SpriteDef[] = [];
  for (let n = r.varint(); n-- > 0; ) {
    const d = readDrawable(r);
    const room = r.str();
    const x = r.u8();
    const y = r.u8();
    const appearCond = readOpt(r, () => readCond(r));
    sprites.push({ ...d, room, x, y, appearCond });
  }

  const items: ItemDef[] = [];
  for (let n = r.varint(); n-- > 0; ) items.push(readDrawable(r));

  const flags: GameData['flags'] = [];
  for (let n = r.varint(); n-- > 0; ) flags.push({ id: r.str(), name: r.str() });

  const variables: GameData['variables'] = [];
  for (let n = r.varint(); n-- > 0; )
    variables.push({ id: r.str(), name: r.str(), initial: r.u8() });

  const rooms: Room[] = [];
  for (let n = r.varint(); n-- > 0; ) rooms.push(readRoom(r, list));

  const dialogs: Record<string, string> = {};
  for (let n = r.varint(); n-- > 0; ) {
    const k = r.str();
    dialogs[k] = r.str();
  }

  const avatar = readDrawable(r);

  const sfx = defaultSfxSet();
  const sfxNames = version >= 3 ? SFX_NAMES : SFX_NAMES_V2;
  for (const name of sfxNames as readonly SfxName[]) {
    const notes: SfxNote[] = [];
    for (let n = r.varint(); n-- > 0; ) notes.push(readSfxNote(r));
    sfx[name] = notes;
  }

  const customSfx: SfxClip[] = [];
  if (version >= 3)
    for (let n = r.varint(); n-- > 0; ) {
      const id = r.str();
      const name = r.str();
      const notes: SfxNote[] = [];
      for (let m = r.varint(); m-- > 0; ) notes.push(readSfxNote(r));
      customSfx.push({ id, name, notes });
    }

  const songs: Song[] = [];
  for (let n = r.varint(); n-- > 0; ) songs.push(readSong(r));

  const splash = readOpt(r, () => readSplash(r, list));

  const g: GameData = {
    title,
    version: ver,
    startRoom,
    startX,
    startY,
    textSpeed,
    ...(typewriterSfx ? { typewriterSfx: true } : {}),
    font,
    // canonical form omits the flag when on (default); only store when off
    ...(extChars ? {} : { extChars: false }),
    palettes,
    tiles,
    sprites,
    items,
    flags,
    variables,
    rooms,
    dialogs,
    avatar,
    sfx,
    customSfx,
    songs,
  };
  if (splash) g.splash = splash;
  return g;
}
