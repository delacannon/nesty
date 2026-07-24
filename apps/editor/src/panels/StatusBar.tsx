import { useEffect } from 'react';
import { buildRom } from '@nesty/compiler';
import { MAX_TILES } from '@nesty/core';
import { download, fileStem } from '../download';
import { buildWebZip } from '../webExport';
import { useBuildStore } from '../store/buildStore';
import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';

export function StatusBar() {
  const game = useGameStore((s) => s.game);
  const status = useBuildStore();
  const view = useUiStore((s) => s.view);

  // rebuild (debounced) whenever the game changes; publish to the shared store
  useEffect(() => {
    const t = setTimeout(() => {
      const res = buildRom(game);
      useBuildStore.getState().setResult({
        ok: res.ok,
        report: res.report,
        diagnostics: res.diagnostics,
        rom: res.rom,
        asm: res.asm,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [game]);

  const Meter = ({
    label,
    used,
    max,
    hint,
  }: {
    label: string;
    used: number;
    max: number;
    hint?: string;
  }) => {
    const pct = Math.min(100, Math.round((used / max) * 100));
    return (
      <span
        className='meter'
        title={`${used} / ${max}${hint ? ' — ' + hint : ''}`}
      >
        {label}
        <span className='bar'>
          <div className={pct > 85 ? 'hot' : ''} style={{ width: pct + '%' }} />
        </span>
        {pct}%
      </span>
    );
  };

  const firstError = status.diagnostics.find((d) => d.severity === 'error');

  return (
    <div className='statusbar' data-tour='status'>
      {view === 'world' && (
        <>
          <button
            className='status-btn'
            title='toggle tools & navigator'
            onClick={() => useUiStore.getState().toggleLeft()}
          >
            ◧
          </button>
          <button
            className='status-btn'
            title='toggle inspector'
            onClick={() => useUiStore.getState().toggleRight()}
          >
            ◨
          </button>
        </>
      )}

      {status.built && status.ok && status.report ? (
        <>
          <span className='ok'>◉ ROM OK</span>
          <Meter label='PRG' used={status.report.prgUsed} max={32768} />
          <Meter
            label='BG CHR'
            used={status.report.bgChrUsed}
            max={256}
            hint={`font/ui ${status.report.bgFontTiles} · dialog ${status.report.bgDialogTiles} · tiles ${status.report.bgTileTiles}`}
          />
          <Meter label='SPR CHR' used={status.report.sprChrUsed} max={256} />
          <span>
            {game.rooms.length}/24 rooms · {game.tiles.length}/{MAX_TILES} tiles ·{' '}
            {status.report.dialogBytes}B dialog
          </span>
        </>
      ) : status.built ? (
        <span className='err'>✕ {firstError?.message ?? 'build failed'}</span>
      ) : (
        <span>…</span>
      )}

      <span style={{ marginLeft: 'auto' }}>ctrl+z undo · autosaves to this browser</span>

      <button
        className='status-btn'
        onClick={() => useUiStore.getState().toggleBuildTerminal()}
        title='show build output'
      >
        ⌗ output
      </button>
      <button
        className='status-btn'
        disabled={!status.ok || !status.rom}
        title='download iNES ROM'
        onClick={() => {
          if (status.rom)
            download(fileStem(game.title) + '.nes', status.rom, 'application/octet-stream');
        }}
      >
        ⬇ .nes
      </button>
      <button
        className='status-btn'
        disabled={!status.ok || !status.rom}
        title='download itch.io web build (.zip): index.html + emulator + ROM'
        onClick={() => {
          if (status.rom) {
            const stem = fileStem(game.title);
            download(
              stem + '-web.zip',
              buildWebZip(status.rom, game.title || 'NESty game', stem),
              'application/zip',
            );
          }
        }}
      >
        ⬇ .zip
      </button>
      <button
        className='status-btn'
        disabled={!status.asm}
        title='download generated assembly'
        onClick={() => {
          if (status.asm) download(fileStem(game.title) + '.asm', status.asm, 'text/plain');
        }}
      >
        ⬇ .asm
      </button>
    </div>
  );
}
