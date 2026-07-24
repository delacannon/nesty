import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOURS, type TourId } from '../tours';

/** Top-level editor views (GB Studio-style view switcher, Ctrl/Cmd+1..8). */
export const VIEW_IDS = [
  'world',
  'draw',
  'avatar',
  'palette',
  'song',
  'sfx',
  'dialog',
  'text',
  'splash',
  'data',
] as const;
export type ViewId = (typeof VIEW_IDS)[number];

export const VIEW_LABELS: Record<ViewId, string> = {
  world: 'World',
  draw: 'Sprites',
  avatar: 'Avatar',
  palette: 'Palettes',
  song: 'Music',
  sfx: 'Sound',
  dialog: 'Dialogue',
  text: 'Text',
  splash: 'Splash',
  data: 'Project',
};

/* legacy panel-id union kept only so tours.ts (panels: PanelId[]) still types.
   Maps loosely onto views; unused for layout now. */
export type PanelId =
  | 'room'
  | 'drawables'
  | 'palette'
  | 'splash'
  | 'song'
  | 'sfx'
  | 'logic'
  | 'events'
  | 'dialog'
  | 'text'
  | 'data';

const isViewId = (x: unknown): x is ViewId => VIEW_IDS.includes(x as ViewId);

export const THEME_IDS = ['gbs', 'pc98', 'amber'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const THEME_LABELS: Record<ThemeId, string> = {
  gbs: 'Charcoal',
  pc98: 'NES Salmon',
  amber: 'Amber CRT',
};
const isThemeId = (x: unknown): x is ThemeId =>
  THEME_IDS.includes(x as ThemeId);

export const LEFT_MIN = 180;
export const LEFT_MAX = 520;
export const RIGHT_MIN = 240;
export const RIGHT_MAX = 620;

interface UiState {
  view: ViewId;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftWidth: number;
  rightWidth: number;
  buildTerminalOpen: boolean;
  zoom: number; // world canvas zoom multiplier
  theme: ThemeId;
  activeTour: TourId | null;

  setTheme: (t: ThemeId) => void;
  setView: (v: ViewId) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
  toggleBuildTerminal: () => void;
  setZoom: (z: number) => void;
  startTour: (id: TourId) => void;
  stopTour: () => void;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: 'world',
      leftCollapsed: false,
      rightCollapsed: false,
      leftWidth: 252,
      rightWidth: 328,
      buildTerminalOpen: false,
      zoom: 1,
      theme: 'pc98',
      activeTour: null,

      setTheme: (t) => set({ theme: t }),
      setView: (v) => set({ view: v }),
      toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
      toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
      setLeftWidth: (w) => set({ leftWidth: clamp(w, LEFT_MIN, LEFT_MAX) }),
      setRightWidth: (w) => set({ rightWidth: clamp(w, RIGHT_MIN, RIGHT_MAX) }),
      toggleBuildTerminal: () =>
        set((s) => ({ buildTerminalOpen: !s.buildTerminalOpen })),
      setZoom: (z) => set({ zoom: Math.max(0.5, Math.min(3, z)) }),

      // switch to the view the tour points at so its targets are mounted
      startTour: (id) => set({ activeTour: id, view: TOUR_VIEW[id] }),
      stopTour: () => set({ activeTour: null }),
    }),
    {
      name: 'nesty:v2:ui',
      version: 2,
      partialize: (s) => ({
        view: s.view,
        leftCollapsed: s.leftCollapsed,
        rightCollapsed: s.rightCollapsed,
        leftWidth: s.leftWidth,
        rightWidth: s.rightWidth,
        zoom: s.zoom,
        theme: s.theme,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<UiState> | undefined;
        return {
          ...current,
          view: isViewId(p?.view) ? p!.view : current.view,
          leftCollapsed: p?.leftCollapsed ?? current.leftCollapsed,
          rightCollapsed: p?.rightCollapsed ?? current.rightCollapsed,
          leftWidth:
            typeof p?.leftWidth === 'number'
              ? clamp(p.leftWidth, LEFT_MIN, LEFT_MAX)
              : current.leftWidth,
          rightWidth:
            typeof p?.rightWidth === 'number'
              ? clamp(p.rightWidth, RIGHT_MIN, RIGHT_MAX)
              : current.rightWidth,
          zoom: typeof p?.zoom === 'number' ? p.zoom : current.zoom,
          theme: isThemeId(p?.theme) ? p!.theme : current.theme,
        };
      },
    },
  ),
);

// which view each guided tour lives in (so its data-tour targets are mounted)
const TOUR_VIEW: Record<TourId, ViewId> = {
  welcome: 'world',
  room: 'world',
  drawables: 'draw',
  palette: 'palette',
  sfx: 'sfx',
  logic: 'world',
  dialog: 'dialog',
  text: 'text',
  data: 'data',
};

// map a tour's target panels onto the view it belongs to
export const PANEL_TO_VIEW: Record<PanelId, ViewId> = {
  room: 'world',
  drawables: 'draw',
  palette: 'palette',
  splash: 'splash',
  song: 'song',
  sfx: 'sfx',
  logic: 'world',
  events: 'world',
  dialog: 'dialog',
  text: 'text',
  data: 'data',
};

// re-export so registry/tours referencing TOURS keeps working
export { TOURS };
