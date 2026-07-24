/**
 * 256×224 image → NES splash screen:
 * quantize to the NES master palette, fit each 16×16 cell to one of 4
 * greedy-built sub-palettes over a shared backdrop, dedupe cells into
 * game tiles (name-prefixed so re-imports replace them).
 */
import type {
  Frame16,
  GameData,
  PaletteSet,
  Pixel,
  SubPal,
  TileDef,
} from '@nesty/core';
import {
  blankFrame,
  blankSplash,
  MAX_TILES,
  NES_PALETTE_RGB,
  SPLASH_CELLS,
  SPLASH_H,
  SPLASH_W,
} from '@nesty/core';

export const SPLASH_IMG_W = SPLASH_W * 16; // 256
export const SPLASH_IMG_H = SPLASH_H * 16; // 224

const SPLASH_TILE_PREFIX = 'splash#';
const SPLASH_PAL_NAME = 'splash';

/** NES colors that are safe and visually distinct ($0D forbidden, black dupes → $0F). */
const ALLOWED: number[] = [];
{
  const seen = new Set<string>();
  for (let c = 0; c < 0x40; c++) {
    if (c === 0x0d) continue;
    const hexCol = NES_PALETTE_RGB[c]!;
    if (hexCol === '#000000' && c !== 0x0f) continue;
    if (seen.has(hexCol)) continue;
    seen.add(hexCol);
    ALLOWED.push(c);
  }
}

const RGB: [number, number, number][] = NES_PALETTE_RGB.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

