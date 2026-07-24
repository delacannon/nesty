/**
 * Song → ROM tables for the engine music driver.
 *
 * Per song three blobs (+ lo/hi pointer table pairs, like sfx):
 *   song_i (117 bytes, fixed offsets — everything (mus_ptr),y-reachable):
 *     +0   frames per row: clamp(round(900/bpm), 3, 30)  ; 16 steps = one 4/4 bar
 *     +1   order length
 *     +2   lead ctrl  = duty<<6 | decay   ; APU envelope mode (bits 5,4 clear)
 *     +3   melody ctrl
 *     +4   drum ctrl  = drumDecay
 *     +5   lead pitch lo ×16    +21  lead pitch hi ×16   (| $08 length load)
 *     +37  melody pitch lo ×16  +53  melody pitch hi ×16
 *     +69  bass pitch lo ×16    +85  bass pitch hi ×16   (triangle formula)
 *     +101 noise period ×16     (drumMode metallic sets bit 7 = tonal)
 *   song_ord_i: order bytes (pattern indices)
 *   song_pat_i: per pattern 64 bytes = lead[16] melody[16] bass[16] drum[16]
 *               step byte: 0 = rest, 1..16 = pitch row + 1
 */
import { rowFreq, SONG_ROWS, SONG_STEPS, type Song } from '@nesty/core';
import { notePeriod } from './sfxgen';

const CPU_HZ = 1789773;

/** Triangle sounds one octave below a pulse at the same period value. */
export function trianglePeriod(freq: number): number {
  return Math.max(8, Math.min(0x7ff, Math.round(CPU_HZ / (32 * freq)) - 1));
}

export function songFramesPerRow(bpm: number): number {
  return Math.max(3, Math.min(30, Math.round(900 / bpm)));
}

export const SONG_BLOB_SIZE = 117;

/** noise period per grid row, bottom = kick-ish booms, top = hats */
const NOISE_ROWS = [
  0x0e, 0x0d, 0x0c, 0x0b, 0x0a, 0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x06,
  0x03, 0x02, 0x01, 0x00,
];

export function encodeSongBlob(song: Song): number[] {
  const bytes: number[] = [
    songFramesPerRow(song.bpm),
    song.order.length,
    ((song.lead.duty & 3) << 6) | (song.lead.decay & 0x0f),
    ((song.melody.duty & 3) << 6) | (song.melody.decay & 0x0f),
    song.drumDecay & 0x0f,
  ];
  const rows = [...Array(SONG_ROWS)];
  const pushTable = (periods: number[]) => {
    bytes.push(...periods.map((p) => p & 0xff));
    bytes.push(...periods.map((p) => ((p >> 8) & 7) | 0x08));
  };
  pushTable(rows.map((_, r) => notePeriod(rowFreq(song, r, 'lead'))));
  pushTable(rows.map((_, r) => notePeriod(rowFreq(song, r, 'melody'))));
  pushTable(rows.map((_, r) => trianglePeriod(rowFreq(song, r, 'bass'))));
  bytes.push(...NOISE_ROWS.map((p) => (song.drumMode ? p | 0x80 : p)));
  return bytes;
}

export function encodeSongOrder(song: Song): number[] {
  return song.order.map((o) => Math.max(0, Math.min(song.patterns.length - 1, o)));
}

export function encodeSongPatterns(song: Song): number[] {
  const bytes: number[] = [];
  for (const p of song.patterns) {
    for (const ch of [p.lead, p.melody, p.bass, p.drum]) {
      for (let i = 0; i < SONG_STEPS; i++)
        bytes.push(Math.max(0, Math.min(16, ch[i] ?? 0)));
    }
  }
  return bytes;
}
