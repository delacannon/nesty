/**
 * GameData → data.asm: every ROM table the engine expects.
 * Readable and commented — this text is half the value of the .asm download.
 */
import type { Action, Cmp, Cond, Exit, GameData, Room } from '@nesty/core';
import { exitScrollDir, overlayRefKey, SPLASH_H, SPLASH_W, splashHasContent } from '@nesty/core';
import { overlayBgRefs, type ChrResult, type Quad } from './chrgen';
import { encodeDialog, textToTiles } from './dialogEncode';
import { fontExtChars } from './font';
import { encodeAllSfx, sfxIndexOf, sfxLabels } from './sfxgen';
import { encodeSongBlob, encodeSongOrder, encodeSongPatterns } from './songgen';

const hex = (n: number) => '$' + (n & 0xff).toString(16).padStart(2, '0');

// slide step must divide the 16px cell evenly so the avatar lands on-grid
const clampStep = (n: number) => {
  const allowed = [1, 2, 4, 8, 16];
  return allowed.includes(n) ? n : 4;
};

function byteLines(
  label: string,
  bytes: number[],
  comment?: string,
  perLine = 16,
): string {
  const out: string[] = [];
  if (comment) out.push(`; ${comment}`);
  out.push(`${label}:`);
  if (bytes.length === 0) out.push('  ; (empty)');
  for (let i = 0; i < bytes.length; i += perLine) {
    out.push(
      '  .byte ' +
        bytes
          .slice(i, i + perLine)
          .map(hex)
          .join(','),
    );
  }
  return out.join('\n');
}

export interface DatagenResult {
  asm: string;
  report: {
    dialogBytes: number;
    roomBytes: number;
  };
}

