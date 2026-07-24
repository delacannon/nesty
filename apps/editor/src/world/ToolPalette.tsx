import type { SubPal } from '@nesty/core';
import { bgColors, paletteFor } from '../draw';
import { currentRoom, useGameStore } from '../store/gameStore';
import { TOOLS } from './tools';

/** Left-rail vertical tool palette for the World view. */
export function ToolPalette() {
  const s = useGameStore();
  const room = currentRoom(s);
  const pal = paletteFor(s.game, room);

  return (
    <>
      <div className='rail-section-head'>Tools</div>
      <div className='tool-rail' data-tour='room-tools'>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={s.tool === t.id ? 'on' : ''}
            onClick={() => useGameStore.getState().setTool(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
        {s.tool === 'palette' && (
          <div className='subpal-row'>
            <label style={{ color: 'var(--ink-dim)', fontSize: 10 }}>
              sub-pal
            </label>
            {([0, 1, 2, 3] as SubPal[]).map((p) => {
              const cols = bgColors(pal, p);
              return (
                <span className='subpal-wrap' key={p}>
                  <button
                    className={s.paintSubPal === p ? 'on small' : 'small'}
                    onClick={() => useGameStore.setState({ paintSubPal: p })}
                  >
                    {p}
                  </button>
                  <span className='subpal-tip'>
                    {cols.map((c, i) => (
                      <span
                        key={i}
                        className='subpal-swatch'
                        style={{ background: c ?? '#000' }}
                        title={i === 0 ? 'backdrop' : `color ${i}`}
                      />
                    ))}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
