import { useEffect, useRef, useState } from 'react';
import type { Cond, GameData } from '@nesty/core';
import { bgColors, drawFrame, paletteFor, rgb, sprColors } from '../draw';
import {
  currentRoom,
  nextId,
  useGameStore,
  type SelEntity,
  type Tool,
} from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { TOOLS } from './tools';

const SCALE = 2; // 512×480
const CELL = 16 * SCALE;

/** Find the top-most placed entity in the current room at a cell, for the
 *  inspector's single-source-of-truth selection. */
function hitEntity(
  s: ReturnType<typeof useGameStore.getState>,
  x: number,
  y: number,
): SelEntity {
  const room = currentRoom(s);
  const spr = s.game.sprites.find(
    (sp) => sp.room === room.id && sp.x === x && sp.y === y,
  );
  if (spr) return { kind: 'sprite', id: spr.id };
  let idx = room.exits.findIndex((e) => e.x === x && e.y === y);
  if (idx >= 0) return { kind: 'exit', idx };
  idx = room.endings.findIndex((e) => e.x === x && e.y === y);
  if (idx >= 0) return { kind: 'ending', idx };
  idx = room.events.findIndex((e) => e.x === x && e.y === y);
  if (idx >= 0) return { kind: 'event', idx };
  idx = room.overlays.findIndex((o) => o.x === x && o.y === y);
  if (idx >= 0) return { kind: 'overlay', idx };
  idx = room.items.findIndex((ip) => ip.x === x && ip.y === y);
  if (idx >= 0) return { kind: 'item', idx };
  return { kind: 'room' };
}

/** Anything at a cell that shift-drag can relocate (placed entities first,
 *  then the avatar start, then the base tile). */
type Movable =
  | { kind: 'sprite'; id: string }
  | { kind: 'exit' | 'ending' | 'event' | 'overlay' | 'item'; idx: number }
  | { kind: 'avatar' }
  | { kind: 'tile' };

const PLACEMENT_TOOLS: Tool[] = [
  'exit',
  'ending',
  'event',
  'sprite',
  'item',
  'overlay',
];

type St = ReturnType<typeof useGameStore.getState>;
type Room = GameData['rooms'][number];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Cross-mount canvas clipboard for Ctrl+C / Ctrl+V of the hovered element. */
type Clip =
  | { kind: 'tile'; id: string; pal: number }
  | { kind: 'sprite'; data: GameData['sprites'][number] }
  | { kind: 'item'; data: Room['items'][number] }
  | { kind: 'exit'; data: Room['exits'][number] }
  | { kind: 'ending'; data: Room['endings'][number] }
  | { kind: 'event'; data: Room['events'][number] }
  | { kind: 'overlay'; data: Room['overlays'][number] };
let clipboard: Clip | null = null;

function topMovable(st: St, x: number, y: number): Movable | null {
  const room = currentRoom(st);
  const g = st.game;
  const sp = g.sprites.find((s) => s.room === room.id && s.x === x && s.y === y);
  if (sp) return { kind: 'sprite', id: sp.id };
  let idx = room.exits.findIndex((e) => e.x === x && e.y === y);
  if (idx >= 0) return { kind: 'exit', idx };
  idx = room.endings.findIndex((e) => e.x === x && e.y === y);
  if (idx >= 0) return { kind: 'ending', idx };
  idx = room.events.findIndex((e) => e.x === x && e.y === y);
  if (idx >= 0) return { kind: 'event', idx };
  idx = room.overlays.findIndex((o) => o.x === x && o.y === y);
  if (idx >= 0) return { kind: 'overlay', idx };
  idx = room.items.findIndex((ip) => ip.x === x && ip.y === y);
  if (idx >= 0) return { kind: 'item', idx };
  if (g.startRoom === room.id && g.startX === x && g.startY === y)
    return { kind: 'avatar' };
  if (room.tiles[y * 16 + x] !== '0') return { kind: 'tile' };
  return null;
}

