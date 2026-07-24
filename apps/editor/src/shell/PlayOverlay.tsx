import { useEffect, useRef, useState } from 'react';
import { buildRom } from '@nesty/compiler';
import { PLAY_ROM_KEY, PLAY_TITLE_KEY, toBase64 } from '../download';
import { NesRunner } from '../nes/NesRunner';
import { useGameStore } from '../store/gameStore';

/** Full-screen play overlay: builds the current game and runs it in jsnes
 *  with sound + keyboard. Opened from the toolbar ▶ Play button. */
export function PlayOverlay({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<NesRunner | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const res = buildRom(useGameStore.getState().game);
    if (!res.ok || !res.rom) {
      setErr(
        res.diagnostics.find((d) => d.severity === 'error')?.message ??
          'build failed',
      );
      return;
    }
    const ctx = canvasRef.current!.getContext('2d')!;
    const runner = new NesRunner(ctx);
    runnerRef.current = runner;
    runner.loadRom(res.rom);
    runner.start();
    runner.enableAudio();
    canvasRef.current!.focus();
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') return onClose();
      if (runner.handleKey(e.code, true)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (runner.handleKey(e.code, false)) e.preventDefault();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      runner.disableAudio();
      runner.stop();
      runnerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInTab = () => {
    const res = buildRom(useGameStore.getState().game);
    if (!res.ok || !res.rom) {
      setErr(
        res.diagnostics.find((d) => d.severity === 'error')?.message ??
          'build failed',
      );
      return;
    }
    localStorage.setItem(PLAY_ROM_KEY, toBase64(res.rom));
    localStorage.setItem(PLAY_TITLE_KEY, useGameStore.getState().game.title || 'NESty');
    window.open('play.html', '_blank', 'noopener');
  };

  return (
    <div className='play-overlay'>
      <div className='play-bar'>
        <button className='primary' onClick={onClose}>
          ■ stop (esc)
        </button>
        <button
          className='small'
          title='open big in a new browser tab (with a fullscreen button)'
          onClick={openInTab}
        >
          ⛶ new tab
        </button>
        <span className='keys'>
          <b>←→↑↓</b> walk · <b>Z</b> talk · <b>Enter</b> start
        </span>
      </div>
      {err && <div className='diag'>{err}</div>}
      <div className='tv'>
        <canvas
          ref={canvasRef}
          width={256}
          height={240}
          style={{ width: 512, height: 480 }}
          tabIndex={0}
        />
      </div>
    </div>
  );
}
