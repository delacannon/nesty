/** Canvas helpers: render Frame16 pixel art with NES palette colors. */
import type { Frame16, GameData, PaletteSet, Room, SubPal } from '@nesty/core';
import { NES_PALETTE_RGB } from '@nesty/core';

export const rgb = (c: number) => NES_PALETTE_RGB[c & 0x3f]!;

export function paletteFor(game: GameData, room: Room): PaletteSet {
  return game.palettes.find((p) => p.id === room.palId) ?? game.palettes[0]!;
}

/** colors[0..3] as css strings; index 0 may be null for transparent. */
export function bgColors(pal: PaletteSet, sub: SubPal): (string | null)[] {
  return [rgb(pal.backdrop), ...pal.bg[sub]!.map(rgb)];
}

export function sprColors(pal: PaletteSet, sub: SubPal): (string | null)[] {
  return [null, ...pal.spr[sub]!.map(rgb)];
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame16,
  colors: (string | null)[],
  x: number,
  y: number,
  scale: number,
): void {
  for (let py = 0; py < 16; py++) {
    for (let px = 0; px < 16; px++) {
      const v = frame[py * 16 + px]!;
      const c = colors[v];
      if (c === null || c === undefined) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
    }
  }
}
