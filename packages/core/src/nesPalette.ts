/** NES master palette (2C02, standard Mesen-ish RGB values) as sRGB hex. */
export const NES_PALETTE_RGB: string[] = [
  '#666666', '#002A88', '#1412A7', '#3B00A4', '#5C007E', '#6E0040', '#6C0600', '#561D00',
  '#333500', '#0B4800', '#005200', '#004F08', '#00404D', '#000000', '#000000', '#000000',
  '#ADADAD', '#155FD9', '#4240FF', '#7527FE', '#A01ACC', '#B71E7B', '#B53120', '#994E00',
  '#6B6D00', '#388700', '#0C9300', '#008F32', '#007C8D', '#000000', '#000000', '#000000',
  '#FFFEFF', '#64B0FF', '#9290FF', '#C676FF', '#F36AFF', '#FE6ECC', '#FE8170', '#EA9E22',
  '#BCBE00', '#88D800', '#5CE430', '#45E082', '#48CDDE', '#4F4F4F', '#000000', '#000000',
  '#FFFEFF', '#C0DFFF', '#D3D2FF', '#E8C8FF', '#FBC2FF', '#FEC4EA', '#FECCC5', '#F7D8A5',
  '#E4E594', '#CFEF96', '#BDF4AB', '#B3F3CC', '#B5EBF2', '#B8B8B8', '#000000', '#000000',
];

/** $0D is "blacker than black" — causes issues on real hardware; disallow in editor. */
export const FORBIDDEN_COLOR = 0x0d;

export function colorToHex(c: number): string {
  return NES_PALETTE_RGB[c & 0x3f]!;
}

const NES_RGB_TRIPLES: [number, number, number][] = NES_PALETTE_RGB.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

/** Nearest NES master-palette index (0-63) for an sRGB triple. */
export function nearestNesColor(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < NES_RGB_TRIPLES.length; i++) {
    if (i === FORBIDDEN_COLOR) continue;
    const [pr, pg, pb] = NES_RGB_TRIPLES[i]!;
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
