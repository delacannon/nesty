import { useEffect, useRef, useState } from 'react';
import { blankSplash, splashHasContent, SPLASH_H, SPLASH_W } from '@nesty/core';
import { bgColors, drawFrame, rgb } from '../draw';
import { useGameStore } from '../store/gameStore';
import {
  applySplashImport,
  quantizeSplash,
  SPLASH_IMG_H,
  SPLASH_IMG_W,
} from '../splashImport';

const SCALE = 1.5; // canvas 384×336, one cell = 24px

export function SplashPanel() {
  const s = useGameStore();
  const game = s.game;
  const splash = game.splash;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const painting = useRef(false);
  const [erase, setErase] = useState(false);
  const [msg, setMsg] = useState('');

  const pal =
    game.palettes.find((p) => p.id === splash?.palId) ?? game.palettes[0]!;
  const curTile =
    s.drawTarget.kind === 'tile'
      ? game.tiles.find((t) => t.id === (s.drawTarget as { id: string }).id)
      : undefined;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = rgb(pal.backdrop);
    ctx.fillRect(0, 0, SPLASH_IMG_W * SCALE, SPLASH_IMG_H * SCALE);
    if (!splash) return;
    for (let cy = 0; cy < SPLASH_H; cy++) {
      for (let cx = 0; cx < SPLASH_W; cx++) {
        const id = splash.tiles[cy * SPLASH_W + cx]!;
        if (id === '0') continue;
        const t = game.tiles.find((tt) => tt.id === id);
        if (!t) continue;
        const colors = bgColors(pal, splash.pmap[cy * SPLASH_W + cx]!);
        drawFrame(
          ctx,
          t.frames[0]!,
          colors,
          cx * 16 * SCALE,
          cy * 16 * SCALE,
          SCALE,
        );
      }
    }
  }, [splash, game.tiles, pal]);

  const paintAt = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = Math.max(
      0,
      Math.min(
        SPLASH_W - 1,
        Math.floor(((e.clientX - rect.left) / rect.width) * SPLASH_W),
      ),
    );
    const cy = Math.max(
      0,
      Math.min(
        SPLASH_H - 1,
        Math.floor(((e.clientY - rect.top) / rect.height) * SPLASH_H),
      ),
    );
    const st = useGameStore.getState();
    st.mutateGame((g) => {
      if (!g.splash) g.splash = blankSplash(g.palettes[0]!.id);
      const i = cy * SPLASH_W + cx;
      if (erase || !curTile) {
        g.splash.tiles[i] = '0';
      } else {
        g.splash.tiles[i] = curTile.id;
        g.splash.pmap[i] = st.paintSubPal;
      }
    });
  };

  const importPng = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const cv = document.createElement('canvas');
      cv.width = SPLASH_IMG_W;
      cv.height = SPLASH_IMG_H;
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      if (img.width !== SPLASH_IMG_W || img.height !== SPLASH_IMG_H)
        setMsg(`note: ${img.width}×${img.height} scaled to 256×224`);
      else setMsg('');
      ctx.drawImage(img, 0, 0, SPLASH_IMG_W, SPLASH_IMG_H);
      const data = ctx.getImageData(0, 0, SPLASH_IMG_W, SPLASH_IMG_H).data;
      const r = quantizeSplash(useGameStore.getState().game, data);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      const st = useGameStore.getState();
      st.snapshot();
      st.mutateGame((g) => applySplashImport(g, r));
      setMsg((m) => (m ? m + ' · ' : '') + r.message);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setMsg('could not read image');
    };
    img.src = url;
  };

  return (
    <div className='panel'>
      <header>
        splash screen
        <span className='hint'>
          {splashHasContent(splash)
            ? 'shown instead of title'
            : 'empty — text title shown'}
        </span>
      </header>
      <div className='body'>
        <div className='toolbar'>
          <button className='small' onClick={() => fileRef.current?.click()}>
            import png (256×224)
          </button>
          <input
            ref={fileRef}
            type='file'
            accept='image/png,image/*'
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importPng(f);
              e.target.value = '';
            }}
          />
          <button
            className={erase ? 'on small' : 'small'}
            onClick={() => setErase((v) => !v)}
          >
            erase
          </button>
          <button
            className='small'
            onClick={() => {
              if (!splashHasContent(splash)) return;
              if (!confirm('Clear the splash screen? The text title returns.'))
                return;
              const st = useGameStore.getState();
              st.snapshot();
              st.mutateGame((g) => {
                delete g.splash;
              });
            }}
            style={{ marginLeft: 'auto' }}
          >
            clear
          </button>
        </div>
        <div className='field-row'>
          <label>palette</label>
          <select
            value={splash?.palId ?? game.palettes[0]!.id}
            onChange={(e) => {
              const v = e.target.value;
              const st = useGameStore.getState();
              st.snapshot();
              st.mutateGame((g) => {
                if (!g.splash) g.splash = blankSplash(v);
                else g.splash.palId = v;
              });
            }}
          >
            {game.palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
          <label>song</label>
          <select
            title='song that loops on the splash screen'
            value={splash?.songId ?? ''}
            onChange={(e) => {
              const v = e.target.value || undefined;
              const st = useGameStore.getState();
              st.snapshot();
              st.mutateGame((g) => {
                if (!g.splash) g.splash = blankSplash(g.palettes[0]!.id);
                if (v) g.splash.songId = v;
                else delete g.splash.songId;
              });
            }}
          >
            <option value=''>(silent)</option>
            {game.songs.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.id} {sg.name}
              </option>
            ))}
          </select>
        </div>
        {msg && <div className='diag'>{msg}</div>}
        <canvas
          ref={canvasRef}
          width={SPLASH_IMG_W * SCALE}
          height={SPLASH_IMG_H * SCALE}
          style={{
            cursor: 'crosshair',
            border: '1px solid var(--line-bright)',
            imageRendering: 'pixelated',
            alignSelf: 'flex-start',
          }}
          onPointerDown={(e) => {
            useGameStore.getState().snapshot();
            painting.current = true;
            paintAt(e);
          }}
          onPointerMove={(e) => painting.current && paintAt(e)}
          onPointerUp={() => (painting.current = false)}
          onPointerLeave={() => (painting.current = false)}
        />
        <div className='keys'>
          {curTile ? ` · painting: ${curTile.id} ${curTile.name}` : ''}
        </div>
      </div>
    </div>
  );
}
