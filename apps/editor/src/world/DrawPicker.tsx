import { useEffect, useRef, useState } from 'react';
import type { Frame16, SubPal } from '@nesty/core';
import { blankFrame } from '@nesty/core';
import { bgColors, drawFrame, paletteFor, sprColors } from '../draw';
import {
  currentRoom,
  nextId,
  useGameStore,
  type DrawTarget,
} from '../store/gameStore';
import { useUiStore } from '../store/uiStore';

const KINDS = ['tile', 'sprite', 'item', 'avatar'] as const;
type Kind = (typeof KINDS)[number];
const LABEL: Record<Kind, string> = {
  tile: 'tiles',
  sprite: 'sprites',
  item: 'items',
  avatar: 'avatar',
};

function Thumb({
  frames,
  colors,
  selected,
  onClick,
  onDoubleClick,
  title,
}: {
  frames: Frame16[];
  colors: (string | null)[];
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
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
      onDoubleClick={onDoubleClick}
      title={title}
    />
  );
}

/** Left-rail drawables picker for the World view: pick tiles / sprites /
 *  items / the avatar without switching to the Sprites view. Selecting one
 *  sets the draw target (and the matching room tool). */
export function DrawPicker() {
  const s = useGameStore();
  const game = s.game;
  const room = currentRoom(s);
  const pal = paletteFor(game, room);
  const [tab, setTab] = useState<Kind>(
    s.drawTarget.kind === 'avatar' ? 'avatar' : s.drawTarget.kind,
  );

  // follow the active tool/target so e.g. picking the Spr tool shows sprites
  useEffect(() => {
    setTab(s.drawTarget.kind);
  }, [s.drawTarget.kind]);

  const setTarget = (t: DrawTarget) => useGameStore.getState().setDrawTarget(t);

  // current drawable + its sprite sub-palette (for the sprite/item/avatar tabs)
  const dt = s.drawTarget;
  const curDrawable =
    dt.kind === 'avatar'
      ? game.avatar
      : dt.kind === 'sprite'
        ? game.sprites.find((x) => x.id === dt.id)
        : dt.kind === 'item'
          ? game.items.find((x) => x.id === dt.id)
          : undefined;
  const curSprPal = (curDrawable?.sprPal ?? 0) as SubPal;

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

  const addOf = (k: Exclude<Kind, 'avatar'>) => {
    const st = useGameStore.getState();
    st.snapshot();
    if (k === 'tile') {
      const id = nextId(new Set(st.game.tiles.map((t) => t.id)));
      st.mutateGame((g) =>
        g.tiles.push({ id, name: 'tile ' + id, wall: false, frames: [blankFrame()] }),
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
    } else {
      const id = nextId(new Set(st.game.items.map((t) => t.id)));
      st.mutateGame((g) =>
        g.items.push({ id, name: 'item ' + id, frames: [blankFrame()], sprPal: 0 }),
      );
      setTarget({ kind: 'item', id });
    }
  };

  const list =
    tab === 'tile'
      ? game.tiles
      : tab === 'sprite'
        ? game.sprites
        : tab === 'item'
          ? game.items
          : [game.avatar];

  return (
    <>
      <div className='rail-section-head'>Paint</div>
      <div className='draw-picker' data-tour='draw-picker'>
        <div className='dp-tabs'>
          {KINDS.map((k) => (
            <button
              key={k}
              className={tab === k ? 'on small' : 'small'}
              onClick={() => {
                setTab(k);
                if (k === 'avatar') setTarget({ kind: 'avatar' });
                else if (k === 'tile' && game.tiles[0])
                  setTarget({ kind: 'tile', id: game.tiles[0].id });
                else if (k === 'sprite' && game.sprites[0])
                  setTarget({ kind: 'sprite', id: game.sprites[0].id });
                else if (k === 'item' && game.items[0])
                  setTarget({ kind: 'item', id: game.items[0].id });
              }}
              title={LABEL[k]}
            >
              {k === 'sprite' ? 'spr' : k}
            </button>
          ))}
        </div>
        {tab === 'tile' && (
          <div
            className='dp-subpal'
            title='tiles paint with this BG sub-palette (also sets the cell colour)'
          >
            <label>pal</label>
            {([0, 1, 2, 3] as SubPal[]).map((p) => {
              const cols = bgColors(pal, p); // [backdrop, c1, c2, c3]
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
        {tab !== 'tile' && curDrawable && (
          <div
            className='dp-subpal'
            title='sprite sub-palette for the selected drawable'
          >
            <label>pal</label>
            {([0, 1, 2, 3] as SubPal[]).map((p) => {
              const cols = sprColors(pal, p);
              return (
                <span className='subpal-wrap' key={p}>
                  <button
                    className={curSprPal === p ? 'on small' : 'small'}
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
        <div className='catalog dp-grid'>
          {list.map((d) => (
            <Thumb
              key={d.id}
              frames={d.frames}
              colors={
                tab === 'tile'
                  ? bgColors(pal, s.paintSubPal)
                  : sprColors(pal, (d as { sprPal: SubPal }).sprPal)
              }
              selected={
                s.drawTarget.kind === tab &&
                (tab === 'avatar' ||
                  (s.drawTarget.kind !== 'avatar' && s.drawTarget.id === d.id))
              }
              onClick={() =>
                setTarget(
                  tab === 'avatar'
                    ? { kind: 'avatar' }
                    : ({ kind: tab, id: d.id } as DrawTarget),
                )
              }
              onDoubleClick={() => {
                setTarget(
                  tab === 'avatar'
                    ? { kind: 'avatar' }
                    : ({ kind: tab, id: d.id } as DrawTarget),
                );
                useUiStore.getState().setView(tab === 'avatar' ? 'avatar' : 'draw');
              }}
              title={`${d.id} ${d.name} — double-click to edit`}
            />
          ))}
          {tab !== 'avatar' && (
            <button
              className='small dp-add'
              onClick={() => addOf(tab)}
              title={`add ${tab}`}
            >
              +
            </button>
          )}
        </div>
      </div>
    </>
  );
}
