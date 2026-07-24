import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  THEME_IDS,
  THEME_LABELS,
  useUiStore,
  VIEW_IDS,
  VIEW_LABELS,
  type ThemeId,
  type ViewId,
} from '../store/uiStore';
import { TOUR_IDS, TOURS, type TourId } from '../tours';
import { PlayOverlay } from './PlayOverlay';

export function TopToolbar() {
  const title = useGameStore((s) => s.game.title);
  const view = useUiStore((s) => s.view);
  const zoom = useUiStore((s) => s.zoom);
  const buildTerminalOpen = useUiStore((s) => s.buildTerminalOpen);
  const theme = useUiStore((s) => s.theme);
  const [playing, setPlaying] = useState(false);

  // Ctrl/Cmd+1..8 view switch, Ctrl/Cmd+R compile & run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        setPlaying(true);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= VIEW_IDS.length) {
        e.preventDefault();
        useUiStore.getState().setView(VIEW_IDS[n - 1]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className='topbar'>
      <a
        className='logo'
        href={import.meta.env.DEV ? 'http://localhost:5174/' : '/'}
        title='back to home'
      >
        NES<em>TY</em>
      </a>
      <input
        className='title-input'
        data-tour='title'
        type='text'
        value={title}
        onChange={(e) => {
          const v = e.target.value;
          useGameStore.getState().mutateGame((g) => {
            g.title = v;
          });
        }}
        title='game title (shown on the NES title screen)'
      />

      <div className='view-tabs' data-tour='toggles'>
        {VIEW_IDS.map((id, i) => (
          <button
            key={id}
            className={view === id ? 'on' : ''}
            onClick={() => useUiStore.getState().setView(id)}
            title={`${VIEW_LABELS[id]} (Ctrl+${i + 1})`}
          >
            {VIEW_LABELS[id]}
          </button>
        ))}
      </div>

      <div className='spacer' />

      {view === 'world' && (
        <div className='zoom-group' title='canvas zoom'>
          <button
            className='small'
            onClick={() => useUiStore.getState().setZoom(zoom - 0.25)}
          >
            −
          </button>
          <span className='zval'>{Math.round(zoom * 100)}%</span>
          <button
            className='small'
            onClick={() => useUiStore.getState().setZoom(zoom + 0.25)}
          >
            +
          </button>
          <button className='small' onClick={() => useUiStore.getState().setZoom(1)}>
            fit
          </button>
        </div>
      )}

      <button
        className='primary'
        data-tour='play'
        onClick={() => setPlaying(true)}
        title='build and play the game (with sound) — Ctrl+R'
      >
        ▶ Play
      </button>

      <button
        className={buildTerminalOpen ? 'small on' : 'small'}
        onClick={() => useUiStore.getState().toggleBuildTerminal()}
        title='toggle build output terminal'
      >
        ⌗ Build
      </button>

      <select
        className='help-select'
        value={theme}
        onChange={(e) =>
          useUiStore.getState().setTheme(e.target.value as ThemeId)
        }
        title='GUI colour theme'
      >
        {THEME_IDS.map((id) => (
          <option key={id} value={id}>
            {THEME_LABELS[id]}
          </option>
        ))}
      </select>

      <select
        className='help-select'
        data-tour='help'
        value=''
        onChange={(e) => {
          if (e.target.value)
            useUiStore.getState().startTour(e.target.value as TourId);
        }}
        title='guided tours'
      >
        <option value=''>? help</option>
        {TOUR_IDS.map((id: TourId) => (
          <option key={id} value={id}>
            {TOURS[id].label}
          </option>
        ))}
      </select>

      {playing && <PlayOverlay onClose={() => setPlaying(false)} />}
    </div>
  );
}

export type { ViewId };
