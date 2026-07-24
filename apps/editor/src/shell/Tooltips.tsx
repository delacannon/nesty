import { useEffect, useRef, useState } from 'react';

/**
 * Global tooltip layer. Upgrades any element carrying a `title` attribute
 * (buttons, inputs, chips…) into a styled tooltip on hover/focus, suppressing
 * the browser's native one. Mount once at the app root — no per-button wiring.
 */
const SHOW_DELAY = 350;

interface Tip {
  text: string;
  x: number;
  y: number;
  place: 'top' | 'bottom';
}

export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // element whose title we've stashed (to restore on leave)
  const stashed = useRef<{ el: HTMLElement; title: string } | null>(null);

  useEffect(() => {
    const restore = () => {
      if (stashed.current) {
        stashed.current.el.setAttribute('title', stashed.current.title);
        stashed.current = null;
      }
    };
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      restore();
      setTip(null);
    };

    const target = (e: Event): HTMLElement | null => {
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        const t = el.getAttribute?.('title');
        if (t && t.trim()) return el;
        el = el.parentElement;
      }
      return null;
    };

    const show = (el: HTMLElement) => {
      const title = el.getAttribute('title');
      if (!title) return;
      // stash + strip so the native tooltip stays hidden while ours shows
      el.setAttribute('data-tip', title);
      el.removeAttribute('title');
      stashed.current = { el, title };
      const r = el.getBoundingClientRect();
      const below = r.top < 90;
      setTip({
        text: title,
        x: Math.round(r.left + r.width / 2),
        y: below ? Math.round(r.bottom + 8) : Math.round(r.top - 8),
        place: below ? 'bottom' : 'top',
      });
    };

    const onOver = (e: MouseEvent) => {
      const el = target(e);
      if (!el) return;
      if (stashed.current?.el === el) return; // already showing for this el
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => show(el), SHOW_DELAY);
    };
    const onOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      const tracked = stashed.current?.el;
      // moving within the tracked element (e.g. onto its text) — keep showing
      if (tracked && related && tracked.contains(related)) return;
      clear();
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mousedown', clear, true);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mousedown', clear, true);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('blur', clear);
      restore();
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      className={`tooltip tooltip-${tip.place}`}
      style={{
        left: tip.x,
        top: tip.y,
        transform:
          tip.place === 'top'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, 0)',
      }}
      role='tooltip'
    >
      {tip.text}
    </div>
  );
}
