import {
  blankRoom,
  blankSplash,
  defaultAvatar,
  defaultGame,
  defaultPalette,
  frameFromRows,
} from './defaults';
import { defaultSfxSet, SFX_NAMES, type SfxName, type SfxNote } from './sfx';
import {
  blankPattern,
  blankSong,
  SONG_STEPS,
  type Song,
  type SongPattern,
  type SongScale,
} from './song';
import type {
  Action,
  AvatarDef,
  Cmp,
  Cond,
  Drawable,
  ExitTransition,
  FontStyle,
  Frame16,
  GameData,
  NesColor,
  PaletteSet,
  Room,
  SplashScreen,
  SpriteDef,
  SubPal,
  TextSpeed,
} from './types';
import { SPLASH_H, SPLASH_W } from './types';

/**
 * Cond token grammar:
 *   '?k' has item k, '?!k' not has k (legacy),
 *   '?k>=3' item count compare (>=, <, ==, !=),
 *   '?*f' flag f set, '?!*f' flag f clear,
 *   '?$v>=3' variable compare.
 * Returns undefined for other tokens.
 */
function parseCond(tok: string | undefined): Cond | undefined {
  if (!tok || !tok.startsWith('?')) return undefined;
  let body = tok.slice(1);
  let negate = false;
  if (body.startsWith('!')) {
    negate = true;
    body = body.slice(1);
  }
  let sigil: '' | '*' | '$' = '';
  if (body.startsWith('*') || body.startsWith('$')) {
    sigil = body[0] as '*' | '$';
    body = body.slice(1);
  }
  const m = /^(.+?)(>=|==|!=|<)(\d+)$/.exec(body);
  if (m) {
    if (negate || sigil === '*') return undefined;
    const cmp = m[2] as Cmp;
    const value = Number(m[3]);
    if (sigil === '$') return { kind: 'var', varId: m[1]!, cmp, value };
    return { kind: 'count', itemId: m[1]!, cmp, value };
  }
  if (!body) return undefined;
  if (sigil === '*') return { kind: 'flag', flagId: body, negate };
  if (sigil === '$') return undefined;
  return { kind: 'item', itemId: body, negate };
}

/** 'flag+ f' | 'flag- f' | 'flag~ f' | 'var= v n' | 'var+ v n' | 'dlg d' | 'anim s mode'. */
function parseAction(s: string, errors: string[], where: string): Action | undefined {
  const [op, a1, a2] = s.split(/\s+/);
  const bad = () => {
    errors.push(`${where}: bad action '${s}'`);
    return undefined;
  };
  if (!a1) return bad();
  switch (op) {
    case 'flag+':
      return { type: 'setFlag', flagId: a1 };
    case 'flag-':
      return { type: 'clearFlag', flagId: a1 };
    case 'flag~':
      return { type: 'toggleFlag', flagId: a1 };
    case 'var=': {
      const value = Number(a2);
      return Number.isNaN(value) ? bad() : { type: 'setVar', varId: a1, value };
    }
    case 'var+': {
      const delta = Number(a2);
      return Number.isNaN(delta) ? bad() : { type: 'addVar', varId: a1, delta };
    }
    case 'dlg':
      return { type: 'showDialog', dlgId: a1 };
    case 'anim':
      if (a2 === 'anim' || a2 === 'f0' || a2 === 'f1')
        return { type: 'spriteAnim', spriteId: a1, mode: a2 };
      return bad();
    case 'sfx':
      return { type: 'playSfx', sfxId: a1 };
    case 'song':
      return { type: 'playSong', songId: a1 === '-' ? undefined : a1 };
    default:
      return bad();
  }
}

export interface ParseResult {
  game: GameData;
  errors: string[];
}

const MAP_ROW = /^[0-9a-zA-Z]{16}$/;
const PIX_ROW = /^[0-3]{16}$/;

function parseFrames(lines: string[], errors: string[], where: string): Frame16[] {
  const frames: Frame16[] = [];
  let rows: string[] = [];
  const flush = () => {
    if (rows.length > 0) {
      if (rows.length !== 16) errors.push(`${where}: frame has ${rows.length} rows, expected 16`);
      frames.push(frameFromRows(rows));
      rows = [];
    }
  };
  for (const line of lines) {
    if (line.trim() === '>') flush();
    else if (PIX_ROW.test(line.trim())) rows.push(line.trim());
    else errors.push(`${where}: bad pixel row '${line}'`);
  }
  flush();
  if (frames.length === 0) frames.push(frameFromRows([]));
  return frames.slice(0, 2);
}

