/**
 * One-way Bitsy -> NESty importer.
 *
 * Bitsy art is 8×8 and drawn at 2× (16 screen px); NESty tiles/sprites are
 * 16×16, so each Bitsy pixel becomes a 2×2 block. Bitsy rooms are 16×16 but a
 * NESty room is 16×15, so the bottom row is dropped (a warning is emitted if
 * it held anything). Bitsy is 1-bit per cell with a 3-colour palette
 * (background / tile / sprite); each colour is snapped to the nearest NES
 * master-palette entry. Music (TUNE/BLIP) and dialog scripting are not
 * translated — a default song is attached so the game still builds.
 */
import { defaultSfxSet } from './sfx';
import { townSong } from './song';
import { nearestNesColor as nearestNes } from './nesPalette';
import { CELL_COUNT, ROOM_H, ROOM_W } from './types';
import type {
  Drawable,
  Frame16,
  GameData,
  ItemDef,
  PaletteSet,
  Pixel,
  Room,
  SpriteDef,
  SubPal,
  TileDef,
  VarDef,
} from './types';

// ------------------------------------------------------------ helpers ----

/** Scale 8 rows of 8 cells up to a 16×16 frame; filled cells -> `on`. */
function scaleFrame(rows: string[], on: Pixel): Frame16 {
  const f = new Array<Pixel>(256).fill(0) as Pixel[];
  for (let y = 0; y < 8; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < 8; x++) {
      if (row[x] && row[x] !== '0') {
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            f[(y * 2 + dy) * 16 + (x * 2 + dx)] = on;
      }
    }
  }
  return f;
}

const isArtRow = (l: string) => /^[0-9]{8}$/.test(l);

/** Split a drawable body into 1-2 frames (Bitsy separates frames with '>'). */
function bodyToFrames(lines: string[], on: Pixel): Frame16[] {
  const frames: string[][] = [[]];
  for (const l of lines) {
    if (l === '>') frames.push([]);
    else if (isArtRow(l)) frames[frames.length - 1]!.push(l);
  }
  const out = frames
    .filter((fr) => fr.length > 0)
    .slice(0, 2)
    .map((fr) => scaleFrame(fr, on));
  return out.length ? out : [scaleFrame([], on)];
}

/** Translate Bitsy dialog effect markup to NESty tags; strip the rest. */
function convertDialog(text: string): string {
  return text
    .replace(/\{wvy\}([\s\S]*?)\{wvy\}/g, '[wave]$1[/wave]')
    .replace(/\{shk\}([\s\S]*?)\{shk\}/g, '[blink]$1[/blink]')
    .replace(/\{rbw\}([\s\S]*?)\{rbw\}/g, '[cycle]$1[/cycle]')
    .replace(/\{clr\d\}([\s\S]*?)\{clr\d\}/g, '[col1]$1[/col1]')
    .replace(/\{[^}]*\}/g, '') // drop remaining scripts / printed vars
    .replace(/\s+/g, ' ')
    .trim();
}

// -------------------------------------------------------------- parse ----

interface Block {
  kind: string;
  id: string;
  lines: string[]; // body lines after the header
}

function splitBlocks(text: string): { title: string; blocks: Block[] } {
  const raw = text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
  const title = (raw[0] ?? '').split('\n')[0]?.trim() || 'imported game';
  const blocks: Block[] = [];
  for (const chunk of raw) {
    const lines = chunk.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i]!.match(/^(PAL|ROOM|TIL|SPR|ITM|DLG|VAR|TUNE|BLIP)\s+(\S+)/);
      if (m) {
        blocks.push({ kind: m[1]!, id: m[2]!, lines: lines.slice(i + 1) });
        // a chunk holds exactly one block header at its top in Bitsy output
        break;
      }
    }
  }
  return { title, blocks };
}

const dlgKey = (id: string) => `d${id}`;

export interface BitsyImportResult {
  game: GameData;
  warnings: string[];
}

