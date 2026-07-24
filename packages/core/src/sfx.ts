/** Sound effects: note sequences for the engine's APU pulse-1 driver. */

export interface SfxNote {
  freq: number; // Hz (50-2000 sensible on NES pulse)
  frames: number; // duration at 60fps
  vol: number; // 0-15
  duty: 0 | 1 | 2 | 3; // pulse width: 12.5% / 25% / 50% / 75%
}

// 'type' is the per-char typewriter blip (played when GameData.typewriterSfx).
export const SFX_NAMES = ['walk', 'talk', 'pickup', 'exit', 'ending', 'type'] as const;
export type SfxName = (typeof SFX_NAMES)[number];
export type SfxSet = Record<SfxName, SfxNote[]>;

/** User-created sound effect, triggerable from events/logic via its id. */
export interface SfxClip {
  id: string;
  name: string;
  notes: SfxNote[];
}

export function defaultSfxSet(): SfxSet {
  return {
    walk: [{ freq: 160, frames: 2, vol: 2, duty: 0 }],
    talk: [
      { freq: 440, frames: 2, vol: 5, duty: 2 },
      { freq: 660, frames: 3, vol: 5, duty: 2 },
    ],
    pickup: [
      { freq: 523, frames: 3, vol: 7, duty: 2 },
      { freq: 659, frames: 3, vol: 7, duty: 2 },
      { freq: 784, frames: 5, vol: 7, duty: 2 },
    ],
    exit: [
      { freq: 330, frames: 3, vol: 6, duty: 2 },
      { freq: 262, frames: 3, vol: 6, duty: 2 },
      { freq: 392, frames: 6, vol: 6, duty: 2 },
    ],
    ending: [
      { freq: 392, frames: 6, vol: 7, duty: 2 },
      { freq: 523, frames: 6, vol: 7, duty: 2 },
      { freq: 659, frames: 6, vol: 7, duty: 2 },
      { freq: 784, frames: 12, vol: 7, duty: 2 },
    ],
    // short high blip, one per typed character
    type: [{ freq: 1200, frames: 1, vol: 3, duty: 2 }],
  };
}
