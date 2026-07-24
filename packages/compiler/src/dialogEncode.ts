/**
 * Dialog text → engine byte stream.
 * Uppercased, word-wrapped to 28 cols, paginated to 2 lines per page.
 * Control bytes: $00 end, $01 second line, $02 page break.
 * Characters are emitted as CHR tile indices: (ascii - 32) + FONT_BASE_TILE.
 */
import type { FontStyle } from '@nesty/core';
import {
  FONT_BASE_TILE,
  FONT_EXT_BASE_TILE,
  FONT_FIRST_CHAR,
  FONT_CHAR_COUNT,
  fontExtChars,
} from './font';

export const DLG_END = 0;
export const DLG_NEWLINE = 1;
export const DLG_PAGE = 2;
/** Control byte: this dialog uses [cycle] — engine animates the highlight color. */
export const DLG_CYCLE = 3;
/** Control byte: this dialog uses [blink] — engine toggles the highlight color. */
export const DLG_BLINK = 4;
export const TEXT_COLS = 28;
export const TEXT_LINES_PER_PAGE = 2;

/** Per-char effect bitmask — effects accumulate ([cycle][wave]SEA[/wave][/cycle]). */
export const FX_COL1 = 1;
export const FX_CYCLE = 2;
export const FX_BLINK = 4;
export const FX_WAVE = 8;
/** Any palette-ink effect (drawn in the highlight color slot). */
export const FX_COLOR_MASK = FX_COL1 | FX_CYCLE | FX_BLINK;
export type ColorMark = number;

export interface RichLine {
  text: string;
  marks: ColorMark[];
}

/**
 * Strip inline effect markup: [col1] static highlight, [cycle] hue cycle,
 * [blink] on/off, [wave] 1px bob. Tags nest and accumulate in any order;
 * short aliases: [col]=[col1], [c]=[cycle], [b]=[blink], [w]=[wave].
 * Unknown [tags] stay literal; an unclosed tag runs to the dialog end.
 */
export function parseDialogMarkup(text: string): {
  clean: string;
  marks: ColorMark[];
} {
  const clean: string[] = [];
  const marks: ColorMark[] = [];
  let cur = 0;
  const re = /\[(\/?)(col1|cycle|col|blink|wave|c|b|w)\]/gi;
  let last = 0;
  const BIT: Record<string, number> = {
    col1: FX_COL1,
    col: FX_COL1,
    cycle: FX_CYCLE,
    c: FX_CYCLE,
    blink: FX_BLINK,
    b: FX_BLINK,
    wave: FX_WAVE,
    w: FX_WAVE,
  };
  for (const m of text.matchAll(re)) {
    for (const ch of text.slice(last, m.index)) {
      clean.push(ch);
      marks.push(cur);
    }
    const bit = BIT[m[2]!.toLowerCase()]!;
    cur = m[1] === '/' ? cur & ~bit : cur | bit;
    last = m.index! + m[0].length;
  }
  for (const ch of text.slice(last)) {
    clean.push(ch);
    marks.push(cur);
  }
  return { clean: clean.join(''), marks };
}

/**
 * Japanese input → the katakana bank's charset:
 * hiragana → katakana, precomposed voiced kana → base kana + ゛/゜ tile
 * (Famicom style), ideographic space / fullwidth ！？ → ASCII.
 */
export function normalizeKana(text: string): string {
  let out = '';
  for (const ch of text) {
    let c = ch.codePointAt(0)!;
    if (c === 0x3000) {
      out += ' ';
      continue;
    }
    if (c === 0xff01) {
      out += '!';
      continue;
    }
    if (c === 0xff1f) {
      out += '?';
      continue;
    }
    if (c >= 0x3041 && c <= 0x3096) c += 0x60; // hiragana → katakana
    if (c >= 0x30a1 && c <= 0x30fa) {
      // ガ → カ + combining dakuten; emit the mark as its own tile
      for (const d of String.fromCodePoint(c).normalize('NFD')) {
        if (d === '゙') out += '゛';
        else if (d === '゚') out += '゜';
        else out += d;
      }
      continue;
    }
    out += String.fromCodePoint(c);
  }
  return out;
}

