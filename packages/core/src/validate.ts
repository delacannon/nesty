import type { Cond, Diagnostic, GameData } from './types';
import { CELL_COUNT, ROOM_H, ROOM_W, SPLASH_CELLS } from './types';
import { FORBIDDEN_COLOR } from './nesPalette';
import { exitScrollDir, splashHasContent } from './defaults';
import { MAX_ORDER, MAX_PATTERNS, MAX_SONGS, SONG_STEPS } from './song';
import { SFX_NAMES } from './sfx';

export const MAX_ROOMS = 24;
// BG art quads live in CHR slots 96..255 = 160 slots (layout.ts BG_QUAD_BASE).
// Each tile is 1-4 unique quads after dedup, so 160 is the physical BG-art
// ceiling; the real per-build gate is the "background CHR bank overflow" error
// (chrgen), which also accounts for the font/dialog-glyph slots this shares.
export const MAX_TILES = 160;
export const MAX_ENTITIES_PER_ROOM = 15; // sprites + items (avatar = 16th metasprite)
export const MAX_ITEM_PLACEMENTS = 128; // taken-flags bitfield
export const MAX_ANIM_CELLS_PER_ROOM = 32;
export const MAX_FLAGS = 16; // game_flags RAM
export const MAX_VARS = 8; // var_vals RAM
export const MAX_SPRITE_DEFS = 32; // spr_anim_ctl RAM
export const MAX_CUSTOM_SFX = 32; // sfx pointer table (builtins + custom)
export const MAX_EVENTS = 128; // once-bits bitfield (global)
export const MAX_ACTIONS_PER_EVENT = 8;
export const MAX_OVERLAYS_PER_ROOM = 16; // ovl_pend RAM
export const MAX_CONDS = 254; // cond pool, $ff = none