function parseColor(tok: string, errors: string[], where: string): NesColor {
  const v = parseInt(tok, 16);
  if (Number.isNaN(v) || v < 0 || v > 0x3f) {
    errors.push(`${where}: bad color '${tok}'`);
    return 0x0f;
  }
  return v;
}

function parseTriplet(rest: string, errors: string[], where: string): [number, number, number] {
  const parts = rest.split(',').map((p) => parseColor(p.trim(), errors, where));
  while (parts.length < 3) parts.push(0x0f);
  return [parts[0]!, parts[1]!, parts[2]!] as [number, number, number];
}

function parseXY(tok: string, errors: string[], where: string): [number, number] {
  const m = /^(\d+),(\d+)$/.exec(tok.trim());
  if (!m) {
    errors.push(`${where}: bad position '${tok}'`);
    return [0, 0];
  }
  return [Number(m[1]), Number(m[2])];
}

/** Split into blank-line-separated blocks of lines. */
function blocks(source: string): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') {
      if (cur.length) out.push(cur);
      cur = [];
    } else if (!line.startsWith('#')) cur.push(line);
  }
  if (cur.length) out.push(cur);
  return out;
}

export function parse(source: string): ParseResult {
  const errors: string[] = [];
  const game: GameData = {
    ...defaultGame(),
    palettes: [],
    tiles: [],
    sprites: [],
    items: [],
    rooms: [],
    dialogs: {},
    avatar: defaultAvatar(),
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [],
  };

  const TEXT_SPEEDS: TextSpeed[] = [
    'instant',
    'slow',
    'normal',
    'fast',
    'turbo',
  ];
  const FONT_STYLES: FontStyle[] = ['classic', 'thin', 'bold', 'scifi', 'katakana'];

  for (const block of blocks(source)) {
    let header = false;
    // header block: GAME/VER/START/TEXT/FONT lines
    for (const line of block) {
      if (/^(GAME|VER|START|TEXT|TWSFX|MOVE|FONT|EXT)\b/.test(line)) header = true;
    }
    const first = block[0]!;
    const [kw, ...rest] = first.split(/\s+/);
    const arg = rest.join(' ');

    if (
      header &&
      (kw === 'GAME' ||
        kw === 'VER' ||
        kw === 'START' ||
        kw === 'TEXT' ||
        kw === 'TWSFX' ||
        kw === 'MOVE' ||
        kw === 'FONT' ||
        kw === 'EXT')
    ) {
      for (const line of block) {
        const [k, ...r] = line.split(/\s+/);
        if (k === 'GAME') game.title = r.join(' ');
        else if (k === 'VER') game.version = Number(r[0]) || 1;
        else if (k === 'START') {
          game.startRoom = r[0] ?? '0';
          const [x, y] = parseXY(r[1] ?? '0,0', errors, 'START');
          game.startX = x;
          game.startY = y;
        } else if (k === 'TEXT') {
          const v = r[0] as TextSpeed;
          if (TEXT_SPEEDS.includes(v)) game.textSpeed = v;
          else errors.push(`TEXT: unknown speed '${r[0]}'`);
        } else if (k === 'FONT') {
          const v = r[0] as FontStyle;
          if (FONT_STYLES.includes(v)) game.font = v;
          else errors.push(`FONT: unknown style '${r[0]}'`);
        } else if (k === 'EXT') {
          game.extChars = r[0] !== 'off';
        } else if (k === 'TWSFX') {
          game.typewriterSfx = r[0] === 'on';
        } else if (k === 'MOVE') {
          game.smoothMove = r[0] === 'smooth';
          const sp = Number(r[1]);
          game.moveSpeed = Number.isFinite(sp) && sp > 0 ? sp : 4;
          game.moveCont = r.includes('cont');
        }
      }
      continue;
    }

    switch (kw) {
      case 'PAL':
        game.palettes.push(parsePal(arg, block.slice(1), errors));
        break;
      case 'TIL': {
        const where = `TIL ${arg}`;
        let wall = false;
        let name = arg;
        let i = 1;
        for (; i < block.length; i++) {
          const line = block[i]!;
          if (line.startsWith('NAME ')) name = line.slice(5);
          else if (line.startsWith('WALL ')) wall = line.slice(5).trim() === 'true';
          else break;
        }
        game.tiles.push({
          id: arg,
          name,
          wall,
          frames: parseFrames(block.slice(i), errors, where),
        });
        break;
      }
      case 'ROOM':
        game.rooms.push(parseRoom(arg, block.slice(1), errors));
        break;
      case 'SPLASH':
        game.splash = parseSplash(block.slice(1), errors);
        break;
      case 'SONG':
        game.songs.push(parseSong(arg, block.slice(1), errors));
        break;
      case 'SPR': {
        const { drawable, roomPos, appearCond, bodyStart, body } = parseDrawable(
          arg,
          block.slice(1),
          errors,
        );
        const spr: SpriteDef = {
          ...drawable,
          frames: parseFrames(body.slice(bodyStart), errors, `SPR ${arg}`),
          room: roomPos?.room ?? '0',
          x: roomPos?.x ?? 0,
          y: roomPos?.y ?? 0,
          ...(appearCond ? { appearCond } : {}),
        };
        game.sprites.push(spr);
        break;
      }
      case 'ITM': {
        const { drawable, bodyStart, body } = parseDrawable(arg, block.slice(1), errors);
        game.items.push({
          ...drawable,
          frames: parseFrames(body.slice(bodyStart), errors, `ITM ${arg}`),
        });
        break;
      }
      case 'AVA': {
        const { drawable, bodyStart, body } = parseDrawable('A', block, errors, true);
        const rest = body.slice(bodyStart);
        const upAt = rest.findIndex((l) => l.trim() === 'UP');
        const dnAt = rest.findIndex((l) => l.trim() === 'DOWN');
        const marks = [upAt, dnAt].filter((n) => n >= 0);
        const sideEnd = marks.length ? Math.min(...marks) : rest.length;
        // slice the frame rows that follow a given marker line up to the next
        const seg = (start: number) => {
          const nexts = [upAt, dnAt].filter((n) => n > start);
          const end = nexts.length ? Math.min(...nexts) : rest.length;
          return rest.slice(start + 1, end);
        };
        const av: AvatarDef = {
          ...(drawable as AvatarDef),
          name: drawable.name === 'A' ? 'avatar' : drawable.name,
          frames: parseFrames(rest.slice(0, sideEnd), errors, 'AVA'),
        };
        if (upAt >= 0) av.framesUp = parseFrames(seg(upAt), errors, 'AVA UP');
        if (dnAt >= 0)
          av.framesDown = parseFrames(seg(dnAt), errors, 'AVA DOWN');
        game.avatar = av;
        break;
      }
      case 'DLG':
        game.dialogs[arg] = block.slice(1).join('\n');
        break;
      case 'SFX': {
        if (!(SFX_NAMES as readonly string[]).includes(arg)) {
          errors.push(`SFX: unknown name '${arg}' (use ${SFX_NAMES.join('/')})`);
          break;
        }
        const notes: SfxNote[] = [];
        for (const line of block.slice(1)) {
          const nums = line.split(',').map((v) => Number(v.trim()));
          if (nums.length < 3 || nums.some((n) => Number.isNaN(n))) {
            errors.push(`SFX ${arg}: bad note '${line}' (freq,frames,vol[,duty])`);
            continue;
          }
          notes.push({
            freq: Math.max(30, Math.min(4000, nums[0]!)),
            frames: Math.max(1, Math.min(255, nums[1]!)),
            vol: Math.max(0, Math.min(15, nums[2]!)),
            duty: ((nums[3] ?? 2) & 3) as SfxNote['duty'],
          });
        }
        game.sfx[arg as SfxName] = notes;
        break;
      }
      case 'CSFX': {
        let name = arg;
        const notes: SfxNote[] = [];
        for (const line of block.slice(1)) {
          const [k2, ...r2] = line.split(/\s+/);
          if (k2 === 'NAME') {
            name = r2.join(' ');
            continue;
          }
          const nums = line.split(',').map((v) => Number(v.trim()));
          if (nums.length < 3 || nums.some((n) => Number.isNaN(n))) {
            errors.push(`CSFX ${arg}: bad note '${line}' (freq,frames,vol[,duty])`);
            continue;
          }
          notes.push({
            freq: Math.max(30, Math.min(4000, nums[0]!)),
            frames: Math.max(1, Math.min(255, nums[1]!)),
            vol: Math.max(0, Math.min(15, nums[2]!)),
            duty: ((nums[3] ?? 2) & 3) as SfxNote['duty'],
          });
        }
        game.customSfx.push({ id: arg, name, notes });
        break;
      }
      case 'FLAG': {
        let name = arg;
        for (const line of block.slice(1)) {
          const [k2, ...r2] = line.split(/\s+/);
          if (k2 === 'NAME') name = r2.join(' ');
          else errors.push(`FLAG ${arg}: unknown line '${line}'`);
        }
        game.flags.push({ id: arg, name });
        break;
      }
      case 'VAR': {
        let name = arg;
        let initial = 0;
        for (const line of block.slice(1)) {
          const [k2, ...r2] = line.split(/\s+/);
          if (k2 === 'NAME') name = r2.join(' ');
          else if (k2 === 'INIT') initial = Math.max(0, Math.min(255, Number(r2[0]) || 0));
          else errors.push(`VAR ${arg}: unknown line '${line}'`);
        }
        game.variables.push({ id: arg, name, initial });
        break;
      }
      default:
        errors.push(`unknown section '${kw}'`);
    }
  }

  if (game.palettes.length === 0) game.palettes.push(defaultPalette());
  if (game.rooms.length === 0) game.rooms.push(blankRoom('0', game.palettes[0]!.id));
  return { game, errors };
}