/** Human-readable summary of everything stacked in a cell (hover readout). */
function describeCell(st: St, x: number, y: number): string {
  const room = currentRoom(st);
  const g = st.game;
  const i = y * 16 + x;
  const parts: string[] = [];
  const tileId = room.tiles[i];
  if (tileId && tileId !== '0') parts.push(`tile ${tileId}·p${room.pmap[i]}`);
  const sp = g.sprites.find((s) => s.room === room.id && s.x === x && s.y === y);
  if (sp) parts.push(`sprite ${sp.id}${sp.name ? ' ' + sp.name : ''}`);
  const ip = room.items.find((p) => p.x === x && p.y === y);
  if (ip) parts.push(`item ${ip.itemId}`);
  const ex = room.exits.find((e) => e.x === x && e.y === y);
  if (ex) parts.push(`exit → room ${ex.destRoom}`);
  const en = room.endings.find((e) => e.x === x && e.y === y);
  if (en) parts.push(`ending → dlg ${en.dlgId}`);
  if (room.events.some((e) => e.x === x && e.y === y)) parts.push('event');
  const ov = room.overlays.find((o) => o.x === x && o.y === y);
  if (ov) parts.push(`overlay ${ov.kind ?? 'tile'} ${ov.tileId}`);
  if (g.startRoom === room.id && g.startX === x && g.startY === y)
    parts.push('★ start');
  return parts.length ? parts.join(' · ') : 'empty';
}