export function datagen(game: GameData, chr: ChrResult): DatagenResult {
  const parts: string[] = ['; ==== game data (generated) ===='];

  // ---- index mappings ----
  // BG tile table = game.tiles, then sprite/item drawables referenced by
  // overlays (appended so overlays can swap a cell to their graphic).
  const ovlRefs = overlayBgRefs(game);
  const tileIndex = new Map<string, number>([['0', 0]]);
  game.tiles.forEach((t, i) => tileIndex.set(t.id, i + 1));
  ovlRefs.forEach((ref, i) =>
    tileIndex.set(ref.key, game.tiles.length + 1 + i),
  );
  const roomIndex = new Map<string, number>();
  game.rooms.forEach((r, i) => roomIndex.set(r.id, i));
  const dlgIds = Object.keys(game.dialogs);
  const dlgIndex = new Map<string, number>();
  dlgIds.forEach((id, i) => dlgIndex.set(id, i));
  const sprDefIndex = new Map<string, number>();
  game.sprites.forEach((s, i) => sprDefIndex.set(s.id, i));
  const itmDefIndex = new Map<string, number>();
  game.items.forEach((it, i) => itmDefIndex.set(it.id, i));
  const songIndex = new Map<string, number>();
  game.songs.forEach((s, i) => songIndex.set(s.id, i));

  const flagIndex = new Map<string, number>();
  game.flags.forEach((f, i) => flagIndex.set(f.id, i));
  const varIndex = new Map<string, number>();
  game.variables.forEach((v, i) => varIndex.set(v.id, i));

  const pos = (x: number, y: number) => ((y & 0x0f) << 4) | (x & 0x0f);
  const dlgOf = (id: string | undefined) =>
    id !== undefined && dlgIndex.has(id) ? dlgIndex.get(id)! : 0xff;

  // Cond pool: every distinct condition becomes one 3-byte record
  // {op, idx, value}; cond fields elsewhere hold the pool index ($ff = none).
  // op: 1-4 item count GE/LT/EQ/NE, 5 flag set, 6 flag clear, 7-10 var GE/LT/EQ/NE
  const CMP_OFF: Record<Cmp, number> = { '>=': 0, '<': 1, '==': 2, '!=': 3 };
  const condPool: [number, number, number][] = [];
  const condKeys = new Map<string, number>();
  const condOf = (c: Cond | undefined): number => {
    if (!c) return 0xff;
    let rec: [number, number, number];
    switch (c.kind) {
      case 'item': {
        const idx = itmDefIndex.get(c.itemId);
        if (idx === undefined) return 0xff;
        rec = c.negate ? [2, idx, 1] : [1, idx, 1]; // count<1 / count>=1
        break;
      }
      case 'count': {
        const idx = itmDefIndex.get(c.itemId);
        if (idx === undefined) return 0xff;
        rec = [1 + CMP_OFF[c.cmp], idx, c.value & 0xff];
        break;
      }
      case 'flag': {
        const idx = flagIndex.get(c.flagId);
        if (idx === undefined) return 0xff;
        rec = [c.negate ? 6 : 5, idx, 0];
        break;
      }
      case 'var': {
        const idx = varIndex.get(c.varId);
        if (idx === undefined) return 0xff;
        rec = [7 + CMP_OFF[c.cmp], idx, c.value & 0xff];
        break;
      }
    }
    const key = rec.join(',');
    let i = condKeys.get(key);
    if (i === undefined) {
      i = condPool.length;
      condKeys.set(key, i);
      condPool.push(rec);
    }
    return i;
  };

  // Action record: 3 bytes {op, a1, a2}.
  // op: 1 setFlag, 2 clearFlag, 3 toggleFlag (a1=flag); 4 setVar, 5 addVar
  // (a1=var, a2=value/delta); 6 dialog (a1=dlg); 7 spriteAnim (a1=spr, a2=mode);
  // 8 playSfx (a1=sfx index); 9 playSong (a1=song index, $ff=stop)
  const ANIM_MODE = { anim: 0, f0: 1, f1: 2 } as const;
  const actionBytes = (a: Action): [number, number, number] | null => {
    switch (a.type) {
      case 'setFlag':
      case 'clearFlag':
      case 'toggleFlag': {
        const idx = flagIndex.get(a.flagId);
        if (idx === undefined) return null;
        return [a.type === 'setFlag' ? 1 : a.type === 'clearFlag' ? 2 : 3, idx, 0];
      }
      case 'setVar': {
        const idx = varIndex.get(a.varId);
        return idx === undefined ? null : [4, idx, a.value & 0xff];
      }
      case 'addVar': {
        const idx = varIndex.get(a.varId);
        return idx === undefined ? null : [5, idx, a.delta & 0xff];
      }
      case 'showDialog':
        return [6, dlgOf(a.dlgId), 0];
      case 'spriteAnim': {
        const idx = sprDefIndex.get(a.spriteId);
        return idx === undefined ? null : [7, idx, ANIM_MODE[a.mode]];
      }
      case 'playSfx':
        return [8, sfxIndexOf(game, a.sfxId), 0];
      case 'playSong':
        return [
          9,
          a.songId === undefined ? 0xff : (songIndex.get(a.songId) ?? 0xff),
          0,
        ];
    }
  };

  // ---- header ----
  parts.push(`start_room:\n  .byte ${hex(roomIndex.get(game.startRoom) ?? 0)}`);
  parts.push(`start_pos:\n  .byte ${hex(pos(game.startX, game.startY))}`);
  // ---- avatar movement: smooth-slide flag + px/frame step ----
  const smooth = game.smoothMove ? 1 : 0;
  const step = smooth ? clampStep(game.moveSpeed ?? 4) : 0;
  parts.push(`move_smooth:\n  .byte ${hex(smooth)}`);
  parts.push(`move_step:\n  .byte ${hex(step)}`);
  parts.push(`move_cont:\n  .byte ${hex(smooth && game.moveCont ? 1 : 0)}`);

  // ---- dialog typewriter pacing: chars per tick, frames per tick ----
  // 'instant' types 20 chars/frame (vram_buf-safe), a page lands in ~3 frames
  const TEXT_PACE: Record<string, [number, number]> = {
    instant: [20, 0],
    slow: [1, 4],
    normal: [1, 2],
    fast: [1, 0],
    turbo: [2, 0],
  };
  const [twChars, twDelay] = TEXT_PACE[game.textSpeed] ?? TEXT_PACE.turbo!;
  parts.push(`text_chars:\n  .byte ${hex(twChars)}`);
  parts.push(`text_delay:\n  .byte ${hex(twDelay)}`);
  // per-char typewriter blip: only meaningful while typewriter is on (delay>0)
  const twSfx = game.typewriterSfx && game.textSpeed !== 'instant' ? 1 : 0;
  parts.push(`tw_sfx:\n  .byte ${hex(twSfx)}`);

  // extended glyphs are dropped from CHR when disabled → encode without them
  const extStr = game.extChars !== false ? fontExtChars(game.font) : '';

  // ---- title texts (lo addr byte, len, tile bytes) ----
  const mkText = (label: string, text: string, rowLoBase: number): string => {
    const t = textToTiles(text.slice(0, 30), game.font, extStr, chr.fontSlots);
    const col = Math.max(0, Math.floor((32 - t.length) / 2));
    return byteLines(
      label,
      [rowLoBase + col, t.length, ...t],
      `"${text.slice(0, 30)}"`,
    );
  };
  parts.push(mkText('title_text', game.title || 'UNTITLED', 0xa0)); // NT row 13: $21A0
  parts.push(mkText('press_text', 'PRESS START', 0x00)); // NT row 16: $2200
  parts.push(mkText('end_text', 'THE END', 0xc0)); // NT row 14: $21C0

  // ---- splash screen (shown instead of the text title when present) ----
  // splash_pal: 32 palette bytes; splash_nt + splash_attr: contiguous 1024
  // bytes the engine copies straight to $2000-$23FF with rendering off.
  if (splashHasContent(game.splash)) {
    const sp = game.splash;
    parts.push(`has_splash:\n  .byte $01`);
    parts.push(
      `splash_song:\n  .byte ${hex(
        sp.songId !== undefined ? (songIndex.get(sp.songId) ?? 0xff) : 0xff,
      )}`,
    );
    const pal =
      game.palettes.find((p) => p.id === sp.palId) ?? game.palettes[0]!;
    const palBytes: number[] = [];
    for (const triplet of pal.bg) palBytes.push(pal.backdrop, ...triplet);
    for (const triplet of pal.spr) palBytes.push(pal.backdrop, ...triplet);
    parts.push(byteLines('splash_pal', palBytes, 'splash palette'));

    const nt = new Array<number>(960).fill(0);
    for (let cy = 0; cy < SPLASH_H; cy++) {
      for (let cx = 0; cx < SPLASH_W; cx++) {
        const id = sp.tiles[cy * SPLASH_W + cx]!;
        if (id === '0') continue;
        const quads = chr.bgQuads.get(id);
        if (!quads) continue;
        const [tl, tr, bl, br] = quads[0];
        nt[cy * 2 * 32 + cx * 2] = tl;
        nt[cy * 2 * 32 + cx * 2 + 1] = tr;
        nt[(cy * 2 + 1) * 32 + cx * 2] = bl;
        nt[(cy * 2 + 1) * 32 + cx * 2 + 1] = br;
      }
    }
    const spAttr = new Array<number>(64).fill(0);
    for (let cy = 0; cy < SPLASH_H; cy++) {
      for (let cx = 0; cx < SPLASH_W; cx++) {
        const p = sp.pmap[cy * SPLASH_W + cx]! & 3;
        const idx = (cy >> 1) * 8 + (cx >> 1);
        const shift = ((cy & 1) << 2) | ((cx & 1) << 1);
        spAttr[idx] = spAttr[idx]! | (p << shift);
      }
    }
    parts.push(byteLines('splash_nt', nt, 'splash nametable (32×30 tiles)'));
    parts.push(byteLines('splash_attr', spAttr, 'splash attribute table'));
  } else {
    parts.push(`has_splash:\n  .byte $00`);
    parts.push(`splash_song:\n  .byte $ff`);
    parts.push('splash_pal:\nsplash_nt:\nsplash_attr:\n  .byte $00');
  }

  // ---- tiles (game tiles, then overlay-referenced sprite/item drawables) ----
  const nTiles = game.tiles.length + 1 + ovlRefs.length;
  const flags: number[] = [0];
  const qf0: number[] = [0, 0, 0, 0];
  const qf1: number[] = [0, 0, 0, 0];
  for (const t of game.tiles) {
    flags.push((t.wall ? 1 : 0) | (t.frames.length > 1 ? 2 : 0));
    const [f0, f1] = chr.bgQuads.get(t.id)!;
    qf0.push(...f0);
    qf1.push(...f1);
  }
  for (const ref of ovlRefs) {
    // sprite/item overlays are never walls; animated when they have 2 frames
    flags.push(ref.frames.length > 1 ? 2 : 0);
    const [f0, f1] = chr.bgQuads.get(ref.key)!;
    qf0.push(...f0);
    qf1.push(...f1);
  }
  parts.push(
    byteLines('tile_flags', flags, `${nTiles} tiles: bit0 wall, bit1 animated`),
  );
  parts.push(
    byteLines(
      'tile_quads_f0',
      qf0,
      'CHR quads per tile, frame 0: TL TR BL BR',
      4,
    ),
  );
  parts.push(
    byteLines('tile_quads_f1', qf1, 'frame 1 (same as f0 when static)', 4),
  );

  // ---- avatar ----
  const [av0, av1] = chr.sprQuads.get('AVA')!;
  parts.push(byteLines('avatar_quads_f0', [...av0]));
  parts.push(byteLines('avatar_quads_f1', [...av1]));
  parts.push(`avatar_attr:\n  .byte ${hex(game.avatar.sprPal)}`);
  const [avu0, avu1] = chr.sprQuads.get('AVU')!;
  const [avd0, avd1] = chr.sprQuads.get('AVD')!;
  parts.push(byteLines('avatar_up_quads_f0', [...avu0]));
  parts.push(byteLines('avatar_up_quads_f1', [...avu1]));
  parts.push(byteLines('avatar_down_quads_f0', [...avd0]));
  parts.push(byteLines('avatar_down_quads_f1', [...avd1]));
  parts.push(`avatar_flip:\n  .byte ${hex(game.avatar.flipOnMove ? 1 : 0)}`);

  // ---- sprite defs ----
  const emitDefs = (
    prefix: string,
    defs: {
      quads: [Quad, Quad];
      pal: number;
      dlg: number;
      cond: number;
      altDlg: number;
    }[],
  ): void => {
    parts.push(
      byteLines(
        `${prefix}_quads_f0`,
        defs.flatMap((d) => [...d.quads[0]]),
        undefined,
        4,
      ),
    );
    parts.push(
      byteLines(
        `${prefix}_quads_f1`,
        defs.flatMap((d) => [...d.quads[1]]),
        undefined,
        4,
      ),
    );
    parts.push(
      byteLines(
        `${prefix}_attrs`,
        defs.map((d) => d.pal),
      ),
    );
    parts.push(
      byteLines(
        `${prefix}_dlgs`,
        defs.map((d) => d.dlg),
      ),
    );
    parts.push(
      byteLines(
        `${prefix}_conds`,
        defs.map((d) => d.cond),
        'cond pool index; $ff none',
      ),
    );
    parts.push(
      byteLines(
        `${prefix}_alt_dlgs`,
        defs.map((d) => d.altDlg),
      ),
    );
  };
  emitDefs(
    'spr',
    game.sprites.map((s) => ({
      quads: chr.sprQuads.get(s.id)!,
      pal: s.sprPal,
      dlg: dlgOf(s.dlgId),
      cond: condOf(s.altCond),
      altDlg: dlgOf(s.altDlgId),
    })),
  );
  emitDefs(
    'itm',
    game.items.map((it) => ({
      quads: chr.sprQuads.get('itm:' + it.id)!,
      pal: it.sprPal,
      dlg: dlgOf(it.dlgId),
      cond: condOf(it.altCond),
      altDlg: dlgOf(it.altDlgId),
    })),
  );

  // ---- dialogs ----
  // [wave] glyph pair range: engine spots wavy cells by CHR index
  parts.push(`wave_first:\n  .byte ${hex(chr.waveFirst)}`);
  parts.push(`wave_end:\n  .byte ${hex(chr.waveEnd)}`);
  let dialogBytes = 0;
  parts.push(
    `dlg_lo:\n  .byte ${dlgIds.length ? dlgIds.map((_, i) => `<dlg_${i}`).join(',') : '$00'}`,
  );
  parts.push(
    `dlg_hi:\n  .byte ${dlgIds.length ? dlgIds.map((_, i) => `>dlg_${i}`).join(',') : '$00'}`,
  );
  dlgIds.forEach((id, i) => {
    const bytes = encodeDialog(
      game.dialogs[id]!,
      game.font,
      chr.line2Tiles,
      chr.colorTiles,
      chr.colorLine2Tiles,
      chr.wavyTiles,
      chr.wavyColorTiles,
      extStr,
      chr.fontSlots,
    );
    dialogBytes += bytes.length;
    parts.push(byteLines(`dlg_${i}`, bytes, `DLG ${id}`));
  });

  // ---- sound effects (pulse 1 note streams: builtins + custom) ----
  const sfx = encodeAllSfx(game);
  const sfxNames = sfxLabels(game);
  parts.push(`sfx_lo:\n  .byte ${sfx.map((_, i) => `<sfx_${i}`).join(',')}`);
  parts.push(`sfx_hi:\n  .byte ${sfx.map((_, i) => `>sfx_${i}`).join(',')}`);
  sfx.forEach((bytes, i) => {
    parts.push(byteLines(`sfx_${i}`, bytes, `sfx: ${sfxNames[i] ?? i}`));
  });

  // ---- songs (music driver tables) ----
  if (game.songs.length > 0) {
    const idxs = game.songs.map((_, i) => i);
    parts.push(`song_lo:\n  .byte ${idxs.map((i) => `<song_${i}`).join(',')}`);
    parts.push(`song_hi:\n  .byte ${idxs.map((i) => `>song_${i}`).join(',')}`);
    parts.push(
      `song_ord_lo:\n  .byte ${idxs.map((i) => `<song_ord_${i}`).join(',')}`,
    );
    parts.push(
      `song_ord_hi:\n  .byte ${idxs.map((i) => `>song_ord_${i}`).join(',')}`,
    );
    parts.push(
      `song_pat_lo:\n  .byte ${idxs.map((i) => `<song_pat_${i}`).join(',')}`,
    );
    parts.push(
      `song_pat_hi:\n  .byte ${idxs.map((i) => `>song_pat_${i}`).join(',')}`,
    );
    game.songs.forEach((song, i) => {
      parts.push(
        byteLines(`song_${i}`, encodeSongBlob(song), `SONG ${song.id} "${song.name}"`),
      );
      parts.push(byteLines(`song_ord_${i}`, encodeSongOrder(song)));
      parts.push(byteLines(`song_pat_${i}`, encodeSongPatterns(song)));
    });
  } else {
    parts.push(
      'song_lo:\nsong_hi:\nsong_ord_lo:\nsong_ord_hi:\nsong_pat_lo:\nsong_pat_hi:\n  .byte $00',
    );
  }

  // ---- rooms ----
  parts.push(
    `room_table:\n  .word ${game.rooms.map((_, i) => `room_${i}`).join(',') || 'room_0'}`,
  );
  let roomBytes = 0;
  let flagCounter = 0;
  let onceCounter = 0;
  game.rooms.forEach((room, ri) => {
    const bytes = roomRecord(game, room, {
      tileIndex,
      roomIndex,
      songIndex,
      sprDefIndex,
      itmDefIndex,
      dlgOf,
      condOf,
      actionBytes,
      pos,
      nextFlag: () => flagCounter++,
      nextOnce: () => onceCounter++,
    });
    roomBytes += bytes.length;
    parts.push(
      byteLines(`room_${ri}`, bytes, `ROOM ${room.id} "${room.name}"`),
    );
  });

  // ---- logic: cond pool + variable initial values ----
  parts.push(
    byteLines(
      'cond_table',
      condPool.flat(),
      'conds, 3 bytes each: op, idx, value',
      3,
    ),
  );
  const varInit = new Array<number>(8).fill(0);
  game.variables.forEach((v, i) => {
    if (i < 8) varInit[i] = v.initial & 0xff;
  });
  parts.push(byteLines('var_init', varInit, 'variable initial values'));

  parts.push('');
  return { asm: parts.join('\n\n'), report: { dialogBytes, roomBytes } };
}