function parsePal(id: string, lines: string[], errors: string[]): PaletteSet {
  const pal = { ...defaultPalette(), id, bg: [] as PaletteSet['bg'], spr: [] as PaletteSet['spr'] };
  for (const line of lines) {
    const [k, ...r] = line.split(/\s+/);
    const rest = r.join(' ');
    if (k === 'NAME') pal.name = rest;
    else if (k === 'BKG') pal.backdrop = parseColor(rest, errors, `PAL ${id}`);
    else if (/^BG[0-3]$/.test(k!)) pal.bg[Number(k![2])] = parseTriplet(rest, errors, `PAL ${id}`);
    else if (/^SP[0-3]$/.test(k!)) pal.spr[Number(k![2])] = parseTriplet(rest, errors, `PAL ${id}`);
    else errors.push(`PAL ${id}: unknown line '${line}'`);
  }
  const dp = defaultPalette();
  for (let i = 0; i < 4; i++) {
    pal.bg[i] = pal.bg[i] ?? dp.bg[i]!;
    pal.spr[i] = pal.spr[i] ?? dp.spr[i]!;
  }
  return pal;
}

function parseRoom(id: string, lines: string[], errors: string[]): Room {
  const room = blankRoom(id);
  const where = `ROOM ${id}`;
  let mapRow = 0;
  let pmapRow = -1; // -1: not in pmap
  for (const line of lines) {
    const [k, ...r] = line.split(/\s+/);
    if (k === 'NAME') room.name = r.join(' ');
    else if (k === 'PAL') room.palId = r[0] ?? '0';
    else if (k === 'SONG') room.songId = r[0];
    else if (k === 'PMAP') pmapRow = 0;
    else if (k === 'EXT') {
      const [x, y] = parseXY(r[0] ?? '', errors, where);
      const [dx, dy] = parseXY(r[2] ?? '', errors, where);
      let rest = r.slice(3);
      let transition: ExitTransition | undefined;
      if (rest[0]?.startsWith('~')) {
        const t = rest[0].slice(1);
        if (
          t === 'scroll' ||
          t === 'diag' ||
          t === 'fade' ||
          t === 'curtain' ||
          t === 'blinds'
        )
          transition = t;
        else errors.push(`${where}: unknown transition '${rest[0]}'`);
        rest = rest.slice(1);
      }
      const req = parseCond(rest[0]);
      room.exits.push({
        x,
        y,
        destRoom: r[1] ?? '0',
        destX: dx,
        destY: dy,
        ...(req ? { req } : {}),
        ...(req && rest[1] !== undefined ? { lockedDlgId: rest[1] } : {}),
        ...(transition ? { transition } : {}),
      });
    } else if (k === 'END') {
      const [x, y] = parseXY(r[1] ?? '', errors, where);
      const req = parseCond(r[2]);
      room.endings.push({
        x,
        y,
        dlgId: r[0] ?? '',
        ...(req ? { req } : {}),
        ...(req && r[3] !== undefined ? { lockedDlgId: r[3] } : {}),
      });
    } else if (k === 'ITM') {
      const [x, y] = parseXY(r[1] ?? '', errors, where);
      const appearCond = parseCond(r[2]);
      if (r[2] !== undefined && !appearCond) errors.push(`${where}: bad cond '${r[2]}'`);
      room.items.push({ itemId: r[0] ?? '', x, y, ...(appearCond ? { appearCond } : {}) });
    } else if (k === 'OVL') {
      const [x, y] = parseXY(r[0] ?? '', errors, where);
      const cond = parseCond(r[2]);
      if (!r[1] || !cond) errors.push(`${where}: expected 'OVL x,y ref ?cond' in '${line}'`);
      else {
        const ref = r[1];
        if (ref.startsWith('spr:'))
          room.overlays.push({ x, y, tileId: ref.slice(4), kind: 'sprite', cond });
        else if (ref.startsWith('itm:'))
          room.overlays.push({ x, y, tileId: ref.slice(4), kind: 'item', cond });
        else room.overlays.push({ x, y, tileId: ref, cond });
      }
    } else if (k === 'EVT') {
      const [x, y] = parseXY(r[0] ?? '', errors, where);
      const rest = r.slice(1);
      let i = 0;
      let once = false;
      if (rest[i] === 'once') {
        once = true;
        i++;
      }
      let cond: Cond | undefined;
      if (rest[i]?.startsWith('?')) {
        cond = parseCond(rest[i]);
        if (!cond) errors.push(`${where}: bad cond '${rest[i]}'`);
        i++;
      }
      if (rest[i] === ':') i++;
      const actions: Action[] = [];
      for (const part of rest
        .slice(i)
        .join(' ')
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)) {
        const a = parseAction(part, errors, where);
        if (a) actions.push(a);
      }
      room.events.push({
        x,
        y,
        ...(cond ? { cond } : {}),
        ...(once ? { once: true } : {}),
        actions,
      });
    } else if (pmapRow >= 0 && pmapRow < 15 && /^[0-3]{16}$/.test(line.trim())) {
      for (let x = 0; x < 16; x++) room.pmap[pmapRow * 16 + x] = Number(line[x]) as SubPal;
      pmapRow++;
    } else if (mapRow < 15 && MAP_ROW.test(line.trim())) {
      for (let x = 0; x < 16; x++) room.tiles[mapRow * 16 + x] = line[x]!;
      mapRow++;
    } else {
      errors.push(`${where}: unexpected line '${line}'`);
    }
  }
  if (mapRow !== 15) errors.push(`${where}: map has ${mapRow} rows, expected 15`);
  return room;
}

