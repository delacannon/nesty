import { useEffect, useRef, useState } from 'react';
import type { Cond, Frame16, Pixel, SubPal, TileDef } from '@nesty/core';
import { blankFrame } from '@nesty/core';
import { CondEditor } from '../components/CondPicker';
import { confirmAction } from '../store/confirmStore';
import { SpriteSheetImport } from '../components/SpriteSheetImport';
import { bgColors, drawFrame, paletteFor, sprColors } from '../draw';
import {
  currentDrawable,
  currentRoom,
  ensureFrame2,
  nextId,
  targetFrames,
  useGameStore,
  type DrawTarget,
} from '../store/gameStore';
import { useUiStore } from '../store/uiStore';

const KINDS = ['tile', 'sprite', 'item'] as const;
type Kind = (typeof KINDS)[number] | 'avatar';

function Thumb({
  frames,
  colors,
  selected,
  onClick,
  title,
}: {
  frames: Frame16[];
  colors: (string | null)[];
  selected: boolean;
  onClick: () => void;
  title: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 32, 32);
    drawFrame(ctx, frames[0]!, colors, 0, 0, 2);
  }, [frames, colors]);
  return (
    <canvas
      ref={ref}
      className={selected ? 'thumb selected' : 'thumb'}
      width={32}
      height={32}
      onClick={onClick}
      title={title}
    />
  );
}

