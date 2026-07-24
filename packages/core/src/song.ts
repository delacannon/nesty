/**
 * Nanoloop-style song model: 16-step patterns × 4 channels mapped to the
 * NES APU (lead=pulse1, melody=pulse2, bass=triangle, drum=noise), chained
 * by an order list that loops forever.
 */

export interface SongChannelParams {
  duty: 0 | 1 | 2 | 3;
  /** APU envelope decay rate 0-15 (higher = slower fade). */
  decay: number;
  /** octave shift -2..+2 — widens each channel's range beyond the 16 rows */
  octave: number;
}

/** Per channel: 16 steps; 0 = rest, 1..16 = pitch grid row + 1 (1 = bottom). */
export interface SongPattern {
  lead: number[];
  melody: number[];
  bass: number[];
  drum: number[];
}

export type SongScale = 'major' | 'minor' | 'penta' | 'chromatic';

export interface Song {
  id: string;
  name: string;
  /** 40-240; 16 steps = one 4/4 bar. */
  bpm: number;
  /** MIDI note of grid row 0 for lead/melody (bass one octave down). */
  root: number;
  scale: SongScale;
  lead: SongChannelParams;
  melody: SongChannelParams;
  /** bass octave shift -2..+2 (triangle already sits an octave down) */
  bassOctave: number;
  /** noise envelope decay 0-15 */
  drumDecay: number;
  /** 0 = white noise, 1 = metallic (APU tonal mode) */
  drumMode: 0 | 1;
  patterns: SongPattern[];
  /** pattern indices, looped forever */
  order: number[];
}

export const SONG_STEPS = 16;
export const SONG_ROWS = 16;
export const MAX_SONGS = 8;
export const MAX_PATTERNS = 8;
export const MAX_ORDER = 16;

const SCALES: Record<SongScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  penta: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** Semitone offset of a grid row within a scale (wraps into octaves). */
export function scaleSemitones(scale: SongScale, row: number): number {
  const s = SCALES[scale];
  return s[row % s.length]! + 12 * Math.floor(row / s.length);
}

export type SongChannel = 'lead' | 'melody' | 'bass';

/** Frequency in Hz of a grid row (0 = bottom) on a channel, octave applied. */
export function rowFreq(song: Song, row: number, ch: SongChannel = 'melody'): number {
  const oct =
    ch === 'bass' ? song.bassOctave - 1 : song[ch].octave; // bass base −12
  const midi = song.root + scaleSemitones(song.scale, row) + oct * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const steps = (v: number[]): number[] => {
  const out = new Array<number>(SONG_STEPS).fill(0);
  v.forEach((x, i) => {
    if (i < SONG_STEPS) out[i] = x;
  });
  return out;
};

export function blankPattern(): SongPattern {
  return { lead: steps([]), melody: steps([]), bass: steps([]), drum: steps([]) };
}

export function blankSong(id: string): Song {
  return {
    id,
    name: 'song ' + id,
    bpm: 100,
    root: 60,
    scale: 'penta',
    lead: { duty: 2, decay: 9, octave: 0 },
    melody: { duty: 1, decay: 7, octave: 0 },
    bassOctave: 0,
    drumDecay: 4,
    drumMode: 0,
    patterns: [blankPattern()],
    order: [0],
  };
}

/**
 * Bundled example: a calm town loop (original composition).
 * C pentatonic, 84 bpm; A = gentle motif over C/G roots, B = answer over A/G.
 * Stored values are row+1: e.g. 6 = row 5 = C5 on melody, 1 = row 0 = C3 on bass.
 */
export function townSong(): Song {
  return {
    id: 'town',
    name: 'town theme',
    bpm: 84,
    root: 60,
    scale: 'penta',
    lead: { duty: 2, decay: 8, octave: 0 },
    melody: { duty: 1, decay: 9, octave: 0 },
    bassOctave: 0,
    drumDecay: 3,
    drumMode: 0,
    patterns: [
      {
        // A: motif rises and settles
        melody: steps([6, 0, 0, 5, 0, 0, 4, 0, 3, 0, 4, 0, 5, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 6, 0]),
        bass: steps([1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0]),
      },
      {
        // B: answer phrase, ends back home
        melody: steps([4, 0, 0, 5, 0, 0, 6, 0, 8, 0, 6, 0, 5, 0, 4, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0]),
        bass: steps([5, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 14, 0, 15, 0]),
      },
    ],
    order: [0, 0, 1, 0],
  };
}

/**
 * Bundled example: a peaceful field-of-flowers loop (original composition).
 * C major, 76 bpm, 4 patterns A B C D — flowing melody over soft triangle
 * roots (C, F, G), lead echoes an octave up, breeze-light hats.
 */
export function fieldSong(): Song {
  return {
    id: 'field',
    name: 'flower field',
    bpm: 76,
    root: 60,
    scale: 'major',
    lead: { duty: 1, decay: 7, octave: 1 },
    melody: { duty: 2, decay: 10, octave: 0 },
    bassOctave: 0,
    drumDecay: 2,
    drumMode: 0,
    patterns: [
      {
        // A: rise and rest
        melody: steps([8, 0, 0, 5, 0, 0, 3, 0, 4, 0, 5, 0, 6, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
        bass: steps([1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0]),
      },
      {
        // B: answer, reaching up
        melody: steps([6, 0, 0, 8, 0, 0, 9, 0, 8, 0, 6, 0, 5, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]),
        bass: steps([5, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 14, 0, 15, 0]),
      },
      {
        // C: lift, gentle descent
        melody: steps([9, 0, 0, 8, 0, 0, 6, 0, 5, 0, 4, 0, 3, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]),
        bass: steps([4, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 14, 0, 0, 0, 14, 0, 0, 0, 14, 0, 0, 0]),
      },
      {
        // D: settle back home
        melody: steps([4, 0, 5, 0, 6, 0, 5, 0, 3, 0, 2, 0, 1, 0, 0, 0]),
        lead: steps([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
        bass: steps([1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 1, 0, 0, 0]),
        drum: steps([0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      },
    ],
    order: [0, 1, 2, 3],
  };
}