export function validate(game: GameData): Diagnostic[] {
  const d: Diagnostic[] = [];
  const err = (message: string, where?: string) => d.push({ severity: 'error', message, where });
  const warn = (message: string, where?: string) =>
    d.push({ severity: 'warning', message, where });

  if (game.rooms.length === 0) err('game needs at least one room');
  if (game.rooms.length > MAX_ROOMS) err(`too many rooms (${game.rooms.length} > ${MAX_ROOMS})`);
  if (game.tiles.length > MAX_TILES) err(`too many tiles (${game.tiles.length} > ${MAX_TILES})`);

  const roomIds = new Set(game.rooms.map((r) => r.id));
  const tileIds = new Set(game.tiles.map((t) => t.id));
  const itemIds = new Set(game.items.map((i) => i.id));
  const palIds = new Set(game.palettes.map((p) => p.id));
  const flagIds = new Set(game.flags.map((f) => f.id));
  const varIds = new Set(game.variables.map((v) => v.id));
  const sprIds = new Set(game.sprites.map((s) => s.id));
  const songIdSet = new Set(game.songs.map((s) => s.id));
  const customSfxIds = new Set(game.customSfx.map((c) => c.id));
  const sfxNameSet = new Set<string>(SFX_NAMES);

  if (game.flags.length > MAX_FLAGS) err(`too many flags (${game.flags.length} > ${MAX_FLAGS})`);
  if (game.variables.length > MAX_VARS)
    err(`too many variables (${game.variables.length} > ${MAX_VARS})`);
  if (game.sprites.length > MAX_SPRITE_DEFS)
    err(`too many sprites (${game.sprites.length} > ${MAX_SPRITE_DEFS})`);
  for (const v of game.variables) {
    if (v.initial < 0 || v.initial > 255)
      err(`variable '${v.id}' initial out of range 0-255`, `VAR ${v.id}`);
  }

  if (tileIds.has('0')) err(`tile id '0' is reserved for empty`);
  if (!roomIds.has(game.startRoom)) err(`start room '${game.startRoom}' does not exist`);
  if (game.startX < 0 || game.startX >= ROOM_W || game.startY < 0 || game.startY >= ROOM_H)
    err('start position out of bounds');

  const checkDlg = (id: string | undefined, where: string) => {
    if (id !== undefined && game.dialogs[id] === undefined)
      err(`dialog '${id}' does not exist`, where);
  };
  const checkCond = (c: Cond | undefined, where: string) => {
    if (!c) return;
    switch (c.kind) {
      case 'item':
        if (!itemIds.has(c.itemId)) err(`condition item '${c.itemId}' does not exist`, where);
        break;
      case 'count':
        if (!itemIds.has(c.itemId)) err(`condition item '${c.itemId}' does not exist`, where);
        if (c.value < 0 || c.value > 255) err('condition value out of range 0-255', where);
        break;
      case 'flag':
        if (!flagIds.has(c.flagId)) err(`condition flag '${c.flagId}' does not exist`, where);
        break;
      case 'var':
        if (!varIds.has(c.varId)) err(`condition variable '${c.varId}' does not exist`, where);
        if (c.value < 0 || c.value > 255) err('condition value out of range 0-255', where);
        break;
    }
  };

  for (const pal of game.palettes) {
    const all = [pal.backdrop, ...pal.bg.flat(), ...pal.spr.flat()];
    if (all.some((c) => c === FORBIDDEN_COLOR)) warn('color $0D can damage displays; avoid', `PAL ${pal.id}`);
    if (all.some((c) => c < 0 || c > 0x3f)) err('color out of range 00-3F', `PAL ${pal.id}`);
    if (pal.bg.length !== 4 || pal.spr.length !== 4) err('palette needs 4 BG + 4 SPR sub-palettes', `PAL ${pal.id}`);
  }

  for (const t of game.tiles) {
    if (t.frames.length < 1 || t.frames.length > 2) err('tile needs 1 or 2 frames', `TIL ${t.id}`);
  }

  let totalItemPlacements = 0;
  let totalEvents = 0;
  for (const room of game.rooms) {
    const where = `ROOM ${room.id}`;
    if (room.tiles.length !== CELL_COUNT) err(`room map must have ${CELL_COUNT} cells`, where);
    if (room.pmap.length !== CELL_COUNT) err(`pmap must have ${CELL_COUNT} cells`, where);
    if (!palIds.has(room.palId)) err(`palette '${room.palId}' does not exist`, where);
    for (const id of room.tiles) {
      if (id !== '0' && !tileIds.has(id)) {
        err(`unknown tile '${id}' in map`, where);
        break;
      }
    }
    for (const ex of room.exits) {
      if (!roomIds.has(ex.destRoom)) err(`exit destination room '${ex.destRoom}' missing`, where);
      if (ex.destX < 0 || ex.destX >= ROOM_W || ex.destY < 0 || ex.destY >= ROOM_H)
        err('exit destination out of bounds', where);
      checkCond(ex.req, where);
      checkDlg(ex.lockedDlgId, where);
      if (ex.transition === 'scroll' && !exitScrollDir(ex))
        warn(
          `scroll exit at (${ex.x},${ex.y}) is not on a room edge; it will cut instantly`,
          where,
        );
    }
    for (const en of room.endings) {
      checkDlg(en.dlgId, where);
      checkCond(en.req, where);
      checkDlg(en.lockedDlgId, where);
    }
    for (const ip of room.items) {
      if (!itemIds.has(ip.itemId)) err(`unknown item '${ip.itemId}' placed`, where);
      checkCond(ip.appearCond, where);
      totalItemPlacements++;
    }
    if (room.overlays.length > MAX_OVERLAYS_PER_ROOM)
      err(`too many overlays (${room.overlays.length} > ${MAX_OVERLAYS_PER_ROOM})`, where);
    for (const ov of room.overlays) {
      const k = ov.kind ?? 'tile';
      const known =
        k === 'sprite'
          ? sprIds.has(ov.tileId)
          : k === 'item'
            ? itemIds.has(ov.tileId)
            : ov.tileId === '0' || tileIds.has(ov.tileId);
      if (!known) err(`unknown overlay ${k} '${ov.tileId}'`, where);
      checkCond(ov.cond, where);
    }
    for (const ev of room.events) {
      totalEvents++;
      checkCond(ev.cond, where);
      if (ev.actions.length > MAX_ACTIONS_PER_EVENT)
        err(`event at (${ev.x},${ev.y}) has too many actions (> ${MAX_ACTIONS_PER_EVENT})`, where);
      if (ev.actions.filter((a) => a.type === 'showDialog').length > 1)
        warn(`event at (${ev.x},${ev.y}): only the last dialog action shows`, where);
      for (const a of ev.actions) {
        switch (a.type) {
          case 'setFlag':
          case 'clearFlag':
          case 'toggleFlag':
            if (!flagIds.has(a.flagId)) err(`action flag '${a.flagId}' does not exist`, where);
            break;
          case 'setVar':
          case 'addVar':
            if (!varIds.has(a.varId)) err(`action variable '${a.varId}' does not exist`, where);
            if (a.type === 'setVar' && (a.value < 0 || a.value > 255))
              err('setVar value out of range 0-255', where);
            if (a.type === 'addVar' && (a.delta < -128 || a.delta > 127))
              err('addVar delta out of range -128..127', where);
            break;
          case 'showDialog':
            checkDlg(a.dlgId, where);
            break;
          case 'spriteAnim':
            if (!sprIds.has(a.spriteId)) err(`action sprite '${a.spriteId}' does not exist`, where);
            break;
          case 'playSfx':
            if (!sfxNameSet.has(a.sfxId) && !customSfxIds.has(a.sfxId))
              err(`action sound '${a.sfxId}' does not exist`, where);
            break;
          case 'playSong':
            if (a.songId !== undefined && !songIdSet.has(a.songId))
              err(`action song '${a.songId}' does not exist`, where);
            break;
        }
      }
    }
    const sprites = game.sprites.filter((s) => s.room === room.id);
    const entities = sprites.length + room.items.length;
    if (entities > MAX_ENTITIES_PER_ROOM)
      err(`too many sprites+items in room (${entities} > ${MAX_ENTITIES_PER_ROOM})`, where);
    // sprite scanline warning: >3 entities (plus avatar potential) on one cell row
    const rowCounts = new Map<number, number>();
    for (const s of sprites) rowCounts.set(s.y, (rowCounts.get(s.y) ?? 0) + 1);
    for (const ip of room.items) rowCounts.set(ip.y, (rowCounts.get(ip.y) ?? 0) + 1);
    for (const [y, n] of rowCounts) {
      if (n >= 4) warn(`${n} entities on row ${y}: NES will flicker/drop sprites`, where);
    }
    // BG sub-palette 3 is hijacked (black/highlight/white) while a dialog is
    // open — tiles painted with it flash to those colors under every dialog
    const sub3Cells = room.tiles.filter(
      (id, i) => id !== '0' && room.pmap[i] === 3,
    ).length;
    if (sub3Cells > 0)
      warn(
        `${sub3Cells} cell(s) use BG sub-palette 3, which recolors to the dialog palette while any dialog is open`,
        where,
      );
    // worst-case animated cells: base map plus overlay variants (either may show)
    const isAnim = (id: string) =>
      id !== '0' && (game.tiles.find((t) => t.id === id)?.frames.length ?? 1) > 1;
    const ovlFramesLen = (ov: (typeof room.overlays)[number]) => {
      const k = ov.kind ?? 'tile';
      const d =
        k === 'sprite'
          ? game.sprites.find((sp) => sp.id === ov.tileId)
          : k === 'item'
            ? game.items.find((it) => it.id === ov.tileId)
            : game.tiles.find((t) => t.id === ov.tileId);
      return d?.frames.length ?? 1;
    };
    const animCells = room.tiles.filter(isAnim).length;
    const animOverlays = room.overlays.filter((ov) => ovlFramesLen(ov) > 1).length;
    if (animCells + animOverlays > MAX_ANIM_CELLS_PER_ROOM)
      err(
        `too many animated cells (${animCells + animOverlays} > ${MAX_ANIM_CELLS_PER_ROOM})`,
        where,
      );
  }
  if (totalItemPlacements > MAX_ITEM_PLACEMENTS)
    err(`too many item placements (${totalItemPlacements} > ${MAX_ITEM_PLACEMENTS})`);
  if (totalEvents > MAX_EVENTS) err(`too many events (${totalEvents} > ${MAX_EVENTS})`);

  if (game.songs.length > MAX_SONGS)
    err(`too many songs (${game.songs.length} > ${MAX_SONGS})`);
  const songIds = new Set<string>();
  for (const song of game.songs) {
    const where = `SONG ${song.id}`;
    if (songIds.has(song.id)) err(`duplicate song id '${song.id}'`, where);
    songIds.add(song.id);
    if (song.bpm < 40 || song.bpm > 240) err('bpm out of range 40-240', where);
    for (const oct of [song.lead.octave, song.melody.octave, song.bassOctave])
      if (oct < -2 || oct > 2) {
        err('octave out of range -2..2', where);
        break;
      }
    if (song.patterns.length < 1 || song.patterns.length > MAX_PATTERNS)
      err(`needs 1-${MAX_PATTERNS} patterns`, where);
    if (song.order.length < 1 || song.order.length > MAX_ORDER)
      err(`order needs 1-${MAX_ORDER} entries`, where);
    for (const o of song.order)
      if (o < 0 || o >= song.patterns.length) {
        err(`order references missing pattern ${o}`, where);
        break;
      }
    for (const p of song.patterns) {
      for (const ch of [p.lead, p.melody, p.bass, p.drum]) {
        if (ch.length !== SONG_STEPS || ch.some((v) => v < 0 || v > 16)) {
          err(`pattern channel needs ${SONG_STEPS} steps with values 0-16`, where);
          break;
        }
      }
    }
  }
  for (const room of game.rooms) {
    if (room.songId !== undefined && !songIds.has(room.songId))
      err(`song '${room.songId}' does not exist`, `ROOM ${room.id}`);
  }

  if (splashHasContent(game.splash)) {
    const where = 'SPLASH';
    if (game.splash.tiles.length !== SPLASH_CELLS)
      err(`splash map must have ${SPLASH_CELLS} cells`, where);
    if (game.splash.pmap.length !== SPLASH_CELLS)
      err(`splash pmap must have ${SPLASH_CELLS} cells`, where);
    if (!palIds.has(game.splash.palId))
      err(`palette '${game.splash.palId}' does not exist`, where);
    if (game.splash.songId !== undefined && !songIds.has(game.splash.songId))
      err(`song '${game.splash.songId}' does not exist`, where);
    for (const id of game.splash.tiles) {
      if (id !== '0' && !tileIds.has(id)) {
        err(`unknown tile '${id}' in splash map`, where);
        break;
      }
    }
  }

  for (const s of game.sprites) {
    if (!roomIds.has(s.room)) err(`sprite room '${s.room}' missing`, `SPR ${s.id}`);
    checkDlg(s.dlgId, `SPR ${s.id}`);
    checkDlg(s.altDlgId, `SPR ${s.id}`);
    checkCond(s.altCond, `SPR ${s.id}`);
    checkCond(s.appearCond, `SPR ${s.id}`);
  }
  for (const i of game.items) {
    checkDlg(i.dlgId, `ITM ${i.id}`);
    checkDlg(i.altDlgId, `ITM ${i.id}`);
    checkCond(i.altCond, `ITM ${i.id}`);
  }

  if (game.customSfx.length > MAX_CUSTOM_SFX)
    err(`too many custom sounds (${game.customSfx.length} > ${MAX_CUSTOM_SFX})`);
  const seenSfx = new Set<string>();
  for (const c of game.customSfx) {
    const where = `CSFX ${c.id}`;
    if (seenSfx.has(c.id)) err(`duplicate sound id '${c.id}'`, where);
    seenSfx.add(c.id);
    if (sfxNameSet.has(c.id))
      err(`sound id '${c.id}' collides with a builtin sound name`, where);
    if (c.notes.length === 0) warn('sound has no notes', where);
  }
  if (game.typewriterSfx && game.textSpeed === 'instant')
    warn("typewriter SFX has no effect while text speed is 'instant'");

  return d;
}
