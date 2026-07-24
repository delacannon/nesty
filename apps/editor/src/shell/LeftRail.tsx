import { useUiStore } from '../store/uiStore';
import { DrawPicker } from '../world/DrawPicker';
import { RoomNavigator } from '../world/RoomNavigator';
import { ToolPalette } from '../world/ToolPalette';
import { RailResizer } from './RailResizer';

/** Left rail: tools + navigator. Only the World view uses it; other views
 *  have no left rail (the grid column collapses). Resizable + collapsible. */
export function LeftRail() {
  const view = useUiStore((s) => s.view);
  const collapsed = useUiStore((s) => s.leftCollapsed);
  const width = useUiStore((s) => s.leftWidth);
  if (view !== 'world') return null;
  return (
    <div
      className={collapsed ? 'rail-left collapsed' : 'rail-left'}
      style={collapsed ? undefined : { width, minWidth: width }}
    >
      {!collapsed && (
        <>
          <ToolPalette />
          <DrawPicker />
          <RoomNavigator />
          <RailResizer side='left' />
        </>
      )}
    </div>
  );
}
