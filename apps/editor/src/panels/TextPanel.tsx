import { useEffect, useRef } from 'react';
import {
  FONT_CHAR_COUNT,
  fontChrTiles,
  fontExtChars,
  fontExtChrTiles,
} from '@nesty/compiler';
import type { FontStyle, TextSpeed } from '@nesty/core';
import { useGameStore } from '../store/gameStore';

const FONTS: FontStyle[] = ['classic', 'thin', 'bold', 'scifi', 'katakana'];
const SPEEDS: TextSpeed[] = ['slow', 'normal', 'fast', 'turbo'];
const SPEED_HINT: Record<TextSpeed, string> = {
  instant: 'whole page at once',
  slow: '15 chars/s',
  normal: '30 chars/s',
  fast: '60 chars/s',
  turbo: '120 chars/s',
};

const TILE = 8;
const SCALE = 2;
const COLS = 16;

/** Draw one 16-byte CHR tile: color 3 = ink, anything else = panel bg. */
function drawTile(
  ctx: CanvasRenderingContext2D,
  bytes: Uint8Array,
  tx: number,
  ty: number,
) {
  for (let y = 0; y < TILE; y++) {
    const p0 = bytes[y]!;
    const p1 = bytes[y + 8]!;
    for (let x = 0; x < TILE; x++) {
      const bit = 0x80 >> x;
      const c = (p0 & bit ? 1 : 0) | (p1 & bit ? 2 : 0);
      if (c === 3) {
        ctx.fillRect((tx * TILE + x) * SCALE, (ty * TILE + y) * SCALE, SCALE, SCALE);
      }
    }
  }
}

export function TextPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textSpeed = useGameStore((s) => s.game.textSpeed);
  const typewriterSfx = useGameStore((s) => s.game.typewriterSfx ?? false);
  const font = useGameStore((s) => s.game.font);
  const extChars = useGameStore((s) => s.game.extChars !== false);
  const enabled = textSpeed !== 'instant';

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#e8e8f0';
    const base = fontChrTiles(font);
    for (let i = 0; i < FONT_CHAR_COUNT; i++)
      drawTile(
        ctx,
        base.subarray(i * 16, i * 16 + 16),
        i % COLS,
        Math.floor(i / COLS),
      );
    if (extChars) {
      const ext = fontExtChrTiles(font);
      const extRow = Math.ceil(FONT_CHAR_COUNT / COLS);
      for (let i = 0; i < fontExtChars(font).length; i++)
        drawTile(
          ctx,
          ext.subarray(i * 16, i * 16 + 16),
          i % COLS,
          extRow + Math.floor(i / COLS),
        );
    }
  }, [font, extChars]);

  const setSpeed = (v: TextSpeed) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      g.textSpeed = v;
    });
  };

  const setFont = (v: FontStyle) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      g.font = v;
    });
  };

  const setExtChars = (v: boolean) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      if (v) delete g.extChars; // canonical: omit when on (default)
      else g.extChars = false;
    });
  };

  const rows =
    Math.ceil(FONT_CHAR_COUNT / COLS) +
    (extChars ? Math.ceil(fontExtChars(font).length / COLS) : 0);

  return (
    <div className='panel w-text'>
      <header>
        text
        <span className='hint'>{SPEED_HINT[textSpeed]}</span>
      </header>
      <div className='body'>
        <div className='field-row'>
          <label>font</label>
          {FONTS.map((v) => (
            <button
              key={v}
              className={font === v ? 'on small' : 'small'}
              onClick={() => setFont(v)}
              title='only the selected font is compiled into the ROM'
            >
              {v}
            </button>
          ))}
        </div>
        <div className='field-row'>
          <label
            title='drop the accent / katakana glyphs from the ROM to free background CHR (they render as ? if used)'
          >
            <input
              type='checkbox'
              checked={extChars}
              onChange={(e) => setExtChars(e.target.checked)}
            />{' '}
            extended chars ({font === 'katakana' ? 'katakana' : 'accents'})
          </label>
        </div>
        <div className='keys'>
          {!extChars
            ? 'ascii 32–95 only — extended glyphs excluded (saves BG CHR)'
            : font === 'katakana'
              ? 'ascii 32–95 + katakana (hiragana input auto-converts; ガ → カ゛)'
              : `ascii 32–95 + ${fontExtChars(font)}`}
        </div>
        <canvas
          ref={canvasRef}
          width={COLS * TILE * SCALE}
          height={rows * TILE * SCALE}
          style={{ imageRendering: 'pixelated', alignSelf: 'flex-start' }}
        />
        <div className='field-row'>
          <label>
            <input
              type='checkbox'
              checked={enabled}
              onChange={(e) => setSpeed(e.target.checked ? 'turbo' : 'instant')}
            />{' '}
            typewriter effect
          </label>
        </div>
        {enabled && (
          <div className='field-row'>
            <label>speed</label>
            {SPEEDS.map((v) => (
              <button
                key={v}
                className={textSpeed === v ? 'on small' : 'small'}
                onClick={() => setSpeed(v)}
                title={SPEED_HINT[v]}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {enabled && (
          <div className='field-row'>
            <label title="play the 'type' sound (edit it in the sound panel) once per character as text appears">
              <input
                type='checkbox'
                checked={typewriterSfx}
                onChange={(e) => {
                  const v = e.target.checked;
                  useGameStore.getState().snapshot();
                  useGameStore.getState().mutateGame((g) => {
                    g.typewriterSfx = v;
                  });
                }}
              />{' '}
              sound per character (uses the ‘type’ sound)
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