function nearestNes(r: number, g: number, b: number): number {
  let best = 0x0f;
  let bestD = Infinity;
  for (const c of ALLOWED) {
    const [cr, cg, cb] = RGB[c]!;
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function colorDist(a: number, b: number): number {
  const [ar, ag, ab] = RGB[a]!;
  const [br, bg, bb] = RGB[b]!;
  return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;
}

export interface SplashImportOk {
  ok: true;
  palette: PaletteSet;
  newTiles: TileDef[];
  /** ids (existing splash-import tiles) to delete before adding newTiles */
  removeTileIds: string[];
  tiles: string[]; // SPLASH_CELLS ids
  pmap: SubPal[];
  message: string;
}
export interface SplashImportErr {
  ok: false;
  message: string;
}
export type SplashImportResult = SplashImportOk | SplashImportErr;

const ID_CHARS =
  '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * data: RGBA pixels of a 256×224 image.
 * Pure function: returns the changes; caller mutates the game.
 */
export function quantizeSplash(
  game: GameData,
  data: Uint8ClampedArray,
): SplashImportResult {
  // 1. per-pixel nearest NES color
  const px = new Array<number>(SPLASH_IMG_W * SPLASH_IMG_H);
  const cache = new Map<number, number>();
  const freq = new Map<number, number>();
  for (let i = 0; i < px.length; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const key = (r << 16) | (g << 8) | b;
    let c = cache.get(key);
    if (c === undefined) {
      c = nearestNes(r, g, b);
      cache.set(key, c);
    }
    px[i] = c;
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }

  // 2. backdrop = most frequent color
  let backdrop = 0x0f;
  let bdN = -1;
  for (const [c, n] of freq)
    if (n > bdN) {
      bdN = n;
      backdrop = c;
    }

  // 3. per cell: non-backdrop colors by frequency, top 3
  interface Cell {
    idx: number;
    cols: number[]; // ≤3, by frequency desc
    colFreq: Map<number, number>;
  }
  const cells: Cell[] = [];
  for (let cy = 0; cy < SPLASH_H; cy++) {
    for (let cx = 0; cx < SPLASH_W; cx++) {
      const colFreq = new Map<number, number>();
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const c = px[(cy * 16 + y) * SPLASH_IMG_W + cx * 16 + x]!;
          if (c !== backdrop) colFreq.set(c, (colFreq.get(c) ?? 0) + 1);
        }
      const cols = [...colFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c);
      cells.push({ idx: cy * SPLASH_W + cx, cols, colFreq });
    }
  }

  // 4. greedy sub-palette build: most colorful cells claim slots first
  const pals: number[][] = [];
  for (const cell of [...cells].sort((a, b) => b.cols.length - a.cols.length)) {
    if (cell.cols.length === 0) continue;
    if (pals.some((p) => cell.cols.every((c) => p.includes(c)))) continue;
    let merged = false;
    for (const p of pals) {
      const union = new Set([...p, ...cell.cols]);
      if (union.size <= 3) {
        p.length = 0;
        p.push(...union);
        merged = true;
        break;
      }
    }
    if (!merged && pals.length < 4) pals.push([...cell.cols]);
  }
  while (pals.length < 4) pals.push([]);
  for (const p of pals) while (p.length < 3) p.push(0x0f);

  // 5. per cell: best sub-palette by covered pixel count, then map pixels
  const cellPal = new Array<SubPal>(SPLASH_CELLS).fill(0);
  const frames = new Array<Frame16 | null>(SPLASH_CELLS).fill(null);
  for (const cell of cells) {
    if (cell.cols.length === 0) continue; // pure backdrop → empty
    let bestP: SubPal = 0;
    let bestScore = -1;
    pals.forEach((p, pi) => {
      let score = 0;
      for (const [c, n] of cell.colFreq) if (p.includes(c)) score += n;
      if (score > bestScore) {
        bestScore = score;
        bestP = pi as SubPal;
      }
    });
    cellPal[cell.idx] = bestP;
    const pal = pals[bestP]!;
    const f = blankFrame();
    const cy = Math.floor(cell.idx / SPLASH_W);
    const cx = cell.idx % SPLASH_W;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const c = px[(cy * 16 + y) * SPLASH_IMG_W + cx * 16 + x]!;
        // nearest among backdrop + 3 slot colors
        let v: Pixel = 0;
        let d = colorDist(c, backdrop);
        pal.forEach((pc, pi) => {
          const pd = colorDist(c, pc);
          if (pd < d) {
            d = pd;
            v = (pi + 1) as Pixel;
          }
        });
        f[y * 16 + x] = v;
      }
    frames[cell.idx] = f.some((v) => v !== 0) ? f : null;
  }

  // 6. dedupe frames into tiles
  const prevSplashTiles = game.tiles.filter(
    (t) =>
      t.name.startsWith(SPLASH_TILE_PREFIX) &&
      !game.rooms.some((r) => r.tiles.includes(t.id)),
  );
  const removeTileIds = prevSplashTiles.map((t) => t.id);
  const usedIds = new Set(
    game.tiles.filter((t) => !removeTileIds.includes(t.id)).map((t) => t.id),
  );
  const keptCount = usedIds.size;

  const byKey = new Map<string, string>(); // frame key → tile id
  const newTiles: TileDef[] = [];
  const map = new Array<string>(SPLASH_CELLS).fill('0');
  const freeIds = [...ID_CHARS].filter((c) => !usedIds.has(c));
  for (let i = 0; i < SPLASH_CELLS; i++) {
    const f = frames[i];
    if (!f) continue;
    const key = f.join('');
    let id = byKey.get(key);
    if (id === undefined) {
      if (
        keptCount + newTiles.length >= MAX_TILES ||
        newTiles.length >= freeIds.length
      ) {
        return {
          ok: false,
          message:
            `image needs more than ${MAX_TILES - keptCount} unique 16×16 tiles ` +
            `(limit ${MAX_TILES} total incl. game tiles) — simplify the image or free up tiles`,
        };
      }
      id = freeIds[newTiles.length]!;
      newTiles.push({
        id,
        name: `${SPLASH_TILE_PREFIX}${newTiles.length}`,
        wall: false,
        frames: [f],
      });
      byKey.set(key, id);
    }
    map[i] = id;
  }

  // 7. splash palette set (replaces a previous one of the same name)
  const prev = game.palettes.find((p) => p.name === SPLASH_PAL_NAME);
  const palId =
    prev?.id ??
    [...'0123456789abcdefghijklmnopqrstuvwxyz'].find(
      (c) => !game.palettes.some((p) => p.id === c),
    ) ??
    '?';
  const palette: PaletteSet = {
    id: palId,
    name: SPLASH_PAL_NAME,
    backdrop,
    bg: pals.map((p) => [p[0]!, p[1]!, p[2]!]) as PaletteSet['bg'],
    spr: (prev ?? game.palettes[0]!).spr.map(
      (t) => [...t] as [number, number, number],
    ),
  };

  return {
    ok: true,
    palette,
    newTiles,
    removeTileIds,
    tiles: map,
    pmap: cellPal,
    message: `imported: ${newTiles.length} tiles, ${pals.filter((p) => p.some((c) => c !== 0x0f)).length || 1} sub-palettes`,
  };
}

/** Apply an import result to the game (caller wraps in snapshot/mutateGame). */
export function applySplashImport(game: GameData, r: SplashImportOk): void {
  game.tiles = game.tiles.filter((t) => !r.removeTileIds.includes(t.id));
  game.tiles.push(...r.newTiles);
  const pi = game.palettes.findIndex((p) => p.id === r.palette.id);
  if (pi >= 0) game.palettes[pi] = r.palette;
  else game.palettes.push(r.palette);
  const sp = blankSplash(r.palette.id);
  sp.tiles = r.tiles;
  sp.pmap = r.pmap;
  game.splash = sp;
}
