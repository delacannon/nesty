import { useEffect, useRef, useState } from 'react';
import type { AvatarDef, Frame16, Pixel, SubPal } from '@nesty/core';
import { blankFrame } from '@nesty/core';
import { drawFrame, paletteFor, sprColors } from '../draw';
import { confirmAction } from '../store/confirmStore';
import { ensureFrame2, useGameStore } from '../store/gameStore';

const PSCALE = 14;

type Facing = 'side' | 'up' | 'down';
const FACINGS: { id: Facing; label: string }[] = [
  { id: 'side', label: 'side (L/R)' },
  { id: 'up', label: 'up' },
  { id: 'down', label: 'down' },
];

/** Slide speed presets: label -> px/frame (cell = 16px, so frames/tile = 16/px). */
const SPEEDS: { label: string; px: number; hint: string }[] = [
  { label: 'slow', px: 2, hint: '8 frames / tile' },
  { label: 'medium', px: 4, hint: '4 frames / tile' },
  { label: 'fast', px: 8, hint: '2 frames / tile' },
];

const facingFrames = (av: AvatarDef, f: Facing): Frame16[] | undefined =>
  f === 'up' ? av.framesUp : f === 'down' ? av.framesDown : av.frames;

/** 16×16 sprite thumbnail rendered at native resolution, upscaled crisp. */
function SpriteThumb({
  frame,
  colors,
  onClick,
  title,
}: {
  frame: Frame16;
  colors: (string | null)[];
  onClick: () => void;
  title: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 16, 16);
    drawFrame(ctx, frame, colors, 0, 0, 1); // 1 device px per sprite px
  }, [frame, colors]);
  return (
    <canvas
      ref={ref}
      width={16}
      height={16}
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        imageRendering: 'pixelated',
        cursor: 'pointer',
        border: '1px solid var(--line)',
        background: 'var(--bg-inset)',
      }}
    />
  );
}

