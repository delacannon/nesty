import { addRoom, useGameStore, type SelEntity } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';

const BADGE = {
  sprite: { c: '#f8b800', t: 'S' },
  item: { c: '#58d854', t: 'I' },
  exit: { c: '#3cbcfc', t: 'E' },
  ending: { c: '#e7005a', t: 'X' },
  event: { c: '#b53cfc', t: 'V' },
} as const;

/** Left-rail navigator tree: rooms → their placed entities. */
export function RoomNavigator() {
  const s = useGameStore();
  const game = s.game;

  const select = (roomId: string, sel: SelEntity) =>
    useGameStore.setState({ curRoomId: roomId, selEntity: sel });

  // double-click a sprite/item → open the Sprites view with it selected
  const openInSprites = (t: { kind: 'sprite' | 'item'; id: string }) => {
    useGameStore.getState().setDrawTarget(t);
    useUiStore.getState().setView('draw');
  };

  const isSel = (roomId: string, sel: SelEntity) => {
    if (roomId !== s.curRoomId || !s.selEntity) return false;
    const a = s.selEntity;
    if (a.kind !== sel.kind) return false;
    if (a.kind === 'sprite' && sel.kind === 'sprite') return a.id === sel.id;
    if ('idx' in a && 'idx' in sel) return a.idx === sel.idx;
    return false;
  };

  return (
    <>
      <div className='rail-section-head'>Rooms</div>
      <div className='nav-tree' data-tour='room-strip'>
        {game.rooms.map((r) => {
          const current = r.id === s.curRoomId;
          const sprites = game.sprites.filter((sp) => sp.room === r.id);
          return (
            <div key={r.id} className={current ? 'nav-room current' : 'nav-room'}>
              <div
                className='nav-room-head'
                onClick={() =>
                  useGameStore.setState({ curRoomId: r.id, selEntity: { kind: 'room' } })
                }
                title={r.name}
              >
                <span className='caret'>{current ? '▾' : '▸'}</span>
                <span>
                  {r.id}
                  {r.name && r.name !== 'room ' + r.id ? ` · ${r.name}` : ''}
                </span>
                {game.startRoom === r.id && (
                  <span style={{ marginLeft: 'auto', fontSize: 10 }} title='start room'>
                    ★
                  </span>
                )}
              </div>
              {current && (
                <div className='nav-children'>
                  {sprites.map((sp) => (
                    <Entity
                      key={'s' + sp.id}
                      badge='sprite'
                      label={`${sp.id} ${sp.name}`}
                      sel={isSel(r.id, { kind: 'sprite', id: sp.id })}
                      onClick={() => select(r.id, { kind: 'sprite', id: sp.id })}
                      onDoubleClick={() => openInSprites({ kind: 'sprite', id: sp.id })}
                      hint='double-click to edit in the Sprites view'
                    />
                  ))}
                  {r.items.map((ip, i) => (
                    <Entity
                      key={'i' + i}
                      badge='item'
                      label={`item ${ip.itemId} @(${ip.x},${ip.y})`}
                      sel={isSel(r.id, { kind: 'item', idx: i })}
                      onClick={() => select(r.id, { kind: 'item', idx: i })}
                      onDoubleClick={() => openInSprites({ kind: 'item', id: ip.itemId })}
                      hint='double-click to edit in the Sprites view'
                    />
                  ))}
                  {r.exits.map((ex, i) => (
                    <Entity
                      key={'e' + i}
                      badge='exit'
                      label={`exit → room ${ex.destRoom}`}
                      sel={isSel(r.id, { kind: 'exit', idx: i })}
                      onClick={() => select(r.id, { kind: 'exit', idx: i })}
                    />
                  ))}
                  {r.endings.map((en, i) => (
                    <Entity
                      key={'x' + i}
                      badge='ending'
                      label={`ending → dlg ${en.dlgId}`}
                      sel={isSel(r.id, { kind: 'ending', idx: i })}
                      onClick={() => select(r.id, { kind: 'ending', idx: i })}
                    />
                  ))}
                  {r.events.map((ev, i) => (
                    <Entity
                      key={'v' + i}
                      badge='event'
                      label={`event @(${ev.x},${ev.y})`}
                      sel={isSel(r.id, { kind: 'event', idx: i })}
                      onClick={() => select(r.id, { kind: 'event', idx: i })}
                    />
                  ))}
                  {sprites.length === 0 &&
                    r.items.length === 0 &&
                    r.exits.length === 0 &&
                    r.endings.length === 0 &&
                    r.events.length === 0 && (
                      <div className='nav-entity' style={{ opacity: 0.5 }}>
                        (empty)
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}
        <div className='nav-add'>
          <button className='small' onClick={addRoom} title='add room'>
            + room
          </button>
        </div>
      </div>
    </>
  );
}

function Entity({
  badge,
  label,
  sel,
  onClick,
  onDoubleClick,
  hint,
}: {
  badge: keyof typeof BADGE;
  label: string;
  sel: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  hint?: string;
}) {
  const b = BADGE[badge];
  return (
    <div
      className={sel ? 'nav-entity sel' : 'nav-entity'}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={hint ? `${label} — ${hint}` : label}
    >
      <span className='badge' style={{ background: b.c }}>
        {b.t}
      </span>
      <span
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {label}
      </span>
    </div>
  );
}
