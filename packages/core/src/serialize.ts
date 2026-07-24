import { frameToRows, splashHasContent } from './defaults';
import { SFX_NAMES } from './sfx';
import type { Action, Cond, Drawable, GameData } from './types';
import { SPLASH_H, SPLASH_W } from './types';

const cond = (c: Cond): string => {
  switch (c.kind) {
    case 'item':
      return `?${c.negate ? '!' : ''}${c.itemId}`;
    case 'count':
      return `?${c.itemId}${c.cmp}${c.value}`;
    case 'flag':
      return `?${c.negate ? '!' : ''}*${c.flagId}`;
    case 'var':
      return `?$${c.varId}${c.cmp}${c.value}`;
  }
};

const action = (a: Action): string => {
  switch (a.type) {
    case 'setFlag':
      return `flag+ ${a.flagId}`;
    case 'clearFlag':
      return `flag- ${a.flagId}`;
    case 'toggleFlag':
      return `flag~ ${a.flagId}`;
    case 'setVar':
      return `var= ${a.varId} ${a.value}`;
    case 'addVar':
      return `var+ ${a.varId} ${a.delta}`;
    case 'showDialog':
      return `dlg ${a.dlgId}`;
    case 'spriteAnim':
      return `anim ${a.spriteId} ${a.mode}`;
    case 'playSfx':
      return `sfx ${a.sfxId}`;
    case 'playSong':
      return `song ${a.songId ?? '-'}`;
  }
};
const condSuffix = (req?: Cond, lockedDlgId?: string) =>
  req ? ` ${cond(req)}${lockedDlgId !== undefined ? ` ${lockedDlgId}` : ''}` : '';

const hex2 = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
const triplet = (t: [number, number, number]) => t.map(hex2).join(',');

function frames(d: { frames: GameData['avatar']['frames'] }): string {
  return d.frames.map((f) => frameToRows(f).join('\n')).join('\n>\n');
}

function drawableHeader(d: Drawable, appearCond?: Cond): string[] {
  const out = [`NAME ${d.name}`];
  if (d.dlgId !== undefined) out.push(`DLG ${d.dlgId}`);
  if (d.altCond && d.altDlgId !== undefined) out.push(`ALT ${d.altDlgId} ${cond(d.altCond)}`);
  if (appearCond) out.push(`APPEAR ${cond(appearCond)}`);
  out.push(`SPAL ${d.sprPal}`);
  return out;
}