interface Ctx {
  tileIndex: Map<string, number>;
  roomIndex: Map<string, number>;
  songIndex: Map<string, number>;
  sprDefIndex: Map<string, number>;
  itmDefIndex: Map<string, number>;
  dlgOf: (id: string | undefined) => number;
  condOf: (c: Cond | undefined) => number;
  actionBytes: (a: Action) => [number, number, number] | null;
  pos: (x: number, y: number) => number;
  nextFlag: () => number;
  nextOnce: () => number;
}

const SCROLL_DIR: Record<'E' | 'W' | 'N' | 'S', number> = { E: 0, W: 1, N: 2, S: 3 };
// low nibble type, high nibble scroll direction
const TRANS_TYPE: Record<string, number> = { diag: 2, fade: 3, curtain: 4, blinds: 5 };

function transByte(ex: Exit): number {
  if (ex.transition === 'scroll') {
    const dir = exitScrollDir(ex);
    if (dir === undefined) return 0; // interior exit: cut (validator warns)
    return 1 | (SCROLL_DIR[dir] << 4);
  }
  return TRANS_TYPE[ex.transition ?? ''] ?? 0;
}

function roomRecord(game: GameData, room: Room, ctx: Ctx): number[] {
  const bytes: number[] = [];
  const pal =
    game.palettes.find((p) => p.id === room.palId) ?? game.palettes[0]!;

  // 32 palette bytes: 4 BG then 4 SPR sub-palettes, each [backdrop, c1, c2, c3]
  for (const triplet of pal.bg) bytes.push(pal.backdrop, ...triplet);
  for (const triplet of pal.spr) bytes.push(pal.backdrop, ...triplet);

  // 240-byte map (tile indices)
  for (const id of room.tiles) bytes.push(ctx.tileIndex.get(id) ?? 0);

  // 64-byte attribute table from pmap
  const attr = new Array<number>(64).fill(0);
  for (let cy = 0; cy < 15; cy++) {
    for (let cx = 0; cx < 16; cx++) {
      const p = room.pmap[cy * 16 + cx]! & 3;
      const idx = (cy >> 1) * 8 + (cx >> 1);
      const shift = ((cy & 1) << 2) | ((cx & 1) << 1);
      attr[idx] = attr[idx]! | (p << shift);
    }
  }
  bytes.push(...attr);

  // exits: {pos, dest_room, dest_pos, req, locked_dlg, trans}
  // trans byte: 0 none, 1|dir<<2 scroll (dir 0 E, 1 W, 2 N, 3 S), 2 diag wipe
  bytes.push(room.exits.length);
  for (const ex of room.exits) {
    bytes.push(
      ctx.pos(ex.x, ex.y),
      ctx.roomIndex.get(ex.destRoom) ?? 0,
      ctx.pos(ex.destX, ex.destY),
      ctx.condOf(ex.req),
      ctx.dlgOf(ex.lockedDlgId),
      transByte(ex),
    );
  }
  // endings: {pos, dlg, req, locked_dlg}
  bytes.push(room.endings.length);
  for (const en of room.endings)
    bytes.push(
      ctx.pos(en.x, en.y),
      ctx.dlgOf(en.dlgId),
      ctx.condOf(en.req),
      ctx.dlgOf(en.lockedDlgId),
    );
  // sprites in this room: {pos, def, appear_cond}
  const sprites = game.sprites.filter((s) => s.room === room.id);
  bytes.push(sprites.length);
  for (const s of sprites)
    bytes.push(ctx.pos(s.x, s.y), ctx.sprDefIndex.get(s.id)!, ctx.condOf(s.appearCond));
  // item placements: {pos, def, taken_flag, appear_cond}
  bytes.push(room.items.length);
  for (const ip of room.items)
    bytes.push(
      ctx.pos(ip.x, ip.y),
      ctx.itmDefIndex.get(ip.itemId)!,
      ctx.nextFlag(),
      ctx.condOf(ip.appearCond),
    );
  // events: {pos, cond, evflags(bit0 once), once_idx, nact, nact×3 action bytes}
  bytes.push(room.events.length);
  for (const ev of room.events) {
    const acts = ev.actions
      .map((a) => ctx.actionBytes(a))
      .filter((a): a is [number, number, number] => a !== null);
    bytes.push(
      ctx.pos(ev.x, ev.y),
      ctx.condOf(ev.cond),
      ev.once ? 1 : 0,
      ev.once ? ctx.nextOnce() : 0,
      acts.length,
      ...acts.flat(),
    );
  }
  // tile overlays: {pos, cond, tile} — tile is a BG tile index (game tile or
  // a sprite/item drawable compiled into the BG bank)
  bytes.push(room.overlays.length);
  for (const ov of room.overlays)
    bytes.push(
      ctx.pos(ov.x, ov.y),
      ctx.condOf(ov.cond),
      ctx.tileIndex.get(overlayRefKey(ov)) ?? 0,
    );

  // trailing song byte ($ff = silence)
  bytes.push(
    room.songId !== undefined ? (ctx.songIndex.get(room.songId) ?? 0xff) : 0xff,
  );

  return bytes;
}