export function RoomCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useGameStore();
  const room = currentRoom(s);
  const game = s.game;
  const zoom = useUiStore((z) => z.zoom);
  const [animTick, setAnimTick] = useState(0);
  const painting = useRef(false);
  const rightErasing = useRef(false);
  const eraseScope = useRef<Tool | undefined>(undefined);
  // Alt-drag clone-stamp: sample a cell's tile+sub-palette, then duplicate it
  const altPainting = useRef(false);
  const altBrush = useRef<{ id: string; pal: number } | null>(null);
  const altSnapped = useRef(false);

  // hovered cell (for the contents readout) + active shift-drag
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ from: { x: number; y: number }; ent: Movable } | null>(null);
  const dragRef = useRef<typeof drag>(null);
  const setHoverCell = (c: { x: number; y: number } | null) => {
    hoverRef.current = c;
    setHover(c);
  };
  const setDragState = (d: typeof drag) => {
    dragRef.current = d;
    setDrag(d);
  };

  // select an existing entity (and switch to its tool) instead of creating one
  const selectEntity = (sel: SelEntity) => {
    const st = useGameStore.getState();
    if (sel.kind === 'sprite') st.setDrawTarget({ kind: 'sprite', id: sel.id });
    else if (sel.kind === 'item') {
      const it = currentRoom(st).items[sel.idx];
      if (it) st.setDrawTarget({ kind: 'item', id: it.itemId });
    } else if (sel.kind !== 'room') st.setTool(sel.kind);
    useGameStore.setState({ selEntity: sel });
  };

  // relocate a shift-dragged element to a new cell
  const moveMovable = (
    ent: Movable,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const st = useGameStore.getState();
    const roomId = st.curRoomId;
    st.snapshot();
    st.mutateGame((g) => {
      const r = g.rooms.find((rr) => rr.id === roomId)!;
      switch (ent.kind) {
        case 'sprite': {
          const sp = g.sprites.find((s) => s.id === ent.id);
          if (sp) {
            sp.x = to.x;
            sp.y = to.y;
          }
          break;
        }
        case 'item': {
          const ip = r.items[ent.idx];
          if (ip) {
            ip.x = to.x;
            ip.y = to.y;
          }
          break;
        }
        case 'exit': {
          const ex = r.exits[ent.idx];
          if (ex) {
            ex.x = to.x;
            ex.y = to.y;
          }
          break;
        }
        case 'ending': {
          const en = r.endings[ent.idx];
          if (en) {
            en.x = to.x;
            en.y = to.y;
          }
          break;
        }
        case 'event': {
          const ev = r.events[ent.idx];
          if (ev) {
            ev.x = to.x;
            ev.y = to.y;
          }
          break;
        }
        case 'overlay': {
          const ov = r.overlays[ent.idx];
          if (ov) {
            ov.x = to.x;
            ov.y = to.y;
          }
          break;
        }
        case 'avatar':
          g.startX = to.x;
          g.startY = to.y;
          break;
        case 'tile': {
          const i = from.y * 16 + from.x;
          const j = to.y * 16 + to.x;
          r.tiles[j] = r.tiles[i]!;
          r.pmap[j] = r.pmap[i]!;
          r.tiles[i] = '0';
          break;
        }
      }
    });
    if (ent.kind !== 'tile' && ent.kind !== 'avatar')
      useGameStore.setState({ selEntity: ent });
  };

  useEffect(() => {
    const t = setInterval(() => setAnimTick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, []);

  // ---------- render ----------
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pal = paletteFor(game, room);
    const frame = animTick % 2;
    ctx.fillStyle = rgb(pal.backdrop);
    ctx.fillRect(0, 0, 512, 480);

    for (let cy = 0; cy < 15; cy++) {
      for (let cx = 0; cx < 16; cx++) {
        const i = cy * 16 + cx;
        const id = room.tiles[i]!;
        if (id !== '0') {
          const tile = game.tiles.find((t) => t.id === id);
          if (tile) {
            const f = tile.frames[Math.min(frame, tile.frames.length - 1)]!;
            drawFrame(ctx, f, bgColors(pal, room.pmap[i]!), cx * CELL, cy * CELL, SCALE);
          }
        }
      }
    }

    // overlay drawables (tile / sprite / item), ghosted over the base map.
    // sprite/item overlays render in the BG bank -> use the cell's BG palette.
    ctx.globalAlpha = 0.55;
    for (const ov of room.overlays) {
      const d =
        ov.kind === 'sprite'
          ? game.sprites.find((sp) => sp.id === ov.tileId)
          : ov.kind === 'item'
            ? game.items.find((it) => it.id === ov.tileId)
            : game.tiles.find((t) => t.id === ov.tileId);
      if (d) {
        const f = d.frames[Math.min(frame, d.frames.length - 1)]!;
        drawFrame(
          ctx,
          f,
          bgColors(pal, room.pmap[ov.y * 16 + ov.x]!),
          ov.x * CELL,
          ov.y * CELL,
          SCALE,
        );
      }
    }
    ctx.globalAlpha = 1;

    // entities
    for (const ip of room.items) {
      const item = game.items.find((x) => x.id === ip.itemId);
      if (item) {
        const f = item.frames[Math.min(frame, item.frames.length - 1)]!;
        drawFrame(ctx, f, sprColors(pal, item.sprPal), ip.x * CELL, ip.y * CELL, SCALE);
      }
    }
    for (const spr of game.sprites.filter((x) => x.room === room.id)) {
      const f = spr.frames[Math.min(frame, spr.frames.length - 1)]!;
      drawFrame(ctx, f, sprColors(pal, spr.sprPal), spr.x * CELL, spr.y * CELL, SCALE);
    }
    if (game.startRoom === room.id) {
      const f = game.avatar.frames[Math.min(frame, game.avatar.frames.length - 1)]!;
      drawFrame(
        ctx,
        f,
        sprColors(pal, game.avatar.sprPal),
        game.startX * CELL,
        game.startY * CELL,
        SCALE,
      );
    }

    // markers
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    const badge = (x: number, y: number, color: string, letter: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = color;
      ctx.fillRect(x * CELL + 1, y * CELL + 1, 12, 12);
      ctx.fillStyle = '#000';
      ctx.fillText(letter, x * CELL + 4, y * CELL + 3);
    };
    for (const ex of room.exits) badge(ex.x, ex.y, '#3cbcfc', 'E');
    for (const en of room.endings) badge(en.x, en.y, '#e7005a', 'X');
    for (const ev of room.events) badge(ev.x, ev.y, '#b53cfc', 'V');
    for (const ov of room.overlays) badge(ov.x, ov.y, '#58d854', 'O');
    if (s.pendingExit && (s.exitSourceRoom ?? room.id) === room.id)
      badge(s.pendingExit.x, s.pendingExit.y, '#f8b800', '?');

    // selection highlight
    if (s.selEntity && s.selEntity.kind !== 'room') {
      const sel = s.selEntity;
      const cell =
        sel.kind === 'sprite'
          ? game.sprites.find((sp) => sp.id === sel.id && sp.room === room.id)
          : sel.kind === 'exit'
            ? room.exits[sel.idx]
            : sel.kind === 'ending'
              ? room.endings[sel.idx]
              : sel.kind === 'event'
                ? room.events[sel.idx]
                : sel.kind === 'overlay'
                  ? room.overlays[sel.idx]
                  : room.items[sel.idx];
      if (cell) {
        ctx.strokeStyle = '#c92c61';
        ctx.lineWidth = 3;
        ctx.strokeRect(cell.x * CELL + 1.5, cell.y * CELL + 1.5, CELL - 3, CELL - 3);
      }
    }

    // palette-paint overlay
    if (s.tool === 'palette') {
      ctx.globalAlpha = 0.25;
      const cols = ['#3cbcfc', '#e7005a', '#f8b800', '#58d854'];
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = cols[room.pmap[i]!]!;
        ctx.fillRect((i % 16) * CELL, Math.floor(i / 16) * CELL, CELL, CELL);
      }
      ctx.globalAlpha = 1;
    }

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let x = 1; x < 16; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, 480);
      ctx.stroke();
    }
    for (let y = 1; y < 15; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(512, y * CELL + 0.5);
      ctx.stroke();
    }

    // hover cell outline
    if (hover && !drag) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hover.x * CELL + 1, hover.y * CELL + 1, CELL - 2, CELL - 2);
    }
    // shift-drag: source (dashed) + drop target (accent)
    if (drag) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        drag.from.x * CELL + 1,
        drag.from.y * CELL + 1,
        CELL - 2,
        CELL - 2,
      );
      ctx.restore();
      if (hover) {
        ctx.fillStyle = 'rgba(201,44,97,0.28)';
        ctx.fillRect(hover.x * CELL, hover.y * CELL, CELL, CELL);
        ctx.strokeStyle = '#c92c61';
        ctx.lineWidth = 3;
        ctx.strokeRect(hover.x * CELL + 1.5, hover.y * CELL + 1.5, CELL - 3, CELL - 3);
      }
    }
  }, [game, room, s.tool, s.pendingExit, s.exitSourceRoom, s.selEntity, animTick, hover, drag]);

  // ---------- input ----------
  const cellAt = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    // rect is post-zoom; map back to the canvas's 512×480 space
    const sx = 512 / rect.width;
    const sy = 480 / rect.height;
    return {
      x: Math.max(0, Math.min(15, Math.floor(((e.clientX - rect.left) * sx) / CELL))),
      y: Math.max(0, Math.min(14, Math.floor(((e.clientY - rect.top) * sy) / CELL))),
    };
  };

  const eraseAt = (x: number, y: number, scope?: Tool) => {
    const i = y * 16 + x;
    const st = useGameStore.getState();
    const roomId = st.curRoomId;
    st.mutateGame((g) => {
      const r = g.rooms.find((rr) => rr.id === roomId)!;
      const del = {
        tile: () => (r.tiles[i] = '0'),
        overlay: () => (r.overlays = r.overlays.filter((ov) => ov.x !== x || ov.y !== y)),
        exit: () => (r.exits = r.exits.filter((ex) => ex.x !== x || ex.y !== y)),
        ending: () => (r.endings = r.endings.filter((en) => en.x !== x || en.y !== y)),
        item: () => (r.items = r.items.filter((ip) => ip.x !== x || ip.y !== y)),
        event: () => (r.events = r.events.filter((ev) => ev.x !== x || ev.y !== y)),
        sprite: () =>
          (g.sprites = g.sprites.filter(
            (sp) => sp.room !== roomId || sp.x !== x || sp.y !== y,
          )),
      };
      switch (scope) {
        case 'tile':
          del.tile();
          break;
        case 'overlay':
          del.overlay();
          break;
        case 'exit':
          del.exit();
          break;
        case 'ending':
          del.ending();
          break;
        case 'item':
          del.item();
          break;
        case 'event':
          del.event();
          break;
        case 'sprite':
          del.sprite();
          break;
        default:
          del.tile();
          del.overlay();
          del.exit();
          del.ending();
          del.item();
          del.event();
          del.sprite();
      }
    });
  };

  const applyAt = (x: number, y: number) => {
    const i = y * 16 + x;
    const st = useGameStore.getState();
    const roomId = st.curRoomId;
    // A cell with an overlay owns its image. Drawing a tile / placing a
    // sprite / placing an item on it doesn't add content on top — it
    // re-targets the overlay to the selected drawable (its condition is kept).
    if (st.tool === 'tile' || st.tool === 'sprite' || st.tool === 'item') {
      const roomNow = st.game.rooms.find((rr) => rr.id === roomId);
      const hasOvl = roomNow?.overlays.some((ov) => ov.x === x && ov.y === y);
      const dt = st.drawTarget;
      if (hasOvl && dt.kind !== 'avatar') {
        const kind = dt.kind; // 'tile' | 'sprite' | 'item'
        const id = dt.id;
        st.mutateGame((g) => {
          const ov = g.rooms
            .find((rr) => rr.id === roomId)!
            .overlays.find((o) => o.x === x && o.y === y);
          if (!ov) return;
          ov.tileId = id;
          if (kind === 'tile') delete ov.kind;
          else ov.kind = kind;
        });
        return;
      }
      if (hasOvl) return; // avatar target: nothing to retarget with
    }
    switch (st.tool) {
      case 'tile': {
        const id = st.drawTarget.kind === 'tile' ? st.drawTarget.id : st.game.tiles[0]?.id;
        if (!id) return;
        st.mutateGame((g) => {
          const r = g.rooms.find((rr) => rr.id === roomId)!;
          r.tiles[i] = id;
          // paint the cell with the picker's selected BG sub-palette too
          r.pmap[i] = st.paintSubPal;
        });
        break;
      }
      case 'erase':
        eraseAt(x, y);
        break;
      case 'palette':
        st.mutateGame((g) => {
          g.rooms.find((r) => r.id === roomId)!.pmap[i] = st.paintSubPal;
        });
        break;
      case 'avatar':
        st.mutateGame((g) => {
          g.startRoom = roomId;
          g.startX = x;
          g.startY = y;
        });
        break;
      case 'sprite': {
        if (st.drawTarget.kind !== 'sprite') return;
        const id = st.drawTarget.id;
        st.mutateGame((g) => {
          const sp = g.sprites.find((ss) => ss.id === id);
          if (sp) {
            sp.room = roomId;
            sp.x = x;
            sp.y = y;
          }
        });
        break;
      }
      case 'item': {
        if (st.drawTarget.kind !== 'item') return;
        const id = st.drawTarget.id;
        st.mutateGame((g) => {
          const r = g.rooms.find((rr) => rr.id === roomId)!;
          if (!r.items.some((ip) => ip.x === x && ip.y === y))
            r.items.push({ itemId: id, x, y });
        });
        break;
      }
      case 'exit': {
        if (!st.pendingExit) {
          useGameStore.setState({ pendingExit: { x, y } });
        } else {
          const src = st.pendingExit;
          const srcRoomId = st.exitSourceRoom ?? roomId;
          st.mutateGame((g) => {
            const r = g.rooms.find((rr) => rr.id === srcRoomId)!;
            r.exits = r.exits.filter((ex) => ex.x !== src.x || ex.y !== src.y);
            r.exits.push({ x: src.x, y: src.y, destRoom: roomId, destX: x, destY: y });
          });
          useGameStore.setState({ pendingExit: null, exitSourceRoom: undefined });
        }
        break;
      }
      case 'ending': {
        const dlg = st.selectedDlgId ?? Object.keys(st.game.dialogs)[0];
        if (!dlg) return;
        st.mutateGame((g) => {
          const r = g.rooms.find((rr) => rr.id === roomId)!;
          r.endings = r.endings.filter((en) => en.x !== x || en.y !== y);
          r.endings.push({ x, y, dlgId: dlg });
        });
        break;
      }
      case 'event': {
        st.mutateGame((g) => {
          const r = g.rooms.find((rr) => rr.id === roomId)!;
          if (!r.events.some((ev) => ev.x === x && ev.y === y))
            r.events.push({ x, y, actions: [] });
        });
        break;
      }
      case 'overlay': {
        // overlay adopts whatever drawable is selected (tile / sprite / item);
        // sprite/item graphics are compiled into the BG bank by the compiler
        const dt = st.drawTarget;
        const kind: 'tile' | 'sprite' | 'item' =
          dt.kind === 'sprite' ? 'sprite' : dt.kind === 'item' ? 'item' : 'tile';
        const id = dt.kind === 'avatar' ? st.game.tiles[0]?.id : dt.id;
        if (!id) return;
        st.mutateGame((g) => {
          const r = g.rooms.find((rr) => rr.id === roomId)!;
          const existing = r.overlays.find((ov) => ov.x === x && ov.y === y);
          // one overlay per cell: re-target the existing one instead of stacking
          if (existing) {
            existing.tileId = id;
            if (kind === 'tile') delete existing.kind;
            else existing.kind = kind;
            return;
          }
          const cond: Cond | undefined = g.flags[0]
            ? { kind: 'flag', flagId: g.flags[0].id, negate: false }
            : g.items[0]
              ? { kind: 'item', itemId: g.items[0].id, negate: false }
              : undefined;
          if (!cond) return;
          r.overlays.push({
            x,
            y,
            tileId: id,
            ...(kind === 'tile' ? {} : { kind }),
            cond,
          });
        });
        break;
      }
    }
  };

  // Alt-press: sample the hovered cell's tile + sub-palette into the clone
  // brush, and reflect the copy in the picker (selected tile + sub-palette).
  const sampleTile = (x: number, y: number) => {
    const st = useGameStore.getState();
    const room = currentRoom(st);
    const i = y * 16 + x;
    const id = room.tiles[i] ?? '0';
    const pal = room.pmap[i] ?? 0;
    altBrush.current = { id, pal };
    altSnapped.current = false;
    if (id !== '0') st.setDrawTarget({ kind: 'tile', id });
    useGameStore.setState({ paintSubPal: pal as typeof st.paintSubPal });
  };

  // stamp the sampled tile + sub-palette onto a cell (one undo per stroke)
  const stampTile = (x: number, y: number) => {
    const b = altBrush.current;
    if (!b) return;
    const st = useGameStore.getState();
    if (!altSnapped.current) {
      st.snapshot();
      altSnapped.current = true;
    }
    const i = y * 16 + x;
    const roomId = st.curRoomId;
    st.mutateGame((g) => {
      const r = g.rooms.find((rr) => rr.id === roomId)!;
      r.tiles[i] = b.id;
      r.pmap[i] = b.pal as (typeof r.pmap)[number];
    });
  };

  // Ctrl+C: copy the top element under the cursor (falls back to the tile)
  const copyAt = (x: number, y: number) => {
    const st = useGameStore.getState();
    const room = currentRoom(st);
    const g = st.game;
    const i = y * 16 + x;
    let mv = topMovable(st, x, y);
    // the avatar start isn't duplicable; copy the tile beneath it instead
    if (mv?.kind === 'avatar')
      mv = room.tiles[i] !== '0' ? { kind: 'tile' } : null;
    if (!mv) return false;
    switch (mv.kind) {
      case 'tile':
        clipboard = { kind: 'tile', id: room.tiles[i]!, pal: room.pmap[i]! };
        break;
      case 'sprite': {
        const sp = g.sprites.find((s) => s.id === mv.id);
        if (!sp) return false;
        clipboard = { kind: 'sprite', data: clone(sp) };
        break;
      }
      case 'item':
        clipboard = { kind: 'item', data: clone(room.items[mv.idx]!) };
        break;
      case 'exit':
        clipboard = { kind: 'exit', data: clone(room.exits[mv.idx]!) };
        break;
      case 'ending':
        clipboard = { kind: 'ending', data: clone(room.endings[mv.idx]!) };
        break;
      case 'event':
        clipboard = { kind: 'event', data: clone(room.events[mv.idx]!) };
        break;
      case 'overlay':
        clipboard = { kind: 'overlay', data: clone(room.overlays[mv.idx]!) };
        break;
    }
    return true;
  };

  // Ctrl+V: duplicate the clipboard element at the hovered cell, then select it
  const pasteAt = (x: number, y: number) => {
    if (!clipboard) return;
    const clip = clipboard;
    const st = useGameStore.getState();
    const roomId = st.curRoomId;
    st.snapshot();
    let sel: SelEntity | null = null;
    st.mutateGame((g) => {
      const r = g.rooms.find((rr) => rr.id === roomId)!;
      const i = y * 16 + x;
      switch (clip.kind) {
        case 'tile':
          r.tiles[i] = clip.id;
          r.pmap[i] = clip.pal as (typeof r.pmap)[number];
          break;
        case 'sprite': {
          const newId = nextId(new Set(g.sprites.map((s) => s.id)));
          g.sprites.push({
            ...clone(clip.data),
            id: newId,
            name: clip.data.name ? clip.data.name + ' copy' : 'sprite ' + newId,
            room: roomId,
            x,
            y,
          });
          sel = { kind: 'sprite', id: newId };
          break;
        }
        case 'item':
          r.items.push({ ...clone(clip.data), x, y });
          sel = { kind: 'item', idx: r.items.length - 1 };
          break;
        case 'exit':
          r.exits.push({ ...clone(clip.data), x, y });
          sel = { kind: 'exit', idx: r.exits.length - 1 };
          break;
        case 'ending':
          r.endings.push({ ...clone(clip.data), x, y });
          sel = { kind: 'ending', idx: r.endings.length - 1 };
          break;
        case 'event':
          r.events.push({ ...clone(clip.data), x, y });
          sel = { kind: 'event', idx: r.events.length - 1 };
          break;
        case 'overlay':
          r.overlays.push({ ...clone(clip.data), x, y });
          sel = { kind: 'overlay', idx: r.overlays.length - 1 };
          break;
      }
    });
    if (sel) useGameStore.setState({ selEntity: sel });
  };

  // Ctrl+C / Ctrl+V act on the hovered cell (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const h = hoverRef.current;
      if (!h) return;
      if (e.code === 'KeyC') {
        if (copyAt(h.x, h.y)) e.preventDefault();
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        pasteAt(h.x, h.y);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDown = (e: React.PointerEvent) => {
    const st = useGameStore.getState();
    const { x, y } = cellAt(e);

    // right button: erase the active layer without leaving the tool
    if (e.button === 2) {
      const LAYER_TOOLS: Tool[] = ['tile', 'overlay', 'exit', 'ending', 'item', 'event', 'sprite'];
      if (!LAYER_TOOLS.includes(st.tool)) return;
      st.snapshot();
      rightErasing.current = true;
      eraseScope.current = st.tool;
      painting.current = true;
      eraseAt(x, y, st.tool);
      return;
    }
    if (e.button !== 0) return;

    // ALT + drag: clone-stamp — sample the tile+palette under the cursor,
    // then duplicate it onto the cells you drag over
    if (e.altKey) {
      altPainting.current = true;
      sampleTile(x, y);
      setHoverCell({ x, y });
      return;
    }

    const mv = topMovable(st, x, y);

    // SHIFT + drag: pick up whatever is under the cursor and move it
    if (e.shiftKey && mv) {
      setDragState({ from: { x, y }, ent: mv });
      setHoverCell({ x, y });
      if (mv.kind !== 'tile' && mv.kind !== 'avatar')
        useGameStore.setState({ selEntity: mv });
      return;
    }

    const hit = hitEntity(st, x, y);

    // drawing a tile / placing a sprite / placing an item onto a cell that
    // already has an overlay re-targets that overlay to the selected drawable
    // (rather than selecting it or stamping underneath). applyAt does the swap.
    if (
      hit.kind === 'overlay' &&
      (st.tool === 'tile' || st.tool === 'sprite' || st.tool === 'item')
    ) {
      st.snapshot();
      applyAt(x, y);
      useGameStore.setState({ selEntity: hit });
      return;
    }

    // clicking an existing placed entity with a placement tool selects it
    // (and switches to its tool) rather than stamping a duplicate
    if (hit.kind !== 'room' && PLACEMENT_TOOLS.includes(st.tool)) {
      selectEntity(hit);
      return;
    }

    st.snapshot();
    if (st.tool === 'exit' && !st.pendingExit) {
      useGameStore.setState({ exitSourceRoom: st.curRoomId });
    }
    painting.current = true;
    applyAt(x, y);
    // focus the inspector on whatever ended up under the click
    useGameStore.setState({ selEntity: hitEntity(useGameStore.getState(), x, y) });
  };

  const onMove = (e: React.PointerEvent) => {
    const { x, y } = cellAt(e);
    const h = hoverRef.current;
    if (!h || h.x !== x || h.y !== y) setHoverCell({ x, y });
    if (altPainting.current) {
      stampTile(x, y); // duplicate the sampled tile+palette as we drag
      return;
    }
    if (dragRef.current) return; // dragging: hover tracks the drop target
    if (!painting.current) return;
    if (rightErasing.current) {
      eraseAt(x, y, eraseScope.current);
      return;
    }
    const st = useGameStore.getState();
    if (st.tool === 'exit' || st.tool === 'ending' || st.tool === 'avatar' || st.tool === 'event')
      return; // click-only
    applyAt(x, y);
  };

  const onUp = () => {
    const d = dragRef.current;
    if (d) {
      const to = hoverRef.current;
      if (to && (to.x !== d.from.x || to.y !== d.from.y))
        moveMovable(d.ent, d.from, to);
      setDragState(null);
    }
    painting.current = false;
    altPainting.current = false;
    altBrush.current = null;
    rightErasing.current = false;
    eraseScope.current = undefined;
  };

  const onLeave = () => {
    if (dragRef.current) setDragState(null); // cancel a drag that left the grid
    painting.current = false;
    altPainting.current = false;
    altBrush.current = null;
    rightErasing.current = false;
    eraseScope.current = undefined;
    setHoverCell(null);
  };

  const hint = TOOLS.find((t) => t.id === s.tool)?.hint;
  const hoverMovable = hover ? topMovable(s, hover.x, hover.y) : null;

  return (
    <>
      {s.pendingExit && (
        <div className='exit-banner'>
          exit from room {s.exitSourceRoom ?? room.id} ({s.pendingExit.x},
          {s.pendingExit.y}) — switch rooms in the navigator, then click the
          destination cell
          <button
            className='small'
            onClick={() =>
              useGameStore.setState({ pendingExit: null, exitSourceRoom: undefined })
            }
          >
            cancel
          </button>
        </div>
      )}
      <div className='canvas-viewport' data-tour='panel-room' title={hint}>
        <div className='cell-info'>
          {hover ? (
            <>
              <span className='ci-cell'>
                ({hover.x},{hover.y})
              </span>
              <span className='ci-desc'>{describeCell(s, hover.x, hover.y)}</span>
              {hoverMovable && (
                <span className='ci-hint'>· shift-drag to move</span>
              )}
            </>
          ) : (
            <span className='ci-desc'>
              hover for contents · shift-drag moves · alt-drag clones · ctrl+c/v
              copy-paste
            </span>
          )}
        </div>
        <div
          className='canvas-stage'
          style={{ transform: `scale(${zoom})`, width: 512, height: 480 }}
        >
          <canvas
            ref={canvasRef}
            width={512}
            height={480}
            style={{ cursor: drag ? 'grabbing' : hoverMovable ? 'grab' : 'crosshair' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </>
  );
}
