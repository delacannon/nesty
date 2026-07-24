import { useEffect } from 'react';
import { useConfirm } from '../store/confirmStore';

/** Centered "Attention" confirmation alert for destructive actions.
 *  Driven imperatively via confirmAction(). Mount once at the app root. */
export function ConfirmDialog() {
  const current = useConfirm((s) => s.current);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useConfirm.getState().resolve(false);
      else if (e.key === 'Enter') useConfirm.getState().resolve(true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current]);

  if (!current) return null;
  const resolve = (v: boolean) => useConfirm.getState().resolve(v);

  return (
    <div
      className='confirm-overlay'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) resolve(false);
      }}
    >
      <div className='confirm-box' role='alertdialog' aria-modal='true'>
        <div className='confirm-title'>
          <span className='confirm-icon'>⚠</span>
          {current.title ?? 'Attention'}
        </div>
        <div className='confirm-msg'>{current.message}</div>
        <div className='confirm-actions'>
          <button onClick={() => resolve(false)}>
            {current.cancelLabel ?? 'Cancel'}
          </button>
          <button
            className={current.danger ? 'danger' : 'primary'}
            autoFocus
            onClick={() => resolve(true)}
          >
            {current.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
