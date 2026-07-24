import { useEffect, useState } from 'react';
import { CondEditor, CondPicker } from '../components/CondPicker';
import { paletteFor } from '../draw';
import { EventsPanel } from '../panels/EventsPanel';
import { LogicPanel } from '../panels/LogicPanel';
import { currentRoom, useGameStore, type SelEntity } from '../store/gameStore';

type Tab = 'room' | 'events' | 'logic';

const rowSel = (sel: SelEntity | null, kind: string, idx: number) =>
  !!sel && sel.kind === kind && 'idx' in sel && sel.idx === idx;

export function RoomProps() {
  const s = useGameStore();
  const game = s.game;
  const room = currentRoom(s);
  const pal = paletteFor(game, room);
  const [tab, setTab] = useState<Tab>('room');

  // follow the navigator/canvas selection: events open the events tab,
  // every other placed entity lives under the room tab
  useEffect(() => {
    const k = s.selEntity?.kind;
    if (k === 'event') setTab('events');
    else if (k) setTab('room');
  }, [s.selEntity]);

  return (
    <div className='inspector'>
      <div className='insp-head'>
        Room {room.id}
        {room.name && room.name !== 'room ' + room.id ? ` · ${room.name}` : ''}
      </div>
      <div className='insp-tabs'>
        {(['room', 'events', 'logic'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'room' && (
        <>
          <div className='insp-section'>
            <div className='sec-title'>Properties</div>
            <div className='field-row'>
              <label>name</label>
              <input
                type='text'
                value={room.name}
                style={{ flex: 1 }}
                placeholder={'room ' + room.id}
                onChange={(e) => {
                  const v = e.target.value;
                  s.mutateGame((g) => {
                    g.rooms.find((r) => r.id === room.id)!.name = v;
                  });
                }}
              />
            </div>
            <div className='field-row'>
              <label>palette</label>
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
            </div>
            <div className='field-row'>
              <label>music ♪</label>
              <select
                title='song that loops in this room'
                value={room.songId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || undefined;
                  s.snapshot();
                  s.mutateGame((g) => {
                    const r2 = g.rooms.find((r) => r.id === room.id)!;
                    if (v) r2.songId = v;
                    else delete r2.songId;
                  });
                }}
              >
                <option value=''>(none)</option>
                {game.songs.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.id} {sg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(room.exits.length > 0 ||
            room.endings.length > 0 ||
            room.overlays.length > 0 ||
            room.items.length > 0) && (
            <div className='insp-section'>
              <div className='sec-title'>Entities</div>
              <div className='exit-list'>
                {room.exits.map((ex, i) => (
                  <div className={rowSel(s.selEntity, 'exit', i) ? 'exit-row sel' : 'exit-row'} key={'x' + i}>
                    <span>
                      E ({ex.x},{ex.y}) <span className='arrow'>→</span> room {ex.destRoom} ({ex.destX},{ex.destY})
                    </span>
                    <CondPicker
                      game={game}
                      req={ex.req}
                      lockedDlgId={ex.lockedDlgId}
                      onChange={(req, lockedDlgId) => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const e2 = g.rooms.find((rr) => rr.id === room.id)!.exits[i]!;
                          e2.req = req;
                          e2.lockedDlgId = lockedDlgId;
                        });
                      }}
                    />
                    <button
                      className='small'
                      title='jump to destination room'
                      onClick={() =>
                        useGameStore.setState({ curRoomId: ex.destRoom, pendingExit: null })
                      }
                    >
                      go
                    </button>
                    <button
                      className='small'
                      title='delete exit'
                      onClick={() => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const r = g.rooms.find((rr) => rr.id === room.id)!;
                          r.exits = r.exits.filter((_, j) => j !== i);
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {room.endings.map((en, i) => (
                  <div className={rowSel(s.selEntity, 'ending', i) ? 'exit-row sel' : 'exit-row'} key={'e' + i}>
                    <span>
                      X ({en.x},{en.y}) <span className='arrow'>→</span> ending dlg {en.dlgId}
                    </span>
                    <CondPicker
                      game={game}
                      req={en.req}
                      lockedDlgId={en.lockedDlgId}
                      onChange={(req, lockedDlgId) => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const e2 = g.rooms.find((rr) => rr.id === room.id)!.endings[i]!;
                          e2.req = req;
                          e2.lockedDlgId = lockedDlgId;
                        });
                      }}
                    />
                    <button
                      className='small'
                      title='delete ending'
                      onClick={() => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const r = g.rooms.find((rr) => rr.id === room.id)!;
                          r.endings = r.endings.filter((_, j) => j !== i);
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {room.overlays.map((ov, i) => (
                  <div className={rowSel(s.selEntity, 'overlay', i) ? 'exit-row sel' : 'exit-row'} key={'o' + i}>
                    <span>
                      O ({ov.x},{ov.y}) {ov.kind ?? 'tile'} {ov.tileId} <span className='arrow'>when</span>
                    </span>
                    <CondEditor
                      game={game}
                      cond={ov.cond}
                      noneLabel='(pick)'
                      onChange={(cond) => {
                        if (!cond) return;
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const o2 = g.rooms.find((rr) => rr.id === room.id)!.overlays[i];
                          if (o2) o2.cond = cond;
                        });
                      }}
                    />
                    <button
                      className='small'
                      title='delete overlay'
                      onClick={() => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const r = g.rooms.find((rr) => rr.id === room.id)!;
                          r.overlays = r.overlays.filter((_, j) => j !== i);
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {room.items.map((ip, i) => (
                  <div className={rowSel(s.selEntity, 'item', i) ? 'exit-row sel' : 'exit-row'} key={'i' + i}>
                    <span>
                      I ({ip.x},{ip.y}) item {ip.itemId} <span className='arrow'>appears</span>
                    </span>
                    <CondEditor
                      game={game}
                      cond={ip.appearCond}
                      onChange={(cond) => {
                        const st = useGameStore.getState();
                        st.snapshot();
                        st.mutateGame((g) => {
                          const i2 = g.rooms.find((rr) => rr.id === room.id)!.items[i];
                          if (!i2) return;
                          if (cond) i2.appearCond = cond;
                          else delete i2.appearCond;
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'events' && <EventsPanel />}
      {tab === 'logic' && <LogicPanel />}
    </div>
  );
}
