import { useEffect, useRef } from 'react';
import type { Action, GameData } from '@nesty/core';
import { SFX_NAMES } from '@nesty/core';
import { CondEditor } from '../components/CondPicker';
import { currentRoom, nextId, useGameStore } from '../store/gameStore';

const ACTION_TYPES: { value: Action['type']; label: string }[] = [
  { value: 'setFlag', label: 'set flag' },
  { value: 'clearFlag', label: 'clear flag' },
  { value: 'toggleFlag', label: 'toggle flag' },
  { value: 'setVar', label: 'var =' },
  { value: 'addVar', label: 'var +' },
  { value: 'showDialog', label: 'dialog' },
  { value: 'spriteAnim', label: 'sprite anim' },
  { value: 'playSfx', label: 'play sfx' },
  { value: 'playSong', label: 'play music' },
];

function defaultAction(game: GameData, type: Action['type']): Action | null {
  switch (type) {
    case 'setFlag':
    case 'clearFlag':
    case 'toggleFlag':
      return game.flags[0] ? { type, flagId: game.flags[0].id } : null;
    case 'setVar':
      return game.variables[0]
        ? { type, varId: game.variables[0].id, value: 0 }
        : null;
    case 'addVar':
      return game.variables[0]
        ? { type, varId: game.variables[0].id, delta: 1 }
        : null;
    case 'showDialog': {
      const dlg = Object.keys(game.dialogs)[0];
      return dlg ? { type, dlgId: dlg } : null;
    }
    case 'spriteAnim':
      return game.sprites[0]
        ? { type, spriteId: game.sprites[0].id, mode: 'anim' }
        : null;
    case 'playSfx':
      return { type, sfxId: game.customSfx[0]?.id ?? SFX_NAMES[0] };
    case 'playSong':
      return { type, songId: game.songs[0]?.id };
  }
}

