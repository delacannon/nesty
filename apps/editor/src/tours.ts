import type { Step } from 'react-joyride';
import type { PanelId } from './store/uiStore';

export type TourId =
  | 'welcome'
  | 'room'
  | 'drawables'
  | 'palette'
  | 'sfx'
  | 'logic'
  | 'dialog'
  | 'text'
  | 'data';

interface Tour {
  label: string;
  /** panels that must be visible before the tour runs */
  panels: PanelId[];
  steps: Step[];
}

const S = (target: string, content: string, title?: string): Step => ({
  target,
  content,
  title,
  disableBeacon: true,
});

export const TOURS: Record<TourId, Tour> = {
  welcome: {
    label: 'welcome tour',
    panels: ['room', 'drawables', 'palette', 'dialog'],
    steps: [
      S(
        '[data-tour="title"]',
        'This is your game title — it shows on the NES title screen. Everything you make here compiles to a real NES ROM.',
        'welcome to NESty',
      ),
      S(
        '[data-tour="toggles"]',
        'Each button shows or hides a workspace panel. Drag a panel by its header to rearrange them.',
        'panels',
      ),
      S(
        '[data-tour="panel-room"]',
        'The room is your world: paint tiles, place sprites and items, connect exits. Hit ▶ play to run the game right here.',
        'room',
      ),
      S(
        '[data-tour="panel-drawables"]',
        'Draw your art: tiles, sprites, items and the avatar. 16×16 pixels, 3 colors + transparent — pure NES.',
        'paint',
      ),
      S(
        '[data-tour="panel-palette"]',
        'NES palettes: a backdrop plus 4 background and 4 sprite sub-palettes per palette set.',
        'colors',
      ),
      S(
        '[data-tour="panel-dialog"]',
        'Write what your sprites say. Text wraps to dialog pages automatically.',
        'dialog',
      ),
      S(
        '[data-tour="status"]',
        'The status bar rebuilds your ROM as you edit — meters show how much cartridge space is left, and you can download the .nes anytime.',
        'your ROM',
      ),
      S(
        '[data-tour="help"]',
        'Come back here anytime for a tour of each part of the app. Have fun!',
        'help',
      ),
    ],
  },
  room: {
    label: 'room editor',
    panels: ['room'],
    steps: [
      S(
        '[data-tour="room-tools"]',
        'Pick a tool: draw tiles, erase (right-click also erases while drawing), paint sub-palettes, set the start cell, place sprites/items, connect exits, place endings.',
        'tools',
      ),
      S(
        '[data-tour="panel-room"]',
        'Click or drag on the canvas to paint. Exits ask for a source, then a destination cell — in any room.',
        'canvas',
      ),
      S(
        '[data-tour="room-strip"]',
        'Switch rooms, add new ones with +, and pick which palette set the room uses.',
        'rooms',
      ),
      S(
        '[data-tour="play"]',
        'Builds the ROM and plays it in this panel — with sound. Arrows walk, Z talks, Enter starts.',
        'play',
      ),
    ],
  },
  drawables: {
    label: 'paint / drawables',
    panels: ['drawables'],
    steps: [
      S(
        '[data-tour="draw-tabs"]',
        'Four kinds of art: background tiles, talking sprites, collectible items, and your avatar.',
        'kinds',
      ),
      S(
        '[data-tour="panel-drawables"]',
        'Paint pixels with colors 0–3 of a sub-palette. Add a second frame for animation. Selecting here also selects the matching room tool.',
        'pixels',
      ),
    ],
  },
  palette: {
    label: 'palettes',
    panels: ['palette'],
    steps: [
      S(
        '[data-tour="panel-palette"]',
        'A palette set = 1 backdrop + 4 BG sub-palettes + 4 sprite sub-palettes, straight from the real NES master palette. Rooms pick a set; cells and sprites pick a sub-palette.',
        'palettes',
      ),
    ],
  },
  sfx: {
    label: 'sound effects',
    panels: ['sfx'],
    steps: [
      S(
        '[data-tour="panel-sfx"]',
        'Five built-in effects — walk, talk, pickup, exit, ending — each a little pulse-channel note stream. Edit the notes and preview them.',
        'sfx',
      ),
    ],
  },
  logic: {
    label: 'logic',
    panels: ['logic'],
    steps: [
      S(
        '[data-tour="panel-logic"]',
        'Conditions: lock exits and endings behind items, and give sprites alternate dialogs when the player carries something.',
        'logic',
      ),
    ],
  },
  dialog: {
    label: 'dialogs',
    panels: ['dialog'],
    steps: [
      S(
        '[data-tour="panel-dialog"]',
        'Every sprite, item pickup, locked door and ending points at a dialog. The preview shows how text paginates in-game.',
        'dialogs',
      ),
    ],
  },
  text: {
    label: 'text & fonts',
    panels: ['text'],
    steps: [
      S(
        '[data-tour="panel-text"]',
        'Pick a font (only the selected one is compiled into the ROM) and configure the typewriter effect speed — or turn it off for instant text.',
        'text',
      ),
    ],
  },
  data: {
    label: 'game data',
    panels: ['data'],
    steps: [
      S(
        '[data-tour="panel-data"]',
        'Your whole game as plain text: copy it, back it up, edit it by hand and import it back. Load the bundled example games from here too.',
        'data',
      ),
      S(
        '[data-tour="panel-data"]',
        'Below the text: download the .nes ROM or the generated 6502 assembly, and check the cartridge budget.',
        'downloads',
      ),
    ],
  },
};

export const TOUR_IDS = Object.keys(TOURS) as TourId[];
