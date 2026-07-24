import { useEffect } from 'react';
import Joyride, { EVENTS, STATUS, type CallBackProps } from 'react-joyride';
import { useUiStore } from '../store/uiStore';
import { TOURS } from '../tours';

const SEEN_KEY = 'nesty:v1:tour-done';

const JOYRIDE_STYLES = {
  options: {
    arrowColor: '#222222',
    backgroundColor: '#222222',
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    primaryColor: '#c92c61',
    textColor: '#b7babb',
    zIndex: 10000,
  },
  tooltip: {
    border: '1px solid #000',
    borderRadius: 4,
    fontSize: 13,
  },
  tooltipTitle: {
    color: '#c92c61',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
  },
  buttonNext: { borderRadius: 4 },
  buttonBack: { color: '#777' },
};

export function HelpTours() {
  const activeTour = useUiStore((s) => s.activeTour);

  // first visit: run the welcome tour once panels have popped in
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('nt'))
      return; // screenshot/testing: skip auto welcome tour
    const t = setTimeout(() => useUiStore.getState().startTour('welcome'), 500);
    return () => clearTimeout(t);
  }, []);

  const onCallback = (data: CallBackProps) => {
    // scroll the workspace (not the page) to bring the target into view
    if (data.type === EVENTS.STEP_BEFORE || data.type === EVENTS.TOUR_START) {
      const t =
        typeof data.step?.target === 'string'
          ? document.querySelector<HTMLElement>(data.step.target)
          : (data.step?.target as HTMLElement | null);
      t?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      useUiStore.getState().stopTour();
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* private mode */
      }
    }
  };

  if (!activeTour) return null;
  return (
    <Joyride
      key={activeTour}
      steps={TOURS[activeTour].steps}
      run
      continuous
      showSkipButton
      showProgress
      disableScrolling
      callback={onCallback}
      styles={JOYRIDE_STYLES}
      locale={{
        back: 'back',
        close: 'close',
        last: 'done',
        next: 'next',
        skip: 'skip',
      }}
    />
  );
}