/** Markup-aware wrap: same layout as wrapText, with per-char color marks. */
export function wrapTextRich(
  text: string,
  style: FontStyle = 'classic',
): RichLine[] {
  const parsed = parseDialogMarkup(text);
  // normalize/uppercase per char so marks survive expansions (ガ → カ゛)
  const chars: string[] = [];
  const marks: ColorMark[] = [];
  [...parsed.clean].forEach((ch, i) => {
    const norm = style === 'katakana' ? normalizeKana(ch) : ch;
    for (const c of norm.toUpperCase()) {
      chars.push(c);
      marks.push(parsed.marks[i]!);
    }
  });

  interface W {
    t: string;
    m: ColorMark[];
  }
  const lines: RichLine[] = [];
  const n = chars.length;
  let pi = 0;
  while (pi <= n) {
    let pe = pi;
    while (pe < n && chars[pe] !== '\n' && !(chars[pe] === '\r')) pe++;
    const words: W[] = [];
    let i = pi;
    while (i < pe) {
      while (i < pe && /\s/.test(chars[i]!)) i++;
      const s = i;
      while (i < pe && !/\s/.test(chars[i]!)) i++;
      if (i > s)
        words.push({ t: chars.slice(s, i).join(''), m: marks.slice(s, i) });
    }
    let cur: W = { t: '', m: [] };
    const flush = () => {
      if (cur.t !== '') {
        lines.push({ text: cur.t, marks: cur.m });
        cur = { t: '', m: [] };
      }
    };
    for (let w of words) {
      // hard-split words longer than a line
      while (w.t.length > TEXT_COLS) {
        flush();
        lines.push({
          text: w.t.slice(0, TEXT_COLS),
          marks: w.m.slice(0, TEXT_COLS),
        });
        w = { t: w.t.slice(TEXT_COLS), m: w.m.slice(TEXT_COLS) };
      }
      if (cur.t === '') cur = { t: w.t, m: [...w.m] };
      else if (cur.t.length + 1 + w.t.length <= TEXT_COLS)
        cur = { t: cur.t + ' ' + w.t, m: [...cur.m, 0, ...w.m] };
      else {
        flush();
        cur = { t: w.t, m: [...w.m] };
      }
    }
    flush();
    pi = pe + 1;
  }
  return lines;
}

export function wrapText(text: string, style: FontStyle = 'classic'): string[] {
  return wrapTextRich(text, style).map((l) => l.text);
}

/**
 * Canonical glyph identity of a char: the ext char itself, the ascii char
 * itself, or '?' for anything without a dedicated glyph. Font subsetting keys
 * slots by this, so the CHR placer and the encoder agree on what a char
 * resolves to.
 */
export function glyphKey(ch: string, extChars: string): string {
  if (extChars.indexOf(ch) !== -1) return ch;
  const code = ch.charCodeAt(0);
  if (code < FONT_FIRST_CHAR || code >= FONT_FIRST_CHAR + FONT_CHAR_COUNT) return '?';
  return ch;
}

/** Legacy fixed layout: every ascii/ext glyph gets a reserved slot. */
function charToTileStatic(ch: string, extChars: string): number {
  const ext = extChars.indexOf(ch);
  if (ext !== -1) return FONT_EXT_BASE_TILE + ext;
  let code = ch.charCodeAt(0);
  if (code < FONT_FIRST_CHAR || code >= FONT_FIRST_CHAR + FONT_CHAR_COUNT) code = 0x3f; // '?'
  return code - FONT_FIRST_CHAR + FONT_BASE_TILE;
}

/**
 * Char → CHR slot. With a subset map (`slotOf`, from collectFontChars) only
 * used glyphs are placed and slots are compacted; without it the fixed legacy
 * layout is used (keeps unit-test byte expectations stable).
 */
