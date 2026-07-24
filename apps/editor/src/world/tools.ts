import type { Tool } from '../store/gameStore';

/** Room editor tools — shared by the tool palette and the canvas header hint. */
export const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'tile', label: 'draw', hint: 'paint selected tile' },
  { id: 'erase', label: 'erase', hint: 'clear cell' },
  { id: 'palette', label: 'pal', hint: 'paint BG sub-palette' },
  { id: 'avatar', label: 'start', hint: 'set avatar start' },
  { id: 'sprite', label: 'spr', hint: 'place selected sprite' },
  { id: 'item', label: 'item', hint: 'place selected item' },
  {
    id: 'exit',
    label: 'exit',
    hint: 'click source, then destination (any room)',
  },
  { id: 'ending', label: 'end', hint: 'place ending (uses selected dialog)' },
  {
    id: 'event',
    label: 'evt',
    hint: 'place event (edit actions in the inspector)',
  },
  {
    id: 'overlay',
    label: 'ovl',
    hint: 'conditional cell: pick a tile, sprite or item — shown while its condition holds',
  },
];