export function EventsPanel() {
  const s = useGameStore();
  const game = s.game;
  const room = currentRoom(s);
  const dlgIds = Object.keys(game.dialogs);

  // highlight + scroll to the event picked in the navigator/canvas
  const selEventIdx = s.selEntity?.kind === 'event' ? s.selEntity.idx : -1;
  const selRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selEventIdx >= 0)
      selRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selEventIdx, room.id]);

  const snapshotMutate = (fn: Parameters<typeof s.mutateGame>[0]) => {
    s.snapshot();
    s.mutateGame(fn);
  };

  const mutateEvent = (i: number, fn: (ev: GameData['rooms'][number]['events'][number]) => void) =>
    snapshotMutate((g) => {
      const ev = g.rooms.find((r) => r.id === room.id)?.events[i];
      if (ev) fn(ev);
    });

  const actionEditor = (evIdx: number, a: Action, aIdx: number) => (
    <div className='exit-row' key={aIdx} style={{ marginLeft: 16 }}>
      <select
        value={a.type}
        onChange={(e) => {
          const next = defaultAction(game, e.target.value as Action['type']);
          if (next) mutateEvent(evIdx, (ev) => (ev.actions[aIdx] = next));
        }}
      >
        {ACTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {(a.type === 'setFlag' || a.type === 'clearFlag' || a.type === 'toggleFlag') && (
        <select
          value={a.flagId}
          onChange={(e) =>
            mutateEvent(evIdx, (ev) => {
              const act = ev.actions[aIdx];
              if (act && 'flagId' in act) act.flagId = e.target.value;
            })
          }
        >
          {game.flags.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || f.id}
            </option>
          ))}
        </select>
      )}
      {(a.type === 'setVar' || a.type === 'addVar') && (
        <>
          <select
            value={a.varId}
            onChange={(e) =>
              mutateEvent(evIdx, (ev) => {
                const act = ev.actions[aIdx];
                if (act && 'varId' in act) act.varId = e.target.value;
              })
            }
          >
            {game.variables.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || v.id}
              </option>
            ))}
          </select>
          <input
            type='number'
            min={a.type === 'setVar' ? 0 : -128}
            max={a.type === 'setVar' ? 255 : 127}
            style={{ width: 52 }}
            value={a.type === 'setVar' ? a.value : a.delta}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value)) || 0;
              mutateEvent(evIdx, (ev) => {
                const act = ev.actions[aIdx];
                if (act?.type === 'setVar')
                  act.value = Math.max(0, Math.min(255, n));
                else if (act?.type === 'addVar')
                  act.delta = Math.max(-128, Math.min(127, n));
              });
            }}
          />
        </>
      )}
      {a.type === 'showDialog' && (
        <select
          value={a.dlgId}
          onChange={(e) =>
            mutateEvent(evIdx, (ev) => {
              const act = ev.actions[aIdx];
              if (act?.type === 'showDialog') act.dlgId = e.target.value;
            })
          }
        >
          {dlgIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}
      {a.type === 'spriteAnim' && (
        <>
          <select
            value={a.spriteId}
            onChange={(e) =>
              mutateEvent(evIdx, (ev) => {
                const act = ev.actions[aIdx];
                if (act?.type === 'spriteAnim') act.spriteId = e.target.value;
              })
            }
          >
            {game.sprites.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.id} {sp.name}
              </option>
            ))}
          </select>
          <select
            value={a.mode}
            onChange={(e) =>
              mutateEvent(evIdx, (ev) => {
                const act = ev.actions[aIdx];
                if (act?.type === 'spriteAnim')
                  act.mode = e.target.value as 'anim' | 'f0' | 'f1';
              })
            }
          >
            <option value='anim'>animate</option>
            <option value='f0'>hold frame 1</option>
            <option value='f1'>hold frame 2</option>
          </select>
        </>
      )}
      {a.type === 'playSfx' && (
        <select
          value={a.sfxId}
          onChange={(e) =>
            mutateEvent(evIdx, (ev) => {
              const act = ev.actions[aIdx];
              if (act?.type === 'playSfx') act.sfxId = e.target.value;
            })
          }
        >
          <optgroup label='builtin'>
            {SFX_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </optgroup>
          {game.customSfx.length > 0 && (
            <optgroup label='custom'>
              {game.customSfx.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      {a.type === 'playSong' && (
        <select
          value={a.songId ?? ''}
          onChange={(e) =>
            mutateEvent(evIdx, (ev) => {
              const act = ev.actions[aIdx];
              if (act?.type === 'playSong')
                act.songId = e.target.value === '' ? undefined : e.target.value;
            })
          }
        >
          <option value=''>— stop music —</option>
          {game.songs.map((sg) => (
            <option key={sg.id} value={sg.id}>
              {sg.name || sg.id}
            </option>
          ))}
        </select>
      )}
      <button
        className='small'
        title='delete action'
        onClick={() => mutateEvent(evIdx, (ev) => ev.actions.splice(aIdx, 1))}
      >
        ×
      </button>
    </div>
  );

  return (
    <div className='panel w-logic'>
      <header>
        events
        <span className='hint'>flags, variables & stepped-on triggers</span>
      </header>
      <div className='body'>
        <div className='keys'>
          <b>flags</b> — booleans set/cleared by events; conditions test them
        </div>
        {game.flags.map((f, i) => (
          <div className='exit-row' key={f.id}>
            <span>*{f.id}</span>
            <input
              type='text'
              value={f.name}
              placeholder='name'
              onChange={(e) => {
                const v = e.target.value;
                s.mutateGame((g) => {
                  g.flags[i]!.name = v;
                });
              }}
            />
            <button
              className='small'
              title='delete flag'
              onClick={() => snapshotMutate((g) => g.flags.splice(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <div className='toolbar'>
          <button
            className='small'
            disabled={game.flags.length >= 16}
            onClick={() =>
              snapshotMutate((g) => {
                const id = nextId(new Set(g.flags.map((f) => f.id)), false);
                g.flags.push({ id, name: 'flag ' + id });
              })
            }
          >
            + flag
          </button>
        </div>

        <div className='keys'>
          <b>variables</b> — numbers 0-255 with a start value
        </div>
        {game.variables.map((v, i) => (
          <div className='exit-row' key={v.id}>
            <span>${v.id}</span>
            <input
              type='text'
              value={v.name}
              placeholder='name'
              onChange={(e) => {
                const val = e.target.value;
                s.mutateGame((g) => {
                  g.variables[i]!.name = val;
                });
              }}
            />
            <label>start</label>
            <input
              type='number'
              min={0}
              max={255}
              style={{ width: 52 }}
              value={v.initial}
              onChange={(e) => {
                const n = Math.max(
                  0,
                  Math.min(255, Math.round(Number(e.target.value)) || 0),
                );
                s.mutateGame((g) => {
                  g.variables[i]!.initial = n;
                });
              }}
            />
            <button
              className='small'
              title='delete variable'
              onClick={() => snapshotMutate((g) => g.variables.splice(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <div className='toolbar'>
          <button
            className='small'
            disabled={game.variables.length >= 8}
            onClick={() =>
              snapshotMutate((g) => {
                const id = nextId(new Set(g.variables.map((v) => v.id)), false);
                g.variables.push({ id, name: 'var ' + id, initial: 0 });
              })
            }
          >
            + variable
          </button>
        </div>

        <div className='keys'>
          <b>events in room {room.id}</b> — place with the <b>evt</b> tool;
          they run their actions when the player steps on the cell
        </div>
        {room.events.length === 0 && (
          <div className='keys'>no events in this room yet</div>
        )}
        {room.events.map((ev, i) => (
          <div
            key={i}
            style={{ marginBottom: 8 }}
            ref={i === selEventIdx ? selRef : undefined}
          >
            <div className={i === selEventIdx ? 'exit-row sel' : 'exit-row'}>
              <span>
                V ({ev.x},{ev.y})
              </span>
              <label title='fires at most once per playthrough'>
                <input
                  type='checkbox'
                  checked={!!ev.once}
                  onChange={(e) =>
                    mutateEvent(i, (e2) => {
                      if (e.target.checked) e2.once = true;
                      else delete e2.once;
                    })
                  }
                />
                once
              </label>
              <CondEditor
                game={game}
                cond={ev.cond}
                onChange={(cond) =>
                  mutateEvent(i, (e2) => {
                    if (cond) e2.cond = cond;
                    else delete e2.cond;
                  })
                }
              />
              <button
                className='small'
                title='delete event'
                onClick={() =>
                  snapshotMutate((g) => {
                    const r = g.rooms.find((rr) => rr.id === room.id)!;
                    r.events.splice(i, 1);
                  })
                }
              >
                ×
              </button>
            </div>
            {ev.actions.map((a, ai) => actionEditor(i, a, ai))}
            <div className='toolbar' style={{ marginLeft: 16 }}>
              <button
                className='small'
                disabled={ev.actions.length >= 8}
                onClick={() => {
                  const next =
                    defaultAction(game, game.flags[0] ? 'setFlag' : 'showDialog') ??
                    defaultAction(game, 'showDialog');
                  if (next) mutateEvent(i, (e2) => e2.actions.push(next));
                }}
              >
                + action
              </button>
            </div>
          </div>
        ))}

        <div className='keys'>
          overlays (conditional tiles) are placed with the <b>ovl</b> tool and
          edited under the room canvas
        </div>
      </div>
    </div>
  );
}
