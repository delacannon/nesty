import { useEffect } from 'react';
import { HelpTours } from './components/HelpTours';
import { BuildTerminal } from './shell/BuildTerminal';
import { ConfirmDialog } from './shell/ConfirmDialog';
import { LeftRail } from './shell/LeftRail';
import { RightInspector } from './shell/RightInspector';
import { TopToolbar } from './shell/TopToolbar';
import { Tooltips } from './shell/Tooltips';
import { ViewRouter } from './shell/ViewRouter';
import { StatusBar } from './panels/StatusBar';
import { useGameStore } from './store/gameStore';
import { useUiStore } from './store/uiStore';

export function App() {
  const theme = useUiStore((s) => s.theme);

  // apply the selected GUI theme (token remap) to the document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        useGameStore.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className='app'>
      <TopToolbar />
      <LeftRail />
      <ViewRouter />
      <RightInspector />
      <StatusBar />
      <BuildTerminal />
      <HelpTours />
      <Tooltips />
      <ConfirmDialog />
    </div>
  );
}