export function AvatarPanel() {
  const game = useGameStore((s) => s.game);
  const avatar = game.avatar;
  const smoothMove = game.smoothMove ?? false;
  const moveSpeed = game.moveSpeed ?? 4;
  const moveCont = game.moveCont ?? false;
  const flipOnMove = avatar.flipOnMove ?? false;

  const [facing, setFacing] = useState<Facing>('side');
  const [drawColor, setDrawColor] = useState<Pixel>(1);
  const [curFrame, setCurFrame] = useState(0);
  const [preview, setPreview] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);

  const room = game.rooms.find((r) => r.id === game.startRoom) ?? game.rooms[0];
  const pal = room ? paletteFor(game, room) : undefined;
  const colors = pal
    ? sprColors(pal, avatar.sprPal)
    : ['#000', '#555', '#aaa', '#fff'];

  const frames = facingFrames(avatar, facing);
  const nFrames = frames?.length ?? 0;
  const fi = Math.min(curFrame, Math.max(0, nFrames - 1));
  const frame = frames?.[fi];

  useEffect(() => {
    const t = setInterval(() => setPreview((v) => v + 1), 400);
    return () => clearInterval(t);
  }, []);

  // pixel editor
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !frame) return;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#14141f' : '#1a1a28';
        ctx.fillRect(x * PSCALE, y * PSCALE, PSCALE, PSCALE);
      }
    }
    drawFrame(ctx, frame, colors, 0, 0, PSCALE);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 1; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * PSCALE + 0.5, 0);
      ctx.lineTo(i * PSCALE + 0.5, 224);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * PSCALE + 0.5);
      ctx.lineTo(224, i * PSCALE + 0.5);
      ctx.stroke();
    }
  }, [frame, colors]);

  // animating preview of the current facing
  useEffect(() => {
    const ctx = prevRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    if (nFrames) drawFrame(ctx, frames![preview % nFrames]!, colors, 0, 0, 4);
  }, [frames, colors, preview, nFrames]);

  const setPixelAt = (e: React.PointerEvent) => {
    if (!frame) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(15, Math.floor((e.clientX - rect.left) / PSCALE)));
    const y = Math.max(0, Math.min(15, Math.floor((e.clientY - rect.top) / PSCALE)));
    useGameStore.getState().mutateGame((g) => {
      const fs = facingFrames(g.avatar, facing);
      if (fs) fs[fi]![y * 16 + x] = drawColor;
    });
  };

  // facings that currently have art and could seed this one
  const sources = FACINGS.filter(
    (f) => f.id !== facing && facingFrames(avatar, f.id),
  );

  // replace the current facing's frames with a copy of another facing's art
  const copyFrom = async (src: Facing) => {
    if (facingFrames(avatar, facing)) {
      const srcLabel = FACINGS.find((f) => f.id === src)?.label ?? src;
      const ok = await confirmAction({
        title: 'Replace with copy',
        message: `Replace the ${facing} frames with a copy of the ${srcLabel} frames? Current pixels are lost (Undo can restore them).`,
        confirmLabel: 'Replace',
        danger: true,
      });
      if (!ok) return;
    }
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      const sf = facingFrames(g.avatar, src)!.map((f) => f.slice());
      if (facing === 'up') g.avatar.framesUp = sf;
      else if (facing === 'down') g.avatar.framesDown = sf;
      else g.avatar.frames = sf;
    });
    setCurFrame(0);
  };

  // create a 2-frame blank set for a missing up/down facing
  const createFacing = () => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      const f = [blankFrame(), blankFrame()];
      if (facing === 'up') g.avatar.framesUp = f;
      else if (facing === 'down') g.avatar.framesDown = f;
    });
    setCurFrame(0);
  };

  const removeAnim = async () => {
    const ok = await confirmAction({
      title: 'Remove animation frame',
      message:
        'Delete the second frame of this avatar facing? The pixels in frame 2 are lost (Undo can restore them).',
      confirmLabel: 'Remove frame',
      danger: true,
    });
    if (!ok) return;
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      const fs = facingFrames(g.avatar, facing);
      if (fs && fs.length > 1) fs.pop();
    });
    setCurFrame(0);
  };

  const setSprPal = (p: SubPal) =>
    useGameStore.getState().mutateGame((g) => {
      g.avatar.sprPal = p;
    });

  const setFlip = (v: boolean) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      if (v) g.avatar.flipOnMove = true;
      else delete g.avatar.flipOnMove;
    });
  };

  const setSmooth = (v: boolean) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      if (v) {
        g.smoothMove = true;
        g.moveSpeed = g.moveSpeed ?? 4;
      } else g.smoothMove = false;
    });
  };

  const setSpeed = (px: number) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      g.moveSpeed = px;
    });
  };

  const setCont = (v: boolean) => {
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      g.moveCont = v;
      // continuous glide reads best slow — default the speed to slow when enabled
      if (v) g.moveSpeed = 2;
    });
  };

  return (
    <div className='panel w-avatar'>
      <header>
        avatar
        <span className='hint'>{avatar.name}</span>
      </header>
      <div className='body'>
        <div className='toolbar'>
          {FACINGS.map((f) => (
            <button
              key={f.id}
              className={facing === f.id ? 'on small' : 'small'}
              onClick={() => {
                setFacing(f.id);
                setCurFrame(0);
              }}
              title={
                f.id === 'side'
                  ? 'left/right facing (left mirrors this when flip-on-move is on)'
                  : `${f.id}-facing sprite`
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          className='field-row'
          title='sprite sub-palette (3 colours + shared transparent)'
        >
          <label>sub-pal</label>
          {([0, 1, 2, 3] as SubPal[]).map((p) => {
            const cols = pal ? sprColors(pal, p) : [];
            return (
              <span className='subpal-wrap' key={p}>
                <button
                  className={avatar.sprPal === p ? 'on small' : 'small'}
                  onClick={() => setSprPal(p)}
                >
                  {p}
                </button>
                <span className='subpal-tip'>
                  {cols.map((c, i) => (
                    <span
                      key={i}
                      className={
                        i === 0 ? 'subpal-swatch transparent' : 'subpal-swatch'
                      }
                      style={i === 0 ? {} : { background: c ?? '#000' }}
                      title={i === 0 ? 'transparent' : `color ${i}`}
                    />
                  ))}
                </span>
              </span>
            );
          })}
        </div>

        {sources.length > 0 && (
          <div
            className='field-row'
            title='duplicate another facing’s drawing into this one, replacing its frames'
          >
            <label>copy from</label>
            {sources.map((sfc) => (
              <span
                key={sfc.id}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <SpriteThumb
                  frame={facingFrames(avatar, sfc.id)![0]!}
                  colors={colors}
                  onClick={() => void copyFrom(sfc.id)}
                  title={`copy ${sfc.label} into ${facing}`}
                />
                <span className='hint' style={{ fontSize: 10 }}>
                  {sfc.label}
                </span>
              </span>
            ))}
          </div>
        )}

        {!frames ? (
          <div className='field-row'>
            <button className='small' onClick={createFacing}>
              ＋ draw {facing} sprite (2 frames)
            </button>
            <span className='hint'>
              no dedicated {facing} art — copy a facing above, or the side
              sprite is used
            </span>
          </div>
        ) : (
          <div className='pixel-editor-row'>
            <div className='swatches'>
              {([0, 1, 2, 3] as Pixel[]).map((c) => (
                <div
                  key={c}
                  className={
                    (drawColor === c ? 'swatch selected' : 'swatch') +
                    (c === 0 ? ' transparent' : '')
                  }
                  style={c === 0 ? {} : { background: colors[c] ?? '#000' }}
                  onClick={() => setDrawColor(c)}
                  title={c === 0 ? 'transparent' : `color ${c}`}
                />
              ))}
            </div>
            <canvas
              ref={canvasRef}
              width={224}
              height={224}
              style={{ cursor: 'crosshair', border: '1px solid var(--line-bright)' }}
              onPointerDown={(e) => {
                useGameStore.getState().snapshot();
                painting.current = true;
                setPixelAt(e);
              }}
              onPointerMove={(e) => painting.current && setPixelAt(e)}
              onPointerUp={() => (painting.current = false)}
              onPointerLeave={() => (painting.current = false)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <canvas
                ref={prevRef}
                width={64}
                height={64}
                style={{
                  border: '1px solid var(--line)',
                  background: 'var(--bg-inset)',
                  imageRendering: 'pixelated',
                }}
              />
              <div className='field-row'>
                <label>frame</label>
                {[0, 1].map((f) => (
                  <button
                    key={f}
                    className={curFrame === f ? 'on small' : 'small'}
                    disabled={f === 1 && nFrames < 2}
                    onClick={() => setCurFrame(f)}
                  >
                    {f + 1}
                  </button>
                ))}
                {nFrames < 2 ? (
                  <button
                    className='small'
                    onClick={() => {
                      const st = useGameStore.getState();
                      st.snapshot();
                      st.mutateGame((g) => {
                        const fs = facingFrames(g.avatar, facing);
                        if (fs) ensureFrame2(fs);
                      });
                      setCurFrame(1);
                    }}
                  >
                    + anim
                  </button>
                ) : (
                  <button className='small' onClick={removeAnim}>
                    - anim
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className='field-row'>
          <label>name</label>
          <input
            type='text'
            value={avatar.name}
            onChange={(e) => {
              const v = e.target.value;
              useGameStore.getState().mutateGame((g) => {
                g.avatar.name = v;
              });
            }}
          />
        </div>

        <div className='field-row'>
          <label title='when walking left, mirror the side sprite horizontally so it faces left (rotate/flip). Off: left uses the side art unmirrored'>
            <input
              type='checkbox'
              checked={flipOnMove}
              onChange={(e) => setFlip(e.target.checked)}
            />{' '}
            flip sprite on move (mirror when facing left)
          </label>
        </div>

        <div className='field-row'>
          <label title='avatar slides tile-to-tile instead of snapping. movement stays grid-locked and orthogonal; only the transition is tweened'>
            <input
              type='checkbox'
              checked={smoothMove}
              onChange={(e) => setSmooth(e.target.checked)}
            />{' '}
            smooth movement (tween between tiles)
          </label>
        </div>
        {smoothMove && (
          <>
            <div className='field-row'>
              <label>speed</label>
              {SPEEDS.map((sp) => (
                <button
                  key={sp.px}
                  className={moveSpeed === sp.px ? 'on small' : 'small'}
                  onClick={() => setSpeed(sp.px)}
                  title={sp.hint}
                >
                  {sp.label}
                </button>
              ))}
            </div>
            <div className='field-row'>
              <label title='hold a direction to keep gliding across tiles without stopping. Off: one tile per press (autorepeat when held)'>
                <input
                  type='checkbox'
                  checked={moveCont}
                  onChange={(e) => setCont(e.target.checked)}
                />{' '}
                continuous movement (glide while held)
              </label>
            </div>
          </>
        )}
        <div className='keys'>
          {smoothMove
            ? `${moveCont ? 'glides while held' : 'one tile per press'} · ${moveSpeed}px/frame`
            : 'default: instant grid-snap movement'}
        </div>
      </div>
    </div>
  );
}
