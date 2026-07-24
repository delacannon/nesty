import { useState } from 'react';
import { FORBIDDEN_COLOR, NES_PALETTE_RGB } from '@nesty/core';
import { paletteFor, rgb } from '../draw';
import { currentRoom, nextId, useGameStore } from '../store/gameStore';

type Slot =
  | { kind: 'bkg' }
  | { kind: 'bg'; sub: number; idx: number }
  | { kind: 'spr'; sub: number; idx: number };

export function PalettePanel() {
  const s = useGameStore();
  const game = s.game;
  const room = currentRoom(s);
  const pal = paletteFor(game, room);
  const [slot, setSlot] = useState<Slot>({ kind: 'bkg' });

  const setColor = (c: number) => {
    if (c === FORBIDDEN_COLOR) return;
    const st = useGameStore.getState();
    st.snapshot();
    st.mutateGame((g) => {
      const p = g.palettes.find((pp) => pp.id === pal.id)!;
      if (slot.kind === 'bkg') p.backdrop = c;
      else if (slot.kind === 'bg') p.bg[slot.sub]![slot.idx] = c;
      else p.spr[slot.sub]![slot.idx] = c;
    });
  };

  const slotSel = (a: Slot, b: Slot) => JSON.stringify(a) === JSON.stringify(b);

  return (
    <div className='panel w-palette'>
      <header>
        palette {pal.id}
        <span className='hint'>pick a slot, then a NES color</span>
      </header>
      <div className='body'>
        <div className='field-row'>
          <label>set</label>
          <select
            value={pal.id}
            onChange={(e) => {
              const v = e.target.value;
              s.snapshot();
              s.mutateGame((g) => {
                g.rooms.find((r) => r.id === room.id)!.palId = v;
              });
            }}
          >
            {game.palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
          <button
            className='small'
            onClick={() => {
              const st = useGameStore.getState();
              st.snapshot();
              const id = nextId(
                new Set(st.game.palettes.map((p) => p.id)),
                false,
              );
              st.mutateGame((g) => {
                g.palettes.push({
                  ...JSON.parse(JSON.stringify(pal)),
                  id,
                  name: 'pal ' + id,
                });
                g.rooms.find((r) => r.id === room.id)!.palId = id;
              });
            }}
          >
            + set
          </button>
          <input
            type='text'
            value={pal.name}
            style={{ width: 110 }}
            onChange={(e) => {
              const v = e.target.value;
              s.mutateGame((g) => {
                g.palettes.find((pp) => pp.id === pal.id)!.name = v;
              });
            }}
          />
        </div>

        <div className='pal-slots'>
          <div className='pal-slot-row'>
            <span className='tag'>BKG</span>
            <div
              className={
                slotSel(slot, { kind: 'bkg' })
                  ? 'pal-slot selected'
                  : 'pal-slot'
              }
              style={{ background: rgb(pal.backdrop) }}
              onClick={() => setSlot({ kind: 'bkg' })}
              title='shared backdrop color'
            />
          </div>
          {pal.bg.map((t, sub) => (
            <div className='pal-slot-row' key={'bg' + sub}>
              <span className='tag'>BG{sub}</span>
              {t.map((c, idx) => (
                <div
                  key={idx}
                  className={
                    slotSel(slot, { kind: 'bg', sub, idx })
                      ? 'pal-slot selected'
                      : 'pal-slot'
                  }
                  style={{ background: rgb(c) }}
                  onClick={() => setSlot({ kind: 'bg', sub, idx })}
                />
              ))}
            </div>
          ))}
          {pal.spr.map((t, sub) => (
            <div className='pal-slot-row' key={'sp' + sub}>
              <span className='tag'>SP{sub}</span>
              {t.map((c, idx) => (
                <div
                  key={idx}
                  className={
                    slotSel(slot, { kind: 'spr', sub, idx })
                      ? 'pal-slot selected'
                      : 'pal-slot'
                  }
                  style={{ background: rgb(c) }}
                  onClick={() => setSlot({ kind: 'spr', sub, idx })}
                />
              ))}
            </div>
          ))}
        </div>

        <div className='nes-master'>
          {NES_PALETTE_RGB.map((hexColor, i) => (
            <div
              key={i}
              className={i === FORBIDDEN_COLOR ? 'c disabled' : 'c'}
              style={{ background: hexColor }}
              title={'$' + i.toString(16).padStart(2, '0').toUpperCase()}
              onClick={() => setColor(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