const SONG_SCALES: SongScale[] = ['major', 'minor', 'penta', 'chromatic'];

/** '.` = rest, hex digit = grid row (stored as row+1). */
function parseSteps(tok: string, errors: string[], where: string): number[] {
  const out = new Array<number>(SONG_STEPS).fill(0);
  const t = tok.trim();
  if (t.length !== SONG_STEPS)
    errors.push(`${where}: step row has ${t.length} chars, expected ${SONG_STEPS}`);
  for (let i = 0; i < Math.min(t.length, SONG_STEPS); i++) {
    const c = t[i]!;
    if (c === '.') continue;
    const v = parseInt(c, 16);
    if (Number.isNaN(v)) errors.push(`${where}: bad step char '${c}'`);
    else out[i] = v + 1;
  }
  return out;
}

function parseSong(id: string, lines: string[], errors: string[]): Song {
  const song = blankSong(id);
  song.patterns = [];
  song.order = [];
  const where = `SONG ${id}`;
  const clampN = (v: number, lo: number, hi: number, fallback: number) =>
    Number.isNaN(v) ? fallback : Math.max(lo, Math.min(hi, v));
  let cur: SongPattern | null = null;
  for (const line of lines) {
    const [k, ...r] = line.split(/\s+/);
    const rest = r.join(' ');
    if (k === 'NAME') song.name = rest;
    else if (k === 'BPM') song.bpm = clampN(Number(r[0]), 40, 240, 100);
    else if (k === 'ROOT') song.root = clampN(Number(r[0]), 24, 96, 60);
    else if (k === 'SCALE') {
      const v = r[0] as SongScale;
      if (SONG_SCALES.includes(v)) song.scale = v;
      else errors.push(`${where}: unknown scale '${r[0]}'`);
    } else if (k === 'LEAD' || k === 'MEL') {
      const [d, dec, oct] = (r[0] ?? '').split(',').map(Number);
      const p = {
        duty: (clampN(d ?? 0, 0, 3, 2) & 3) as 0 | 1 | 2 | 3,
        decay: clampN(dec ?? 0, 0, 15, 8),
        octave: clampN(oct ?? 0, -2, 2, 0),
      };
      if (k === 'LEAD') song.lead = p;
      else song.melody = p;
    } else if (k === 'BASS')
      song.bassOctave = clampN(Number(r[0]), -2, 2, 0);
    else if (k === 'DRUM') {
      const [dec, mode] = (r[0] ?? '').split(',').map(Number);
      song.drumDecay = clampN(dec ?? 0, 0, 15, 4);
      song.drumMode = (clampN(mode ?? 0, 0, 1, 0) & 1) as 0 | 1;
    }
    else if (k === 'ORDER') {
      song.order = r
        .map(Number)
        .filter((n) => !Number.isNaN(n))
        .map((n) => Math.max(0, n));
    } else if (k === 'L') {
      cur = blankPattern();
      cur.lead = parseSteps(rest, errors, where);
      song.patterns.push(cur);
    } else if (k === 'M' && cur) cur.melody = parseSteps(rest, errors, where);
    else if (k === 'B' && cur) cur.bass = parseSteps(rest, errors, where);
    else if (k === 'D' && cur) cur.drum = parseSteps(rest, errors, where);
    else errors.push(`${where}: unexpected line '${line}'`);
  }
  if (song.patterns.length === 0) song.patterns = [blankPattern()];
  if (song.order.length === 0) song.order = [0];
  return song;
}

