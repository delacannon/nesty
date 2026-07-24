import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { RoomProps } from '../world/RoomProps';
import { RailResizer } from './RailResizer';

/** Right inspector: context-sensitive per view. World shows room props +
 *  entity condition tables + events/logic tabs; Dialogue shows an all-text
 *  review list; other views have no inspector. */
export function RightInspector() {
  const view = useUiStore((s) => s.view);
  const collapsed = useUiStore((s) => s.rightCollapsed);
  const width = useUiStore((s) => s.rightWidth);
  if (view !== 'world' && view !== 'dialog') return null;
  return (
    <div
      className={collapsed ? 'rail-right collapsed' : 'rail-right'}
      style={collapsed ? undefined : { width, minWidth: width }}
    >
      {!collapsed && (
        <>
          <RailResizer side='right' />
          {view === 'world' ? <RoomProps /> : <DialogReview />}
        </>
      )}
    </div>
  );
}

function DialogReview() {
  const game = useGameStore((s) => s.game);
  const ids = Object.keys(game.dialogs);
  return (
    <div className='inspector'>
      <div className='insp-head'>Dialogue review · {ids.length}</div>
      <div className='insp-section'>
        <div className='sec-title'>All dialogs</div>
        <div className='dlg-review'>
          {ids.length === 0 && <div className='insp-empty'>no dialogs yet</div>}
          {ids.map((id) => {
            const text = game.dialogs[id] ?? '';
            return (
              <div
                key={id}
                className='dlg-review-row'
                onClick={() => useGameStore.setState({ selectedDlgId: id })}
                title='select this dialog'
              >
                <span className='id'>{id}</span>
                <span>{text || '(empty)'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
