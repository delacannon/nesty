import { useUiStore } from '../store/uiStore';

/** Drag handle on a rail's inner edge to resize its width. */
export function RailResizer({ side }: { side: 'left' | 'right' }) {
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const st = useUiStore.getState();
    const start = side === 'left' ? st.leftWidth : st.rightWidth;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const w = side === 'left' ? start + dx : start - dx;
      if (side === 'left') useUiStore.getState().setLeftWidth(w);
      else useUiStore.getState().setRightWidth(w);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      className={`rail-resizer rail-resizer-${side}`}
      onPointerDown={onDown}
      title='drag to resize'
    />
  );
}