function charToTile(
  ch: string,
  extChars: string,
  slotOf?: Map<string, number>,
): number {
  if (slotOf)
    return (
      slotOf.get(glyphKey(ch, extChars)) ??
      slotOf.get('?') ??
      charToTileStatic(ch, extChars)
    );
  return charToTileStatic(ch, extChars);
}

/**
 * Every glyph the game actually renders — static UI (title, PRESS START, THE
 * END) plus all dialog text — canonicalized (glyphKey) and deduped in slot
 * order. ' ' and '?' (unknown fallback) always take the first two slots so the
 * font never lacks a space or a fallback glyph.
 */
export function collectFontChars(
  title: string,
  dialogTexts: string[],
  style: FontStyle,
  extChars: string,
): string[] {
  const seen = new Set<string>([' ', '?']);
  const addStatic = (t: string) => {
    const src = style === 'katakana' ? normalizeKana(t) : t;
    for (const ch of src.toUpperCase()) seen.add(glyphKey(ch, extChars));
  };
  addStatic(title.slice(0, 30));
  addStatic('PRESS START');
  addStatic('THE END');
  for (const t of dialogTexts)
    for (const line of wrapTextRich(t, style))
      for (const ch of line.text) seen.add(glyphKey(ch, extChars));
  return [...seen];
}

export function encodeDialog(
  text: string,
  style: FontStyle = 'classic',
  line2Tiles?: Map<string, number>,
  colorTiles?: Map<string, number>,
  colorLine2Tiles?: Map<string, number>,
  wavyTiles?: Map<string, number>,
  wavyColorTiles?: Map<string, number>,
  extChars: string = fontExtChars(style),
  slotOf?: Map<string, number>,
): number[] {
  const lines = wrapTextRich(text, style);
  const out: number[] = [];
  // when both appear in one dialog, cycle wins (emitted last, engine keeps it)
  if (lines.some((l) => l.marks.some((m) => m & FX_BLINK))) out.push(DLG_BLINK);
  if (lines.some((l) => l.marks.some((m) => m & FX_CYCLE))) out.push(DLG_CYCLE);
  lines.forEach((line, i) => {
    if (i > 0) {
      out.push(i % TEXT_LINES_PER_PAGE === 0 ? DLG_PAGE : DLG_NEWLINE);
    }
    const onLine2 = i % TEXT_LINES_PER_PAGE === 1;
    [...line.text].forEach((ch, j) => {
      const mark = line.marks[j] ?? 0;
      let tile: number | undefined;
      if (mark & FX_WAVE && ch !== ' ') {
        // wave pair: even tile = base ink, +1 = 1px down (line 2 starts shifted)
        const base =
          mark & FX_COLOR_MASK ? wavyColorTiles?.get(ch) : wavyTiles?.get(ch);
        if (base !== undefined) tile = base + (onLine2 ? 1 : 0);
      } else if (mark & FX_COLOR_MASK && ch !== ' ')
        tile = onLine2
          ? (colorLine2Tiles?.get(ch) ?? colorTiles?.get(ch))
          : colorTiles?.get(ch);
      if (tile === undefined && onLine2) tile = line2Tiles?.get(ch);
      out.push(tile ?? charToTile(ch, extChars, slotOf));
    });
  });
  out.push(DLG_END);
  return out;
}

/** Pages preview for the editor: array of pages, each up to 2 lines. */
export function paginate(text: string, style: FontStyle = 'classic'): string[][] {
  const lines = wrapText(text, style);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += TEXT_LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + TEXT_LINES_PER_PAGE));
  }
  return pages;
}

/** Plain text → tile index bytes (for titles etc.), no wrapping. */
export function textToTiles(
  text: string,
  style: FontStyle = 'classic',
  extChars: string = fontExtChars(style),
  slotOf?: Map<string, number>,
): number[] {
  const src = style === 'katakana' ? normalizeKana(text) : text;
  return [...src.toUpperCase()].map((ch) => charToTile(ch, extChars, slotOf));
}
