import { useState } from 'react';
import { useBuildStore } from '../store/buildStore';
import { useUiStore } from '../store/uiStore';

/** Toggleable build-output overlay above the status bar: full diagnostics
 *  (not just the first error) + the generated 6502 assembly. */
export function BuildTerminal() {
  const open = useUiStore((s) => s.buildTerminalOpen);
  const b = useBuildStore();
  const [showAsm, setShowAsm] = useState(false);
  if (!open) return null;

  return (
    <div className='build-terminal'>
      <div className='bt-head'>
        <strong>Build output</strong>
        {b.built &&
          (b.ok ? (
            <span className='bt-line ok'>◉ ROM OK</span>
          ) : (
            <span className='bt-line error'>✕ build failed</span>
          ))}
        <span style={{ marginLeft: 'auto' }} />
        <button
          className={showAsm ? 'small on' : 'small'}
          disabled={!b.asm}
          onClick={() => setShowAsm((v) => !v)}
        >
          asm
        </button>
        <button className='small' onClick={() => useUiStore.getState().toggleBuildTerminal()}>
          close
        </button>
      </div>
      <div className='bt-body'>
        {!b.built && <div className='bt-line'>building…</div>}
        {b.built && b.diagnostics.length === 0 && (
          <div className='bt-line ok'>no diagnostics.</div>
        )}
        {b.diagnostics.map((d, i) => (
          <div
            key={i}
            className={
              'bt-line ' + (d.severity === 'error' ? 'error' : 'warning')
            }
          >
            {d.severity === 'error' ? '✕' : '⚠'} {d.message}
          </div>
        ))}
        {b.built && b.report && (
          <>
            <div className='bt-line' style={{ marginTop: 8, opacity: 0.8 }}>
              PRG {b.report.prgUsed}/32768 · BG CHR {b.report.bgChrUsed}/256 ·
              SPR CHR {b.report.sprChrUsed}/256 · {b.report.dialogBytes}B dialog
            </div>
            <div className='bt-line' style={{ opacity: 0.8 }}>
              BG CHR breakdown → font/ui {b.report.bgFontTiles} · dialog{' '}
              {b.report.bgDialogTiles} · tile art {b.report.bgTileTiles}
            </div>
          </>
        )}
        {showAsm && b.asm && <pre className='asm'>{b.asm}</pre>}
      </div>
    </div>
  );
}
