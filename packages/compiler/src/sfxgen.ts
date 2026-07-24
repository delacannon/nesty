/**
 * APU sound effect encoding for the engine's pulse-1 driver.
 * Note definitions live in the game data (game.sfx, editable in the editor);
 * this module converts them to engine byte streams:
 *   [$4000 ctrl (duty|halt|const|vol), $4002 period lo, $4003 period hi | len, frames]* $ff
 */
import type { GameData, SfxNote, SfxSet } from '@nesty/core';
import { SFX_NAMES } from '@nesty/core';

const CPU_HZ = 1789773;

/** Engine SFX ids — must match SFX_* constants in engine.asm (= SFX_NAMES order). */
export const SFX_WALK = 0;
export const SFX_TALK = 1;
export const SFX_PICKUP = 2;
export const SFX_EXIT = 3;
export const SFX_ENDING = 4;
export const SFX_TYPE = 5; // typewriter per-char blip

export function notePeriod(freq: number): number {
  return Math.max(8, Math.min(0x7ff, Math.round(CPU_HZ / (16 * freq)) - 1));
}

export function encodeSfx(notes: SfxNote[]): number[] {
  const out: number[] = [];
  for (const n of notes) {
    const p = notePeriod(n.freq);
    // duty | length-halt | constant-volume | volume
    const ctrl = ((n.duty & 3) << 6) | 0b00110000 | (n.vol & 15);
    out.push(
      ctrl,
      p & 0xff,
      ((p >> 8) & 7) | 0x08,
      Math.max(1, Math.min(255, n.frames)),
    );
  }
  out.push(0xff);
  return out;
}

/** All builtin SFX streams in engine id order (SFX_NAMES). */
export function encodeSfxSet(set: SfxSet): number[][] {
  return SFX_NAMES.map((name) => encodeSfx(set[name] ?? []));
}

/**
 * Builtin SFX (SFX_NAMES order) followed by custom clips, in engine index
 * order — this is the layout of the engine's sfx_lo/sfx_hi pointer tables.
 */
export function encodeAllSfx(game: GameData): number[][] {
  return [
    ...SFX_NAMES.map((name) => encodeSfx(game.sfx[name] ?? [])),
    ...game.customSfx.map((c) => encodeSfx(c.notes)),
  ];
}

/** Engine sfx index for a builtin name or custom clip id (0 fallback). */
export function sfxIndexOf(game: GameData, sfxId: string): number {
  const bi = (SFX_NAMES as readonly string[]).indexOf(sfxId);
  if (bi !== -1) return bi;
  const ci = game.customSfx.findIndex((c) => c.id === sfxId);
  return ci === -1 ? 0 : SFX_NAMES.length + ci;
}

/** Human-readable labels for the combined sfx table (for asm comments). */
export function sfxLabels(game: GameData): string[] {
  return [...SFX_NAMES, ...game.customSfx.map((c) => c.id)];
}
