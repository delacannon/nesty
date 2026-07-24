import { create } from 'zustand';
import type {
  Drawable,
  Frame16,
  GameData,
  Pixel,
  SubPal,
  TileDef,
} from '@nesty/core';
import {
  blankFrame,
  blankRoom,
  defaultGame,
  helloWorld,
  parse,
  serialize,
} from '@nesty/core';

export type Tool =
  | 'tile'
  | 'erase'
  | 'palette'
  | 'avatar'
  | 'sprite'
  | 'item'
  | 'exit'
  | 'ending'
  | 'event'
  | 'overlay';

export type DrawTarget =
  | { kind: 'tile'; id: string }
  | { kind: 'sprite'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'avatar' };

/** Which placed room entity the right inspector is focused on (World view). */
export type SelEntity =
  | { kind: 'room' }
  | { kind: 'exit' | 'ending' | 'overlay' | 'item' | 'event'; idx: number }
  | { kind: 'sprite'; id: string };

export interface EditorState {
  game: GameData;
  curRoomId: string;
  tool: Tool;
  drawTarget: DrawTarget;
  paintSubPal: SubPal;
  drawColor: Pixel;
  curFrame: 0 | 1;
  selectedDlgId: string | null;
  selEntity: SelEntity | null;
  pendingExit: { x: number; y: number } | null; // exit source awaiting destination
  exitSourceRoom?: string;
  past: string[];

  set: (fn: (s: EditorState) => Partial<EditorState>) => void;
  /** Select a room tool, syncing the paint panel to the matching kind. */
  setTool: (tool: Tool) => void;
  /** Select a paint target, syncing the room tool to the matching kind. */
  setDrawTarget: (t: DrawTarget) => void;
  mutateGame: (fn: (g: GameData) => void) => void;
  snapshot: () => void;
  undo: () => void;
  newGame: () => void;
  importText: (text: string) => string[];
  /** Replace the whole game (e.g. from a decoded compressed file). */
  loadGame: (game: GameData) => void;
}

const AUTOSAVE_KEY = 'nesty:v1:autosave';
const LEGACY_AUTOSAVE_KEY = 'bitsynes:v1:autosave';

function loadAutosave(): GameData {
  try {
    const text =
      localStorage.getItem(AUTOSAVE_KEY) ??
      localStorage.getItem(LEGACY_AUTOSAVE_KEY);
    if (text) {
      const { game, errors } = parse(text);
      if (errors.length === 0) return game;
    }
  } catch {
    /* fresh game */
  }
  return helloWorld();
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Room tools with a paint-panel counterpart (erase/palette/exit/ending/event have none). */
const TOOL_KIND: Partial<Record<Tool, DrawTarget['kind']>> = {
  tile: 'tile',
  sprite: 'sprite',
  item: 'item',
  avatar: 'avatar',
  // overlay intentionally omitted: it adopts whatever drawable is selected
  // (tile / sprite / item), so selecting it must not reset the draw target.
};

const KIND_TOOL: Record<DrawTarget['kind'], Tool> = {
  tile: 'tile',
  sprite: 'sprite',
  item: 'item',
  avatar: 'avatar',
};

function targetForKind(
  game: GameData,
  kind: DrawTarget['kind'],
): DrawTarget | null {
  if (kind === 'avatar') return { kind: 'avatar' };
  const list =
    kind === 'tile' ? game.tiles : kind === 'sprite' ? game.sprites : game.items;
  return list[0] ? { kind, id: list[0].id } : null;
}

export const useGameStore = create<EditorState>((set, get) => ({
  game: loadAutosave(),
  curRoomId: '0',
  tool: 'tile',
  drawTarget: { kind: 'tile', id: 'a' },
  paintSubPal: 1,
  drawColor: 1,
  curFrame: 0,
  selectedDlgId: null,
  selEntity: null,
  pendingExit: null,
  past: [],

  set: (fn) => set((s) => fn(s)),

  setTool: (tool) => {
    const s = get();
    const kind = TOOL_KIND[tool];
    if (kind && s.drawTarget.kind !== kind) {
      const target = targetForKind(s.game, kind);
      if (target) {
        set({ tool, pendingExit: null, drawTarget: target, curFrame: 0 });
        return;
      }
    }
    set({ tool, pendingExit: null });
  },

  setDrawTarget: (t) => {
    // tool steal also cancels any half-placed exit
    set({ drawTarget: t, curFrame: 0, tool: KIND_TOOL[t.kind], pendingExit: null });
  },

  mutateGame: (fn) => {
    const g = clone(get().game);
    fn(g);
    set({ game: g });
    scheduleAutosave(g);
  },

  snapshot: () => {
    const past = get().past.slice(-49);
    past.push(serialize(get().game));
    set({ past });
  },

  undo: () => {
    const past = [...get().past];
    const text = past.pop();
    if (!text) return;
    const { game } = parse(text);
    set({ game, past });
    scheduleAutosave(game);
  },

  newGame: () => {
    get().snapshot();
    const game = defaultGame();
    set({ game, curRoomId: '0', pendingExit: null, selEntity: null });
    scheduleAutosave(game);
  },

  importText: (text) => {
    const { game, errors } = parse(text);
    if (errors.length === 0) {
      get().snapshot();
      set({
        game,
        curRoomId: game.rooms[0]?.id ?? '0',
        pendingExit: null,
        selEntity: null,
      });
      scheduleAutosave(game);
    }
    return errors;
  },

  loadGame: (game) => {
    get().snapshot();
    set({
      game,
      curRoomId: game.rooms[0]?.id ?? '0',
      pendingExit: null,
      selEntity: null,
    });
    scheduleAutosave(game);
  },
}));

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleAutosave(game: GameData) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, serialize(game));
    } catch {
      /* storage full/unavailable */
    }
  }, 1000);
}