/** Convert Bitsy game data text into a NESty GameData. */
export function bitsyToNesty(text: string): BitsyImportResult {
  const warnings: string[] = [];
  const { title, blocks } = splitBlocks(text);

  const palettes: PaletteSet[] = [];
  const tiles: TileDef[] = [];
  const sprites: SpriteDef[] = [];
  const items: ItemDef[] = [];
  const variables: VarDef[] = [];
  const rooms: Room[] = [];
  const dialogs: Record<string, string> = {};
  let avatar: Drawable | undefined;
  let start = { room: '', x: 7, y: 7 };

  // attribute helpers -------------------------------------------------------
  const attr = (lines: string[], key: string): string | undefined => {
    const l = lines.find((x) => x.startsWith(key + ' ') || x === key);
    return l ? l.slice(key.length).trim() : undefined;
  };
  const name = (lines: string[], fallback: string) =>
    attr(lines, 'NAME') || fallback;

  for (const b of blocks) {
    switch (b.kind) {
      case 'PAL': {
        const cols = b.lines
          .filter((l) => /^\d+,\d+,\d+$/.test(l))
          .map((l) => l.split(',').map(Number) as [number, number, number]);
        const bgc = cols[0] ?? [0, 0, 0];
        const tilec = cols[1] ?? cols[0] ?? [255, 255, 255];
        const sprc = cols[2] ?? tilec;
        const bgNes = nearestNes(...tilec);
        const sprNes = nearestNes(...sprc);
        const bgRow: [number, number, number] = [bgNes, bgNes, 0x30];
        const sprRow: [number, number, number] = [sprNes, sprNes, 0x30];
        palettes.push({
          id: b.id,
          name: name(b.lines, 'palette ' + b.id),
          backdrop: nearestNes(...bgc),
          bg: [bgRow, bgRow, bgRow, bgRow],
          spr: [sprRow, sprRow, sprRow, sprRow],
        });
        break;
      }
      case 'TIL': {
        const end = b.lines.findIndex((l) => !isArtRow(l) && l !== '>');
        const body = end === -1 ? b.lines : b.lines.slice(0, end);
        tiles.push({
          id: b.id,
          name: name(b.lines, 'tile ' + b.id),
          wall: attr(b.lines, 'WAL') === 'true' || attr(b.lines, 'WALL') === 'true',
          frames: bodyToFrames(body, 1),
        });
        break;
      }
      case 'SPR':
      case 'ITM': {
        const artEnd = b.lines.findIndex((l) => !isArtRow(l) && l !== '>');
        const body = artEnd === -1 ? b.lines : b.lines.slice(0, artEnd);
        const frames = bodyToFrames(body, 1);
        const dlg = attr(b.lines, 'DLG');
        const dlgId = dlg ? dlgKey(dlg) : undefined;
        if (b.kind === 'ITM') {
          items.push({
            id: b.id,
            name: name(b.lines, 'item ' + b.id),
            frames,
            sprPal: 0,
            dlgId,
          });
        } else if (b.id === 'A') {
          avatar = { id: 'A', name: name(b.lines, 'avatar'), frames, sprPal: 0 };
          const pos = attr(b.lines, 'POS');
          if (pos) {
            const [room, xy] = pos.split(/\s+/);
            const [x, y] = (xy ?? '0,0').split(',').map(Number);
            start = { room: room ?? '', x: x ?? 7, y: Math.min(y ?? 7, ROOM_H - 1) };
          }
        } else {
          const pos = attr(b.lines, 'POS');
          const [room, xy] = (pos ?? '0 0,0').split(/\s+/);
          const [x, y] = (xy ?? '0,0').split(',').map(Number);
          sprites.push({
            id: b.id,
            name: name(b.lines, 'sprite ' + b.id),
            frames,
            sprPal: 0,
            dlgId,
            room: room ?? '',
            x: x ?? 0,
            y: Math.min(y ?? 0, ROOM_H - 1),
          });
        }
        break;
      }
      case 'DLG': {
        const stop = b.lines.findIndex((l) => l.startsWith('NAME'));
        const textLines = (stop === -1 ? b.lines : b.lines.slice(0, stop)).filter(
          (l) => l.trim() !== '',
        );
        dialogs[dlgKey(b.id)] = convertDialog(textLines.join(' '));
        break;
      }
      case 'VAR': {
        const v = Number((b.lines[0] ?? '0').trim());
        variables.push({
          id: b.id,
          name: b.id,
          initial: Math.max(0, Math.min(255, Number.isFinite(v) ? v : 0)),
        });
        break;
      }
      case 'ROOM': {
        const mapRows = b.lines.filter((l) => l.includes(',')).slice(0, ROOM_W);
        const tileCells = new Array<string>(CELL_COUNT).fill('0');
        for (let y = 0; y < ROOM_H; y++) {
          const cells = (mapRows[y] ?? '').split(',');
          for (let x = 0; x < ROOM_W; x++)
            tileCells[y * ROOM_W + x] = cells[x] && cells[x] !== '0' ? cells[x]! : '0';
        }
        const dropped = (mapRows[ROOM_H] ?? '').split(',').some((c) => c && c !== '0');
        if (dropped)
          warnings.push(`room ${b.id}: bottom row dropped (NESty rooms are 15 tall)`);
        rooms.push({
          id: b.id,
          name: name(b.lines, 'room ' + b.id),
          palId: attr(b.lines, 'PAL') ?? palettes[0]?.id ?? '0',
          tiles: tileCells,
          pmap: new Array<SubPal>(CELL_COUNT).fill(0),
          exits: [],
          endings: [],
          items: [],
          events: [],
          overlays: [],
        });
        break;
      }
      case 'TUNE':
      case 'BLIP':
        break; // music/sfx: not translated
      default:
        warnings.push(`skipped unknown block ${b.kind} ${b.id}`);
    }
  }

  if (palettes.length === 0)
    palettes.push({
      id: '0',
      name: 'palette',
      backdrop: 0x0f,
      bg: [[0x30, 0x30, 0x30], [0x30, 0x30, 0x30], [0x30, 0x30, 0x30], [0x30, 0x30, 0x30]],
      spr: [[0x16, 0x16, 0x30], [0x16, 0x16, 0x30], [0x16, 0x16, 0x30], [0x16, 0x16, 0x30]],
    });
  if (rooms.length === 0) warnings.push('no rooms found');
  if (blocks.some((b) => b.kind === 'TUNE' || b.kind === 'BLIP'))
    warnings.push('music (TUNE/BLIP) not converted — using a default song');

  // fix up dangling references so the result validates ---------------------
  const roomIds = new Set(rooms.map((r) => r.id));
  const song = townSong();
  for (const r of rooms) {
    r.songId = song.id;
    if (!palettes.some((p) => p.id === r.palId)) r.palId = palettes[0]!.id;
  }
  if (!roomIds.has(start.room)) start.room = rooms[0]?.id ?? '0';
  for (const s of sprites) if (!roomIds.has(s.room)) s.room = start.room;
  // drop dialog refs that never resolved
  const fixDlg = (id?: string) => (id && dialogs[id] !== undefined ? id : undefined);
  for (const s of sprites) s.dlgId = fixDlg(s.dlgId);
  for (const it of items) it.dlgId = fixDlg(it.dlgId);

  const game: GameData = {
    title,
    version: 2,
    startRoom: start.room,
    startX: start.x,
    startY: start.y,
    textSpeed: 'normal',
    font: 'classic',
    palettes,
    tiles,
    sprites,
    items,
    flags: [],
    variables,
    rooms: rooms.length ? rooms : [blankBitsyRoom(palettes[0]!.id, song.id)],
    dialogs,
    avatar: avatar ?? {
      id: 'A',
      name: 'avatar',
      frames: [scaleFrame([], 1)],
      sprPal: 0,
    },
    sfx: defaultSfxSet(),
    customSfx: [],
    songs: [song],
  };
  return { game, warnings };
}

function blankBitsyRoom(palId: string, songId: string): Room {
  return {
    id: '0',
    name: 'room 0',
    palId,
    songId,
    tiles: new Array<string>(CELL_COUNT).fill('0'),
    pmap: new Array<SubPal>(CELL_COUNT).fill(0),
    exits: [],
    endings: [],
    items: [],
    events: [],
    overlays: [],
  };
}
