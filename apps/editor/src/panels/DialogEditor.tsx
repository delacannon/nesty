import {
  FX_BLINK,
  FX_COL1,
  FX_CYCLE,
  FX_WAVE,
  wrapTextRich,
  TEXT_LINES_PER_PAGE,
  type RichLine,
} from '@nesty/compiler';
import { useState } from 'react';
import { nextId, renameDialog, useGameStore } from '../store/gameStore';

function markStyle(mark: number): {
  className?: string;
  color?: string;
  title?: string;
} {
  const classes: string[] = [];
  const titles: string[] = [];
  let color: string | undefined;
  if (mark & FX_CYCLE) {
    color = '#5ce430';
    titles.push('color cycles in-game');
  } else if (mark & FX_COL1) color = '#ea9e22';
  if (mark & FX_BLINK) {
    classes.push('dlg-blink');
    titles.push('blinks in-game');
  }
  if (mark & FX_WAVE) {
    classes.push('dlg-wave');
    titles.push('waves in-game (1px bob)');
  }
  return {
    className: classes.join(' ') || undefined,
    color,
    title: titles.join(' · ') || undefined,
  };
}

function PreviewLine({ line }: { line: RichLine }) {
  // group consecutive chars sharing a mark into styled spans
  const spans: { text: string; mark: number }[] = [];
  [...line.text].forEach((ch, i) => {
    const mark = line.marks[i] ?? 0;
    const last = spans[spans.length - 1];
    if (last && last.mark === mark) last.text += ch;
    else spans.push({ text: ch, mark });
  });
  return (
    <div>
      {spans.map((sp, i) => {
        const st = markStyle(sp.mark);
        return (
          <span
            key={i}
            className={st.className}
            style={st.color ? { color: st.color } : undefined}
            title={st.title}
          >
            {sp.text}
          </span>
        );
      })}
    </div>
  );
}

export function DialogEditor() {
  const s = useGameStore();
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const dlgIds = Object.keys(s.game.dialogs);
  const cur =
    s.selectedDlgId && s.game.dialogs[s.selectedDlgId] !== undefined
      ? s.selectedDlgId
      : (dlgIds[0] ?? null);
  const text = cur ? s.game.dialogs[cur]! : '';

  return (
    <div className='panel w-dialog'>
      <header>
        dialog{cur ? ` ${cur}` : ''}
        <span className='hint'>
          28 cols · 2 lines/page · [col1]w[/col1] · [cycle]w[/cycle] ·
          [blink]w[/blink] · [wave]w[/wave]
        </span>
      </header>
      <div className='body'>
        <div className='dlg-list'>
          {dlgIds.map((id) => (
            <button
              key={id}
              className={id === cur ? 'on small' : 'small'}
              onClick={() => useGameStore.setState({ selectedDlgId: id })}
            >
              {id}
            </button>
          ))}
          <button
            className='small'
            onClick={() => {
              const st = useGameStore.getState();
              st.snapshot();
              const id = nextId(new Set(Object.keys(st.game.dialogs)), false);
              st.mutateGame((g) => {
                g.dialogs[id] = 'HELLO.';
              });
              useGameStore.setState({ selectedDlgId: id });
            }}
          >
            +
          </button>
          {cur && (
            <button
              className='small'
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                const st = useGameStore.getState();
                st.snapshot();
                st.mutateGame((g) => {
                  delete g.dialogs[cur];
                  for (const sp of g.sprites)
                    if (sp.dlgId === cur) sp.dlgId = undefined;
                  for (const it of g.items)
                    if (it.dlgId === cur) it.dlgId = undefined;
                  for (const r of g.rooms)
                    r.endings = r.endings.filter((e) => e.dlgId !== cur);
                });
                useGameStore.setState({ selectedDlgId: null });
              }}
            >
              delete
            </button>
          )}
        </div>
        {cur !== null && (
          <>
            <div className='field-row'>
              <label title='the id every sprite, item, exit and ending points at — renaming updates all references'>
                ref id
              </label>
              <input
                key={cur}
                type='text'
                defaultValue={cur}
                style={{ width: 90 }}
                title='rename this dialog reference (updates everywhere it is used)'
                onFocus={() => setRenameErr(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const err = renameDialog(cur, e.target.value);
                  if (err) {
                    setRenameErr(err);
                    e.target.value = cur; // revert the field
                  } else {
                    setRenameErr(null);
                  }
                }}
              />
              {renameErr && (
                <span style={{ color: 'var(--red)', fontSize: 11 }}>
                  {renameErr}
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => {
                const v = e.target.value;
                s.mutateGame((g) => {
                  g.dialogs[cur] = v;
                });
              }}
            />
            <div className='nes-preview'>
              {(() => {
                const lines = wrapTextRich(text, s.game.font);
                const pages: RichLine[][] = [];
                for (let i = 0; i < lines.length; i += TEXT_LINES_PER_PAGE)
                  pages.push(lines.slice(i, i + TEXT_LINES_PER_PAGE));
                return pages.map((page, i) => (
                  <div className='page' key={i}>
                    {page.map((line, j) => (
                      <PreviewLine key={j} line={line} />
                    ))}
                  </div>
                ));
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
