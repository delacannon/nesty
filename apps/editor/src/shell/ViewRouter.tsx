import { DialogEditor } from '../panels/DialogEditor';
import { AvatarPanel } from '../panels/AvatarPanel';
import { DrawablesPanel } from '../panels/DrawablesPanel';
import { GameTextPanel } from '../panels/GameTextPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { SfxPanel } from '../panels/SfxPanel';
import { SongPanel } from '../panels/SongPanel';
import { SplashPanel } from '../panels/SplashPanel';
import { TextPanel } from '../panels/TextPanel';
import { useUiStore } from '../store/uiStore';
import { RoomCanvas } from '../world/RoomCanvas';

/** Center region: the active view's main editing surface. */
export function ViewRouter() {
  const view = useUiStore((s) => s.view);
  return (
    <div className='region-center'>
      {view === 'world' && <RoomCanvas />}
      {view === 'draw' && <DrawablesPanel />}
      {view === 'avatar' && <AvatarPanel />}
      {view === 'palette' && <PalettePanel />}
      {view === 'song' && <SongPanel />}
      {view === 'sfx' && <SfxPanel />}
      {view === 'dialog' && <DialogEditor />}
      {view === 'text' && <TextPanel />}
      {view === 'splash' && <SplashPanel />}
      {view === 'data' && <GameTextPanel />}
    </div>
  );
}