// ---------- helpers used by panels ----------

const ID_CHARS =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function nextId(used: Set<string>, reserveZero = true): string {
  for (const c of ID_CHARS) {
    if (reserveZero && c === '0') continue;
    if (!used.has(c)) return c;
  }
  return '?';
}

export function currentRoom(s: EditorState) {
  return s.game.rooms.find((r) => r.id === s.curRoomId) ?? s.game.rooms[0]!;
}

export function currentDrawable(
  s: EditorState,
): Drawable | TileDef | undefined {
  const t = s.drawTarget;
  if (t.kind === 'avatar') return s.game.avatar;
  if (t.kind === 'tile') return s.game.tiles.find((x) => x.id === t.id);
  if (t.kind === 'sprite') return s.game.sprites.find((x) => x.id === t.id);
  return s.game.items.find((x) => x.id === t.id);
}

export function targetFrames(
  g: GameData,
  t: DrawTarget,
): Frame16[] | undefined {
  if (t.kind === 'avatar') return g.avatar.frames;
  if (t.kind === 'tile') return g.tiles.find((x) => x.id === t.id)?.frames;
  if (t.kind === 'sprite') return g.sprites.find((x) => x.id === t.id)?.frames;
  return g.items.find((x) => x.id === t.id)?.frames;
}

export function addRoom(): void {
  const s = useGameStore.getState();
  s.snapshot();
  const used = new Set(s.game.rooms.map((r) => r.id));
  const id = nextId(used, false);
  s.mutateGame((g) => {
    g.rooms.push(blankRoom(id, g.palettes[0]!.id));
  });
  useGameStore.setState({ curRoomId: id });
}

export function ensureFrame2(frames: Frame16[]): void {
  if (frames.length < 2) frames.push(frames[0] ? [...frames[0]] : blankFrame());
}

/** dialog ids are written bare into the .nesty text format (whitespace- and
 *  bracket-delimited), so keep them to a safe token charset. */
export const DLG_ID_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Rename a dialog reference id everywhere it is used: the dialogs record
 * (order-preserving, so compiled dialog indices stay stable) plus every
 * reference on sprites, items, the avatar, room exits/endings and event
 * actions. Returns an error message, or null on success.
 */
export function renameDialog(oldId: string, newId: string): string | null {
  const s = useGameStore.getState();
  newId = newId.trim();
  if (newId === oldId) return null;
  if (!newId) return 'empty id';
  if (!DLG_ID_RE.test(newId)) return 'use letters, numbers, - or _ only';
  if (s.game.dialogs[newId] !== undefined) return `id "${newId}" already exists`;
  if (s.game.dialogs[oldId] === undefined) return `unknown dialog "${oldId}"`;

  s.snapshot();
  s.mutateGame((g) => {
    // rebuild dialogs preserving key order, swapping the one key
    const rebuilt: Record<string, string> = {};
    for (const [k, v] of Object.entries(g.dialogs))
      rebuilt[k === oldId ? newId : k] = v;
    g.dialogs = rebuilt;

    const swap = (id: string | undefined) => (id === oldId ? newId : id);
    const drawables: Drawable[] = [...g.sprites, ...g.items, g.avatar];
    for (const d of drawables) {
      d.dlgId = swap(d.dlgId);
      d.altDlgId = swap(d.altDlgId);
    }
    for (const r of g.rooms) {
      for (const ex of r.exits) ex.lockedDlgId = swap(ex.lockedDlgId);
      for (const en of r.endings) {
        en.dlgId = swap(en.dlgId) ?? en.dlgId;
        en.lockedDlgId = swap(en.lockedDlgId);
      }
      for (const ev of r.events)
        for (const a of ev.actions)
          if (a.type === 'showDialog') a.dlgId = swap(a.dlgId) ?? a.dlgId;
    }
  });
  if (s.selectedDlgId === oldId) useGameStore.setState({ selectedDlgId: newId });
  return null;
}