export function DrawablesPanel() {
  const s = useGameStore();
  const game = s.game;
  const room = currentRoom(s);
  const pal = paletteFor(game, room);
  const kind: Kind = s.drawTarget.kind;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const [preview, setPreview] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPreview((v) => v + 1), 400);
    return () => clearInterval(t);
  }, []);

  // avatar editing moved to its own view: bounce any avatar target over there
  useEffect(() => {
    if (s.drawTarget.kind !== 'avatar') return;
    const g = useGameStore.getState().game;
    if (g.tiles[0]) setTarget({ kind: 'tile', id: g.tiles[0].id });
    useUiStore.getState().setView('avatar');
  }, [s.drawTarget.kind]);

  const drawable = currentDrawable(s);
  const isTile = kind === 'tile';
  const tileDef = isTile ? (drawable as TileDef | undefined) : undefined;
  const sprDef = !isTile
    ? (drawable as
        | {
            sprPal: SubPal;
            dlgId?: string;
            altDlgId?: string;
            altCond?: Cond;
          }
        | undefined)
    : undefined;

  const mutateCurrent = (fn: (d: NonNullable<typeof sprDef>) => void) => {
    const st = useGameStore.getState();
    st.mutateGame((g) => {
      const t = st.drawTarget;
      const d =
        t.kind === 'sprite'
          ? g.sprites.find((x) => x.id === t.id)
          : t.kind === 'item'
            ? g.items.find((x) => x.id === (t as { id: string }).id)
            : undefined;
      if (d) fn(d);
    });
  };

  // set the current drawable's sprite sub-palette (sprite / item / avatar)
  const setSprPal = (p: SubPal) => {
    const st = useGameStore.getState();
    st.mutateGame((g) => {
      const t = st.drawTarget;
      const d =
        t.kind === 'avatar'
          ? g.avatar
          : t.kind === 'sprite'
            ? g.sprites.find((x) => x.id === t.id)
            : t.kind === 'item'
              ? g.items.find((x) => x.id === t.id)
              : undefined;
      if (d) d.sprPal = p;
    });
  };

  const colors =
    isTile && drawable
      ? bgColors(pal, s.paintSubPal) // preview the tile in the picked BG sub-palette
      : sprDef
        ? sprColors(pal, sprDef.sprPal)
        : [];

  const frames = drawable ? drawable.frames : undefined;
  const frame = frames?.[Math.min(s.curFrame, (frames?.length ?? 1) - 1)];

  // pixel editor canvas
  const PSCALE = 14;
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !frame) return;
    // checker for transparent/backdrop
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

  // preview canvas (animating, 4x)
  const prevRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = prevRef.current?.getContext('2d');
    if (!ctx || !frames) return;
    ctx.clearRect(0, 0, 64, 64);
    const f = frames[preview % frames.length]!;
    drawFrame(ctx, f, colors, 0, 0, 4);
  }, [frames, colors, preview]);

  const setPixelAt = (e: React.PointerEvent) => {
    if (!drawable) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(15, Math.floor((e.clientX - rect.left) / PSCALE)),
    );
    const y = Math.max(
      0,
      Math.min(15, Math.floor((e.clientY - rect.top) / PSCALE)),
    );
    const st = useGameStore.getState();
    st.mutateGame((g) => {
      const fs = targetFrames(g, st.drawTarget);
      if (!fs) return;
      const fi = Math.min(st.curFrame, fs.length - 1);
      fs[fi]![y * 16 + x] = st.drawColor;
    });
  };

  const setTarget = (t: DrawTarget) => useGameStore.getState().setDrawTarget(t);

  const addOf = (k: Kind) => {
    const st = useGameStore.getState();
    st.snapshot();
    if (k === 'tile') {
      const id = nextId(new Set(st.game.tiles.map((t) => t.id)));
      st.mutateGame((g) =>
        g.tiles.push({
          id,
          name: 'tile ' + id,
          wall: false,
          frames: [blankFrame()],
        }),
      );
      setTarget({ kind: 'tile', id });
    } else if (k === 'sprite') {
      const id = nextId(new Set(st.game.sprites.map((t) => t.id)));
      st.mutateGame((g) =>
        g.sprites.push({
          id,
          name: 'sprite ' + id,
          frames: [blankFrame()],
          sprPal: 0,
          room: st.curRoomId,
          x: 2,
          y: 2,
        }),
      );
      setTarget({ kind: 'sprite', id });
    } else if (k === 'item') {
      const id = nextId(new Set(st.game.items.map((t) => t.id)));
      st.mutateGame((g) =>
        g.items.push({
          id,
          name: 'item ' + id,
          frames: [blankFrame()],
          sprPal: 0,
        }),
      );
      setTarget({ kind: 'item', id });
    }
  };

  const duplicateCurrent = () => {
    const st = useGameStore.getState();
    const t = st.drawTarget;
    if (t.kind === 'avatar') return;
    st.snapshot();
    const copyName = (n: string) => n + ' copy';
    let newId = '?';
    st.mutateGame((g) => {
      if (t.kind === 'tile') {
        const src = g.tiles.find((x) => x.id === t.id);
        if (!src) return;
        newId = nextId(new Set(g.tiles.map((x) => x.id)));
        g.tiles.push({
          ...src,
          id: newId,
          name: copyName(src.name),
          frames: src.frames.map((f) => [...f]),
        });
      } else if (t.kind === 'sprite') {
        const src = g.sprites.find((x) => x.id === t.id);
        if (!src) return;
        newId = nextId(new Set(g.sprites.map((x) => x.id)));
        g.sprites.push({
          ...src,
          id: newId,
          name: copyName(src.name),
          frames: src.frames.map((f) => [...f]),
          x: Math.min(15, src.x + 1),
        });
      } else {
        const src = g.items.find((x) => x.id === t.id);
        if (!src) return;
        newId = nextId(new Set(g.items.map((x) => x.id)));
        g.items.push({
          ...src,
          id: newId,
          name: copyName(src.name),
          frames: src.frames.map((f) => [...f]),
        });
      }
    });
    if (newId !== '?') setTarget({ kind: t.kind, id: newId });
  };

  const deleteCurrent = () => {
    const st = useGameStore.getState();
    const t = st.drawTarget;
    if (t.kind === 'avatar') return;
    st.snapshot();
    st.mutateGame((g) => {
      if (t.kind === 'tile') {
        g.tiles = g.tiles.filter((x) => x.id !== t.id);
        for (const r of g.rooms)
          r.tiles = r.tiles.map((c) => (c === t.id ? '0' : c));
      } else if (t.kind === 'sprite') {
        g.sprites = g.sprites.filter((x) => x.id !== t.id);
      } else {
        g.items = g.items.filter((x) => x.id !== t.id);
        for (const r of g.rooms)
          r.items = r.items.filter((ip) => ip.itemId !== t.id);
      }
    });
    const g2 = useGameStore.getState().game;
    if (g2.tiles[0]) setTarget({ kind: 'tile', id: g2.tiles[0].id });
    else if (g2.sprites[0]) setTarget({ kind: 'sprite', id: g2.sprites[0].id });
    else if (g2.items[0]) setTarget({ kind: 'item', id: g2.items[0].id });
  };

  const dlgIds = Object.keys(game.dialogs);

  return (
    <div className='panel w-drawables'>
      <header>
        paint · {kind}
        {drawable && kind !== 'avatar' ? ` ${drawable.id}` : ''}
        <span className='hint'>{drawable?.name ?? ''}</span>
      </header>
      <div className='body'>
        <div className='toolbar' data-tour='draw-tabs'>
          {KINDS.map((k) => (
            <button
              key={k}
              className={kind === k ? 'on small' : 'small'}
              onClick={() => {
                if (k === 'tile' && game.tiles[0])
                  setTarget({ kind: 'tile', id: game.tiles[0].id });
                else if (k === 'sprite' && game.sprites[0])
                  setTarget({ kind: 'sprite', id: game.sprites[0].id });
                else if (k === 'item' && game.items[0])
                  setTarget({ kind: 'item', id: game.items[0].id });
                else addOf(k);
              }}
            >
              {k}
            </button>
          ))}
        </div>

        {isTile && (
          <div
            className='field-row'
            title='BG sub-palette used to preview and paint this tile'
          >
            <label>sub-pal</label>
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

        {!isTile && sprDef && (
          <div
            className='field-row'
            title='sprite sub-palette (3 colours + shared transparent)'
          >
            <label>sub-pal</label>
            {([0, 1, 2, 3] as SubPal[]).map((p) => {
              const cols = sprColors(pal, p); // [transparent, c1, c2, c3]
              return (
                <span className='subpal-wrap' key={p}>
                  <button
                    className={sprDef.sprPal === p ? 'on small' : 'small'}
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
        )}

        {kind !== 'avatar' && (
          <div className='catalog'>
            {(kind === 'tile'
              ? game.tiles
              : kind === 'sprite'
                ? game.sprites
                : game.items
            ).map((d) => (
              <Thumb
                key={d.id}
                frames={d.frames}
                colors={
                  kind === 'tile'
                    ? bgColors(pal, s.paintSubPal)
                    : sprColors(pal, (d as { sprPal: SubPal }).sprPal)
                }
                selected={
                  s.drawTarget.kind !== 'avatar' && s.drawTarget.id === d.id
                }
                onClick={() => setTarget({ kind, id: d.id } as DrawTarget)}
                title={`${d.id} ${d.name}`}
              />
            ))}
            <button
              className='small'
              onClick={() => addOf(kind)}
              title={`add ${kind}`}
            >
              +
            </button>
            <button
              className='small'
              onClick={() => setSheetOpen(true)}
              title={`import a spritesheet and pick cells to add as ${kind}s`}
            >
              ⬆ sheet
            </button>
          </div>
        )}

        {sheetOpen && kind !== 'avatar' && (
          <SpriteSheetImport kind={kind} onClose={() => setSheetOpen(false)} />
        )}

        {drawable && frame && (
          <>
            <div className='pixel-editor-row'>
              <div className='swatches'>
                {([0, 1, 2, 3] as Pixel[]).map((c) => (
                  <div
                    key={c}
                    className={
                      (s.drawColor === c ? 'swatch selected' : 'swatch') +
                      (c === 0 && !isTile ? ' transparent' : '')
                    }
                    style={
                      c === 0 && !isTile
                        ? {}
                        : { background: colors[c] ?? '#000' }
                    }
                    onClick={() => useGameStore.setState({ drawColor: c })}
                    title={
                      c === 0
                        ? isTile
                          ? 'backdrop'
                          : 'transparent'
                        : `color ${c}`
                    }
                  />
                ))}
              </div>
              <canvas
                ref={canvasRef}
                width={224}
                height={224}
                style={{
                  cursor: 'crosshair',
                  border: '1px solid var(--line-bright)',
                }}
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
                  }}
                />
                <div className='field-row'>
                  <label>frame</label>
                  {[0, 1].map((f) => (
                    <button
                      key={f}
                      className={s.curFrame === f ? 'on small' : 'small'}
                      disabled={f === 1 && (frames?.length ?? 1) < 2}
                      onClick={() =>
                        useGameStore.setState({ curFrame: f as 0 | 1 })
                      }
                    >
                      {f + 1}
                    </button>
                  ))}
                  {(frames?.length ?? 1) < 2 ? (
                    <button
                      className='small'
                      onClick={() => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const fs = targetFrames(g, st.drawTarget);
                          if (fs) ensureFrame2(fs);
                        });
                        useGameStore.setState({ curFrame: 1 });
                      }}
                    >
                      + anim
                    </button>
                  ) : (
                    <button
                      className='small'
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: 'Remove animation frame',
                          message:
                            'Delete the second frame of this drawable? The pixels in frame 2 are lost (Undo can restore them).',
                          confirmLabel: 'Remove frame',
                          danger: true,
                        });
                        if (!ok) return;
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const fs = targetFrames(g, st.drawTarget);
                          if (fs && fs.length > 1) fs.pop();
                        });
                        useGameStore.setState({ curFrame: 0 });
                      }}
                    >
                      - anim
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className='field-row'>
              <label>name</label>
              <input
                type='text'
                value={drawable.name}
                onChange={(e) => {
                  const v = e.target.value;
                  const st = useGameStore.getState();
                  st.mutateGame((g) => {
                    const t = st.drawTarget;
                    const d =
                      t.kind === 'avatar'
                        ? g.avatar
                        : t.kind === 'tile'
                          ? g.tiles.find((x) => x.id === t.id)
                          : t.kind === 'sprite'
                            ? g.sprites.find((x) => x.id === t.id)
                            : g.items.find((x) => x.id === t.id);
                    if (d) d.name = v;
                  });
                }}
              />
              {isTile && tileDef && (
                <>
                  <label>wall</label>
                  <input
                    type='checkbox'
                    checked={tileDef.wall}
                    onChange={(e) => {
                      const v = e.target.checked;
                      const st = useGameStore.getState();
                      st.snapshot();
                      st.mutateGame((g) => {
                        const t = g.tiles.find(
                          (x) => x.id === (st.drawTarget as { id: string }).id,
                        );
                        if (t) t.wall = v;
                      });
                    }}
                  />
                </>
              )}
              {(kind === 'sprite' || kind === 'item') && sprDef && (
                <>
                  <label>dialog</label>
                  <select
                    value={sprDef.dlgId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value || undefined;
                      const st = useGameStore.getState();
                      st.mutateGame((g) => {
                        const t = st.drawTarget;
                        const d =
                          t.kind === 'sprite'
                            ? g.sprites.find((x) => x.id === t.id)
                            : g.items.find(
                                (x) => x.id === (t as { id: string }).id,
                              );
                        if (d) d.dlgId = v;
                      });
                    }}
                  >
                    <option value=''>(none)</option>
                    {dlgIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {kind !== 'avatar' && (
                <>
                  <button
                    className='small'
                    onClick={duplicateCurrent}
                    title={`duplicate ${kind}`}
                    style={{ marginLeft: 'auto' }}
                  >
                    duplicate
                  </button>
                  <button className='small' onClick={deleteCurrent}>
                    delete
                  </button>
                </>
              )}
            </div>

            {(kind === 'sprite' || kind === 'item') &&
              sprDef &&
              game.items.length > 0 && (
                <div
                  className='field-row'
                  title='conditional dialog: shown instead of the base dialog when the player holds (or lacks) an item'
                >
                  <label>alt dialog</label>
                  <select
                    value={sprDef.altDlgId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value || undefined;
                      useGameStore.getState().snapshot();
                      mutateCurrent((d) => {
                        d.altDlgId = v;
                        if (v && !d.altCond)
                          d.altCond = {
                            kind: 'item',
                            itemId: game.items[0]!.id,
                            negate: false,
                          };
                        if (!v) d.altCond = undefined;
                      });
                    }}
                  >
                    <option value=''>(none)</option>
                    {dlgIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                  {sprDef.altDlgId && sprDef.altCond && (
                    <>
                      <label>when</label>
                      <CondEditor
                        game={game}
                        cond={sprDef.altCond}
                        noneLabel='(pick)'
                        onChange={(cond) => {
                          if (!cond) return;
                          mutateCurrent((d) => {
                            d.altCond = cond;
                          });
                        }}
                      />
                    </>
                  )}
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
