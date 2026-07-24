// Render a game as a scaled pixel-art "cartridge" PNG whose pixels *are* the
// compressed data (3 bytes per RGB pixel), and read it back. PNG is lossless
// and we draw with smoothing off, so each data pixel is a solid scale×scale
// block that survives the round trip exactly.
import {
  cartridgeGeometry,
  frameCartridge,
  unframeCartridge,
  type GameData,
} from '@nesty/core';
import { decodeGameFile, encodeGameFile } from './gamefile';

const DEFAULT_SCALE = 8; // one data pixel -> 8×8 screen pixels

/** Build a cartridge-label PNG blob from a game. */
export async function encodeGameImage(
  g: GameData,
  scale = DEFAULT_SCALE,
): Promise<{ blob: Blob; side: number; scale: number }> {
  const data = await encodeGameFile(g);
  const { side, rgb } = frameCartridge(data, scale);

  // 1:1 data grid first
  const src = new ImageData(side, side);
  for (let i = 0; i < side * side; i++) {
    src.data[i * 4] = rgb[i * 3]!;
    src.data[i * 4 + 1] = rgb[i * 3 + 1]!;
    src.data[i * 4 + 2] = rgb[i * 3 + 2]!;
    src.data[i * 4 + 3] = 255;
  }
  const small = document.createElement('canvas');
  small.width = side;
  small.height = side;
  small.getContext('2d')!.putImageData(src, 0, 0);

  // nearest-neighbour upscale
  const big = document.createElement('canvas');
  big.width = side * scale;
  big.height = side * scale;
  const bctx = big.getContext('2d')!;
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);

  const blob = await new Promise<Blob>((res, rej) =>
    big.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  );
  return { blob, side, scale };
}

/** Recover a game from a cartridge-label PNG file. */
export async function decodeGameImage(file: Blob): Promise<GameData> {
  const bmp = await createImageBitmap(file);
  const cv = document.createElement('canvas');
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bmp, 0, 0);
  const { data, width } = ctx.getImageData(0, 0, cv.width, cv.height);
  const px = (cx: number, cy: number): [number, number, number] => {
    const o = (cy * width + cx) * 4;
    return [data[o]!, data[o + 1]!, data[o + 2]!];
  };
  const { scale, side } = cartridgeGeometry(px(0, 0));
  const nesty = unframeCartridge((i) =>
    px((i % side) * scale, ((i / side) | 0) * scale),
  );
  // decodeGameFile expects the compressed .nesty bytes (NZC container)
  return decodeGameFile(nesty);
}