export function serialize(game: GameData): string {
  const s: string[] = [];
  s.push(`# NESty Game`);
  s.push('');
  s.push(`GAME ${game.title}`);
  s.push(`VER ${game.version}`);
  s.push(`START ${game.startRoom} ${game.startX},${game.startY}`);
  s.push(`TEXT ${game.textSpeed}`);
  if (game.typewriterSfx) s.push('TWSFX on');
  if (game.smoothMove)
    s.push(
      `MOVE smooth ${game.moveSpeed ?? 4}${game.moveCont ? ' cont' : ''}`,
    );
  s.push(`FONT ${game.font}`);
  if (game.extChars === false) s.push('EXT off');

  for (const f of game.flags) {
    s.push('');
    s.push(`FLAG ${f.id}`);
    s.push(`NAME ${f.name}`);
  }

  for (const v of game.variables) {
    s.push('');
    s.push(`VAR ${v.id}`);
    s.push(`NAME ${v.name}`);
    s.push(`INIT ${v.initial}`);
  }

  for (const p of game.palettes) {
    s.push('');
    s.push(`PAL ${p.id}`);
    s.push(`NAME ${p.name}`);
    s.push(`BKG ${hex2(p.backdrop)}`);
    p.bg.forEach((t, i) => s.push(`BG${i} ${triplet(t)}`));
    p.spr.forEach((t, i) => s.push(`SP${i} ${triplet(t)}`));
  }

  for (const t of game.tiles) {
    s.push('');
    s.push(`TIL ${t.id}`);
    s.push(`NAME ${t.name}`);
    if (t.wall) s.push(`WALL true`);
    s.push(frames(t));
  }

  for (const room of game.rooms) {
    s.push('');
    s.push(`ROOM ${room.id}`);
    s.push(`NAME ${room.name}`);
    s.push(`PAL ${room.palId}`);
    if (room.songId !== undefined) s.push(`SONG ${room.songId}`);
    for (let y = 0; y < 15; y++) s.push(room.tiles.slice(y * 16, y * 16 + 16).join(''));
    if (room.pmap.some((p) => p !== 0)) {
      s.push('PMAP');
      for (let y = 0; y < 15; y++)
        s.push(
          room.pmap
            .slice(y * 16, y * 16 + 16)
            .map(String)
            .join(''),
        );
    }
    for (const ex of room.exits)
      s.push(
        `EXT ${ex.x},${ex.y} ${ex.destRoom} ${ex.destX},${ex.destY}` +
          (ex.transition ? ` ~${ex.transition}` : '') +
          condSuffix(ex.req, ex.lockedDlgId),
      );
    for (const en of room.endings)
      s.push(`END ${en.dlgId} ${en.x},${en.y}` + condSuffix(en.req, en.lockedDlgId));
    for (const ip of room.items)
      s.push(
        `ITM ${ip.itemId} ${ip.x},${ip.y}` + (ip.appearCond ? ` ${cond(ip.appearCond)}` : ''),
      );
    for (const ov of room.overlays) {
      const ref =
        ov.kind === 'sprite'
          ? `spr:${ov.tileId}`
          : ov.kind === 'item'
            ? `itm:${ov.tileId}`
            : ov.tileId;
      s.push(`OVL ${ov.x},${ov.y} ${ref} ${cond(ov.cond)}`);
    }
    for (const ev of room.events)
      s.push(
        `EVT ${ev.x},${ev.y}` +
          (ev.once ? ' once' : '') +
          (ev.cond ? ` ${cond(ev.cond)}` : '') +
          ` : ${ev.actions.map(action).join('; ')}`,
      );
  }

  for (const sp of game.sprites) {
    s.push('');
    s.push(`SPR ${sp.id}`);
    s.push(...drawableHeader(sp, sp.appearCond));
    s.push(`POS ${sp.room} ${sp.x},${sp.y}`);
    s.push(frames(sp));
  }

  for (const it of game.items) {
    s.push('');
    s.push(`ITM ${it.id}`);
    s.push(...drawableHeader(it));
    s.push(frames(it));
  }

  if (splashHasContent(game.splash)) {
    const sp = game.splash;
    s.push('');
    s.push('SPLASH');
    s.push(`PAL ${sp.palId}`);
    if (sp.songId !== undefined) s.push(`SONG ${sp.songId}`);
    for (let y = 0; y < SPLASH_H; y++)
      s.push(sp.tiles.slice(y * SPLASH_W, y * SPLASH_W + SPLASH_W).join(''));
    if (sp.pmap.some((p) => p !== 0)) {
      s.push('PMAP');
      for (let y = 0; y < SPLASH_H; y++)
        s.push(
          sp.pmap
            .slice(y * SPLASH_W, y * SPLASH_W + SPLASH_W)
            .map(String)
            .join(''),
        );
    }
  }

  s.push('');
  s.push('AVA');
  s.push(`SPAL ${game.avatar.sprPal}`);
  if (game.avatar.flipOnMove) s.push('FLIP');
  s.push(frames(game.avatar));
  if (game.avatar.framesUp?.length) {
    s.push('UP');
    s.push(frames({ frames: game.avatar.framesUp }));
  }
  if (game.avatar.framesDown?.length) {
    s.push('DOWN');
    s.push(frames({ frames: game.avatar.framesDown }));
  }

  for (const [id, text] of Object.entries(game.dialogs)) {
    s.push('');
    s.push(`DLG ${id}`);
    s.push(text);
  }

  for (const name of SFX_NAMES) {
    const notes = game.sfx[name];
    if (!notes || notes.length === 0) continue;
    s.push('');
    s.push(`SFX ${name}`);
    for (const n of notes) s.push(`${n.freq},${n.frames},${n.vol},${n.duty}`);
  }

  for (const clip of game.customSfx) {
    s.push('');
    s.push(`CSFX ${clip.id}`);
    s.push(`NAME ${clip.name}`);
    for (const n of clip.notes) s.push(`${n.freq},${n.frames},${n.vol},${n.duty}`);
  }

  const stepStr = (v: number[]) =>
    v.map((x) => (x === 0 ? '.' : (x - 1).toString(16))).join('');
  for (const song of game.songs) {
    s.push('');
    s.push(`SONG ${song.id}`);
    s.push(`NAME ${song.name}`);
    s.push(`BPM ${song.bpm}`);
    s.push(`ROOT ${song.root}`);
    s.push(`SCALE ${song.scale}`);
    s.push(`LEAD ${song.lead.duty},${song.lead.decay},${song.lead.octave}`);
    s.push(`MEL ${song.melody.duty},${song.melody.decay},${song.melody.octave}`);
    s.push(`BASS ${song.bassOctave}`);
    s.push(`DRUM ${song.drumDecay},${song.drumMode}`);
    s.push(`ORDER ${song.order.join(' ')}`);
    for (const p of song.patterns) {
      s.push(`L ${stepStr(p.lead)}`);
      s.push(`M ${stepStr(p.melody)}`);
      s.push(`B ${stepStr(p.bass)}`);
      s.push(`D ${stepStr(p.drum)}`);
    }
  }

  return s.join('\n') + '\n';
}