function parseSplash(lines: string[], errors: string[]): SplashScreen {
  const sp = blankSplash();
  const where = 'SPLASH';
  let mapRow = 0;
  let pmapRow = -1;
  for (const line of lines) {
    const [k, ...r] = line.split(/\s+/);
    if (k === 'PAL') sp.palId = r[0] ?? '0';
    else if (k === 'SONG') sp.songId = r[0];
    else if (k === 'PMAP') pmapRow = 0;
    else if (pmapRow >= 0 && pmapRow < SPLASH_H && /^[0-3]{16}$/.test(line.trim())) {
      for (let x = 0; x < SPLASH_W; x++)
        sp.pmap[pmapRow * SPLASH_W + x] = Number(line[x]) as SubPal;
      pmapRow++;
    } else if (mapRow < SPLASH_H && MAP_ROW.test(line.trim())) {
      for (let x = 0; x < SPLASH_W; x++) sp.tiles[mapRow * SPLASH_W + x] = line[x]!;
      mapRow++;
    } else {
      errors.push(`${where}: unexpected line '${line}'`);
    }
  }
  if (mapRow !== SPLASH_H)
    errors.push(`${where}: map has ${mapRow} rows, expected ${SPLASH_H}`);
  return sp;
}

function parseDrawable(
  id: string,
  lines: string[],
  errors: string[],
  isAvatar = false,
): {
  drawable: Drawable;
  roomPos?: { room: string; x: number; y: number };
  appearCond?: Cond;
  bodyStart: number;
  body: string[];
} {
  const drawable: Drawable = { id, name: id, frames: [], sprPal: 0 };
  let roomPos: { room: string; x: number; y: number } | undefined;
  let appearCond: Cond | undefined;
  let i = isAvatar ? 1 : 0; // skip the AVA line itself
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const [k, ...r] = line.split(/\s+/);
    if (k === 'NAME') drawable.name = r.join(' ');
    else if (k === 'DLG') drawable.dlgId = r[0];
    else if (k === 'ALT') {
      const cond = parseCond(r[1]);
      if (cond && r[0] !== undefined) {
        drawable.altDlgId = r[0];
        drawable.altCond = cond;
      } else errors.push(`ALT: expected 'ALT dlgId ?item' in '${line}'`);
    } else if (k === 'SPAL') drawable.sprPal = (Number(r[0]) & 3) as SubPal;
    else if (k === 'FLIP' && isAvatar)
      (drawable as { flipOnMove?: boolean }).flipOnMove = true;
    else if (k === 'POS') {
      const [x, y] = parseXY(r[1] ?? '', errors, `POS`);
      roomPos = { room: r[0] ?? '0', x, y };
    } else if (k === 'APPEAR') {
      appearCond = parseCond(r[0]);
      if (!appearCond) errors.push(`APPEAR: bad cond in '${line}'`);
    } else break;
  }
  return { drawable, roomPos, appearCond, bodyStart: i, body: lines };
}
