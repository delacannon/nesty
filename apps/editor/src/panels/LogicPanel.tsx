import type { Cond, ExitTransition } from '@nesty/core';
import { exitScrollDir } from '@nesty/core';
import { CondEditor, CondPicker } from '../components/CondPicker';
import { useGameStore } from '../store/gameStore';

/**
 * One place for every conditional in the game:
 * locked exits, gated endings, sprite/item alt dialogs.
 * Each kind of logic is laid out as its own aligned table so the columns
 * (where · target · transition · condition) line up instead of wrapping.
 */
export function LogicPanel() {
  const s = useGameStore();
  const game = s.game;
  const dlgIds = Object.keys(game.dialogs);

  // custom room name when set, else "room N"
  const roomLabel = (id: string) => {
    const r = game.rooms.find((x) => x.id === id);
    return r && r.name && r.name !== 'room ' + r.id ? r.name : `room ${id}`;
  };

  const snapshotMutate = (fn: Parameters<typeof s.mutateGame>[0]) => {
    s.snapshot();
    s.mutateGame(fn);
  };

  const viewBtn = (roomId: string, title?: string) => (
    <button
      className='small'
      title={title}
      onClick={() =>
        useGameStore.setState({ curRoomId: roomId, pendingExit: null })
      }
    >
      view
    </button>
  );

  const altRow = (
    kind: 'sprite' | 'item',
    d: { id: string; name: string; altCond?: Cond; altDlgId?: string },
  ) => (
    <tr key={kind + d.id}>
      <td>{kind === 'sprite' ? 'SPR' : 'ITM'}</td>
      <td>
        {d.id} <em style={{ color: 'var(--ink-dim)' }}>{d.name}</em>
      </td>
      <td>
        <select
          title='alt dialog shown when the condition is met'
          value={d.altDlgId ?? ''}
          onChange={(e) => {
            const v = e.target.value || undefined;
            snapshotMutate((g) => {
              const t =
                kind === 'sprite'
                  ? g.sprites.find((x) => x.id === d.id)
                  : g.items.find((x) => x.id === d.id);
              if (!t) return;
              t.altDlgId = v;
              if (v && !t.altCond) {
                if (g.items[0])
                  t.altCond = {
                    kind: 'item',
                    itemId: g.items[0].id,
                    negate: false,
                  };
                else if (g.flags[0])
                  t.altCond = {
                    kind: 'flag',
                    flagId: g.flags[0].id,
                    negate: false,
                  };
              }
              if (!v) t.altCond = undefined;
            });
          }}
        >
          <option value=''>alt: none</option>
          {dlgIds.map((id) => (
            <option key={id} value={id}>
              alt: {id}
            </option>
          ))}
        </select>
      </td>
      <td>
        {d.altDlgId && d.altCond && (
          <CondEditor
            game={game}
            cond={d.altCond}
            noneLabel='(pick)'
            onChange={(cond) => {
              if (!cond) return; // alt dialog always needs a condition
              snapshotMutate((g) => {
                const t =
                  kind === 'sprite'
                    ? g.sprites.find((x) => x.id === d.id)
                    : g.items.find((x) => x.id === d.id);
                if (t) t.altCond = cond;
              });
            }}
          />
        )}
      </td>
    </tr>
  );

  const exitRows = game.rooms.flatMap((room) =>
    room.exits.map((ex, i) => ({ room, ex, i })),
  );
  const endingRows = game.rooms.flatMap((room) =>
    room.endings.map((en, i) => ({ room, en, i })),
  );
  const eventRows = game.rooms.flatMap((room) =>
    room.events.map((ev, i) => ({ room, ev, i })),
  );
  const altSprites = game.sprites.filter((sp) => sp.altDlgId || sp.altCond);
  const altItems = game.items.filter((it) => it.altDlgId || it.altCond);

  const hasAny =
    exitRows.length ||
    endingRows.length ||
    eventRows.length ||
    game.sprites.length ||
    game.items.length;

  return (
    <div className='panel w-logic'>
      <header>
        logic
        <span className='hint'>conditions test items, counts, flags & vars</span>
      </header>
      <div className='body'>
        {game.items.length === 0 &&
          game.flags.length === 0 &&
          game.variables.length === 0 && (
            <div className='keys'>
              add an item, flag or variable first — conditions test what the
              player holds, counters, flags and variables
            </div>
          )}

        {exitRows.length > 0 && (
          <table className='logic-table'>
            <caption>exits</caption>
            <thead>
              <tr>
                <th>from</th>
                <th>to</th>
                <th>transition</th>
                <th>condition</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {exitRows.map(({ room, ex, i }) => (
                <tr key={`x${room.id}-${i}`}>
                  <td>
                    {roomLabel(room.id)} ({ex.x},{ex.y})
                  </td>
                  <td>
                    <span className='arrow'>→</span> {roomLabel(ex.destRoom)} (
                    {ex.destX},{ex.destY})
                  </td>
                  <td>
                    <select
                      title='room-change transition (scroll direction follows the exit edge)'
                      value={ex.transition ?? ''}
                      onChange={(e) => {
                        const v = (e.target.value || undefined) as
                          | ExitTransition
                          | undefined;
                        snapshotMutate((g) => {
                          const e2 = g.rooms.find((rr) => rr.id === room.id)!
                            .exits[i]!;
                          if (v) e2.transition = v;
                          else delete e2.transition;
                        });
                      }}
                    >
                      <option value=''>cut</option>
                      <option value='scroll'>
                        scroll{' '}
                        {exitScrollDir(ex)
                          ? `(${exitScrollDir(ex)})`
                          : '(needs edge)'}
                      </option>
                      <option value='diag'>diagonal wipe</option>
                      <option value='fade'>fade</option>
                      <option value='curtain'>curtain</option>
                      <option value='blinds'>blinds</option>
                    </select>
                  </td>
                  <td>
                    <CondPicker
                      game={game}
                      req={ex.req}
                      lockedDlgId={ex.lockedDlgId}
                      onChange={(req, lockedDlgId) =>
                        snapshotMutate((g) => {
                          const e2 = g.rooms.find((rr) => rr.id === room.id)!
                            .exits[i]!;
                          e2.req = req;
                          e2.lockedDlgId = lockedDlgId;
                        })
                      }
                    />
                  </td>
                  <td>{viewBtn(room.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {endingRows.length > 0 && (
          <table className='logic-table'>
            <caption>endings</caption>
            <thead>
              <tr>
                <th>at</th>
                <th>dialog</th>
                <th>condition</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {endingRows.map(({ room, en, i }) => (
                <tr key={`e${room.id}-${i}`}>
                  <td>
                    {roomLabel(room.id)} ({en.x},{en.y})
                  </td>
                  <td>{en.dlgId}</td>
                  <td>
                    <CondPicker
                      game={game}
                      req={en.req}
                      lockedDlgId={en.lockedDlgId}
                      onChange={(req, lockedDlgId) =>
                        snapshotMutate((g) => {
                          const e2 = g.rooms.find((rr) => rr.id === room.id)!
                            .endings[i]!;
                          e2.req = req;
                          e2.lockedDlgId = lockedDlgId;
                        })
                      }
                    />
                  </td>
                  <td>{viewBtn(room.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(altSprites.length > 0 || altItems.length > 0) && (
          <table className='logic-table'>
            <caption>alt dialogs</caption>
            <thead>
              <tr>
                <th>kind</th>
                <th>who</th>
                <th>alt dialog</th>
                <th>when</th>
              </tr>
            </thead>
            <tbody>
              {altSprites.map((sp) => altRow('sprite', sp))}
              {altItems.map((it) => altRow('item', it))}
            </tbody>
          </table>
        )}

        {game.sprites.length > 0 && (
          <table className='logic-table'>
            <caption>sprite visibility</caption>
            <thead>
              <tr>
                <th>sprite</th>
                <th>appears when</th>
              </tr>
            </thead>
            <tbody>
              {game.sprites.map((sp) => (
                <tr key={'ap' + sp.id}>
                  <td>
                    {sp.id} <em style={{ color: 'var(--ink-dim)' }}>{sp.name}</em>
                  </td>
                  <td>
                    <CondEditor
                      game={game}
                      cond={sp.appearCond}
                      onChange={(cond) =>
                        snapshotMutate((g) => {
                          const t = g.sprites.find((x) => x.id === sp.id);
                          if (!t) return;
                          if (cond) t.appearCond = cond;
                          else delete t.appearCond;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {eventRows.length > 0 && (
          <table className='logic-table'>
            <caption>events</caption>
            <thead>
              <tr>
                <th>at</th>
                <th>summary</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {eventRows.map(({ room, ev, i }) => (
                <tr key={`v${room.id}-${i}`}>
                  <td>
                    {roomLabel(room.id)} ({ev.x},{ev.y})
                  </td>
                  <td>
                    {ev.once ? 'once, ' : ''}
                    {ev.actions.length} action
                    {ev.actions.length === 1 ? '' : 's'}
                  </td>
                  <td>{viewBtn(room.id, 'view room (edit in events panel)')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!hasAny && (
          <div className='keys'>no exits, endings, sprites or items yet</div>
        )}

        <div className='keys'>
          conditions test items, item counts, flags or variables · exits/endings
          can carry a “locked” message · sprites/items: <b>alt dialog</b>{' '}
          replaces the base dialog when its condition is met · <b>appears</b>{' '}
          hides a sprite until its condition holds · flags/vars are managed in
          the <b>events</b> panel
        </div>
      </div>
    </div>
  );
}
