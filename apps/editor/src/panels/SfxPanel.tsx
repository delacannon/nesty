import { useState } from 'react';
import type { SfxName, SfxNote } from '@nesty/core';
import { defaultSfxSet, SFX_NAMES } from '@nesty/core';
import { useGameStore } from '../store/gameStore';

let audioCtx: AudioContext | null = null;

/** Browser preview approximating the NES pulse channel (square wave). */
function previewSfx(notes: SfxNote[]) {
  audioCtx ??= new AudioContext();
  const ctx = audioCtx;
  void ctx.resume();
  let t = ctx.currentTime + 0.02;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = n.freq;
    gain.gain.value = (n.vol / 15) * 0.15;
    osc.connect(gain).connect(ctx.destination);
    const dur = n.frames / 60;
    osc.start(t);
    osc.stop(t + dur);
    t += dur;
  }
}

const isBuiltin = (id: string) => (SFX_NAMES as readonly string[]).includes(id);

function nextCustomId(taken: string[]): string {
  for (let i = 1; ; i++) {
    const id = `sfx${i}`;
    if (!taken.includes(id)) return id;
  }
}

export function SfxPanel() {
  const s = useGameStore();
  const custom = s.game.customSfx;
  const [cur, setCur] = useState<string>('walk');

  const clip = custom.find((c) => c.id === cur);
  const builtin = isBuiltin(cur);
  const notes = builtin ? (s.game.sfx[cur as SfxName] ?? []) : (clip?.notes ?? []);

  const update = (fn: (notes: SfxNote[]) => SfxNote[]) => {
    useGameStore.getState().mutateGame((g) => {
      if (isBuiltin(cur)) g.sfx[cur as SfxName] = fn(g.sfx[cur as SfxName] ?? []);
      else {
        const c = g.customSfx.find((x) => x.id === cur);
        if (c) c.notes = fn(c.notes);
      }
    });
  };

  const num = (v: string, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Number(v) || lo));

  const addCustom = () => {
    useGameStore.getState().snapshot();
    const id = nextCustomId([
      ...custom.map((c) => c.id),
      ...(SFX_NAMES as readonly string[]),
    ]);
    useGameStore.getState().mutateGame((g) => {
      g.customSfx.push({
        id,
        name: id,
        notes: [{ freq: 440, frames: 4, vol: 6, duty: 2 }],
      });
    });
    setCur(id);
  };

  const deleteCustom = () => {
    useGameStore.getState().snapshot();
    useGameStore.getState().mutateGame((g) => {
      g.customSfx = g.customSfx.filter((c) => c.id !== cur);
      // dangling playSfx actions -> fall back to the 'walk' builtin
      for (const r of g.rooms)
        for (const ev of r.events)
          for (const a of ev.actions)
            if (a.type === 'playSfx' && a.sfxId === cur) a.sfxId = 'walk';
    });
    setCur('walk');
  };

  const label = builtin ? cur : (clip?.name ?? cur);

  return (
    <div className='panel w-sfx'>
      <header>
        sound · {label}
        <span className='hint'>
          APU pulse notes: freq / frames / vol / duty
        </span>
      </header>
      <div className='body'>
        <div className='toolbar'>
          {SFX_NAMES.map((name) => (
            <button
              key={name}
              className={cur === name ? 'on small' : 'small'}
              onClick={() => setCur(name)}
              title={
                name === 'type'
                  ? 'typewriter per-character blip (enable it in the text panel)'
                  : `builtin ‘${name}’ sound`
              }
            >
              {name}
            </button>
          ))}
        </div>
        <div className='toolbar'>
          {custom.map((c) => (
            <button
              key={c.id}
              className={cur === c.id ? 'on small' : 'small'}
              onClick={() => setCur(c.id)}
              title={`custom sound (id ${c.id}) — trigger via events/logic`}
            >
              {c.name || c.id}
            </button>
          ))}
          <button className='small' onClick={addCustom} title='create a custom sound'>
            + custom
          </button>
        </div>

        {!builtin && clip && (
          <div className='field-row'>
            <label>name</label>
            <input
              type='text'
              value={clip.name}
              onChange={(e) => {
                const v = e.target.value;
                useGameStore.getState().mutateGame((g) => {
                  const c = g.customSfx.find((x) => x.id === cur);
                  if (c) c.name = v;
                });
              }}
            />
            <button
              className='small'
              title='delete this custom sound'
              onClick={deleteCustom}
            >
              delete
            </button>
          </div>
        )}

        <div className='sfx-notes'>
          <div className='sfx-note sfx-head'>
            <span>hz</span>
            <span>frames</span>
            <span>vol</span>
            <span>duty</span>
            <span />
          </div>
          {notes.map((n, i) => (
            <div className='sfx-note' key={i}>
              <input
                type='number'
                min={30}
                max={4000}
                value={n.freq}
                onChange={(e) => {
                  const v = num(e.target.value, 30, 4000);
                  update((ns) =>
                    ns.map((x, j) => (j === i ? { ...x, freq: v } : x)),
                  );
                }}
              />
              <input
                type='number'
                min={1}
                max={255}
                value={n.frames}
                onChange={(e) => {
                  const v = num(e.target.value, 1, 255);
                  update((ns) =>
                    ns.map((x, j) => (j === i ? { ...x, frames: v } : x)),
                  );
                }}
              />
              <input
                type='number'
                min={0}
                max={15}
                value={n.vol}
                onChange={(e) => {
                  const v = num(e.target.value, 0, 15);
                  update((ns) =>
                    ns.map((x, j) => (j === i ? { ...x, vol: v } : x)),
                  );
                }}
              />
              <select
                value={n.duty}
                onChange={(e) => {
                  const v = (Number(e.target.value) & 3) as SfxNote['duty'];
                  update((ns) =>
                    ns.map((x, j) => (j === i ? { ...x, duty: v } : x)),
                  );
                }}
              >
                <option value={0}>12%</option>
                <option value={1}>25%</option>
                <option value={2}>50%</option>
                <option value={3}>75%</option>
              </select>
              <button
                className='small'
                title='delete note'
                onClick={() => {
                  useGameStore.getState().snapshot();
                  update((ns) => ns.filter((_, j) => j !== i));
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className='toolbar'>
          <button
            className='small'
            onClick={() => {
              useGameStore.getState().snapshot();
              update((ns) =>
                ns.length >= 16
                  ? ns
                  : [
                      ...ns,
                      { freq: 440, frames: 4, vol: 6, duty: 2 } as SfxNote,
                    ],
              );
            }}
          >
            + note
          </button>
          {builtin && (
            <button
              className='small'
              onClick={() => {
                useGameStore.getState().snapshot();
                update(() => defaultSfxSet()[cur as SfxName]);
              }}
            >
              reset
            </button>
          )}
          <button
            className='small primary'
            style={{ marginLeft: 'auto' }}
            onClick={() => previewSfx(notes)}
          >
            ▶ preview
          </button>
        </div>
      </div>
    </div>
  );
}
