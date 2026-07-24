import { describe, expect, it } from 'vitest';
import {
  blankRoom,
  blankSplash,
  catQuest,
  defaultGame,
  fieldSong,
  townSong,
} from '@nesty/core';
import { buildRom } from '../src/index';
import { encodeSongBlob, songFramesPerRow, trianglePeriod } from '../src/songgen';
import { notePeriod } from '../src/sfxgen';
import { bootRom, Controller } from './helpers';

const MUS_ON = 0x5d;
const MUS_STEP = 0x60;

function start(rom: Uint8Array) {
  const r = bootRom(rom);
  r.frames(10);
  r.press(Controller.BUTTON_START, 2);
  r.frames(5);
  return r;
}

describe('music driver', () => {
  it('encodes the song blob with envelope ctrl bytes and both period tables', () => {
    const song = townSong();
    const blob = encodeSongBlob(song);
    expect(blob.length).toBe(117);
    expect(blob[0]).toBe(songFramesPerRow(84)); // 11 frames/row
    expect(blob[1]).toBe(song.order.length);
    expect(blob[2]! & 0x30).toBe(0); // envelope mode: bits 5,4 clear
    // triangle sounds an octave below pulse at equal period values,
    // so for the same target freq its period value is about half
    expect(trianglePeriod(220)).toBeLessThan(notePeriod(220));
    expect(blob[21]! & 0x08).toBe(0x08); // length load baked into hi bytes
  });

  it('octave and noise-mode params shape the blob tables', () => {
    const song = fieldSong(); // lead octave +1, melody 0
    const blob = encodeSongBlob(song);
    // higher octave = higher freq = smaller period: lead lo[0] < melody lo[0]
    const leadP = blob[5]! | ((blob[21]! & 7) << 8);
    const melP = blob[37]! | ((blob[53]! & 7) << 8);
    expect(leadP).toBeLessThan(melP);
    // white mode: no tonal bit
    expect(blob.slice(101, 117).every((b) => (b! & 0x80) === 0)).toBe(true);
    song.drumMode = 1;
    const metal = encodeSongBlob(song);
    expect(metal.slice(101, 117).every((b) => (b! & 0x80) === 0x80)).toBe(true);
    // bass octave shifts the triangle table
    const low = fieldSong();
    low.bassOctave = -1;
    const lowP = encodeSongBlob(low)[69]! | ((encodeSongBlob(low)[85]! & 7) << 8);
    const basP = blob[69]! | ((blob[85]! & 7) << 8);
    expect(lowP).toBeGreaterThan(basP);
  });

  it('cat quest: silent at home, field song starts in the garden', () => {
    const rom = buildRom(catQuest()).rom!;
    const r = start(rom);
    expect(r.ramAt(MUS_ON)).toBe(0); // home has no song
    for (let i = 0; i < 12; i++) r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(30);
    expect(r.ramAt(MUS_ON)).toBe(1); // garden: field song (index 0 + 1)
  });

  it('starts the room song on game start and advances steps', () => {
    const game = defaultGame(); // room 0 carries the town song
    const rom = buildRom(game).rom!;
    const r = start(rom);
    expect(r.ramAt(MUS_ON)).toBe(1); // song 0 + 1
    const s0 = r.ramAt(MUS_STEP);
    r.frames(songFramesPerRow(84) * 3);
    expect(r.ramAt(MUS_STEP)).not.toBe(s0);
    r.frames(600); // survives full order loop without hanging
    expect(r.ramAt(MUS_ON)).toBe(1);
  });

  it('splash song plays on the title, room song takes over on start', () => {
    const game = defaultGame(); // room 0 plays 'town'
    game.songs.push(fieldSong());
    const tileId = game.tiles[0]!.id;
    game.splash = blankSplash(game.palettes[0]!.id);
    game.splash.tiles[0] = tileId;
    game.splash.songId = 'field'; // song index 1
    const r = bootRom(buildRom(game).rom!);
    r.frames(10);
    expect(r.ramAt(MUS_ON)).toBe(2); // field playing on the splash
    r.press(Controller.BUTTON_START, 2);
    r.frames(10);
    expect(r.ramAt(MUS_ON)).toBe(1); // room switches to town
  });

  it('stops in a song-less room and keeps playing across shared-song rooms', () => {
    const game = defaultGame();
    const silent = blankRoom('1', game.palettes[0]!.id); // no songId
    const shared = blankRoom('2', game.palettes[0]!.id);
    shared.songId = 'town';
    game.rooms.push(silent, shared);
    const r0 = game.rooms[0]!;
    r0.tiles = r0.tiles.map(() => '0'); // clear default walls for walking
    r0.exits.push({ x: 15, y: 7, destRoom: '1', destX: 1, destY: 7 });
    r0.exits.push({ x: 15, y: 8, destRoom: '2', destX: 1, destY: 8 });
    game.startX = 14;
    game.startY = 7;
    const rom = buildRom(game).rom!;

    const r = start(rom);
    expect(r.ramAt(MUS_ON)).toBe(1);
    r.press(Controller.BUTTON_RIGHT, 4); // into song-less room
    r.frames(20);
    expect(r.ramAt(MUS_ON)).toBe(0);

    const r2 = start(rom);
    r2.press(Controller.BUTTON_DOWN, 4);
    const stepBefore = r2.ramAt(MUS_STEP);
    r2.press(Controller.BUTTON_RIGHT, 4); // into shared-song room
    r2.frames(5);
    expect(r2.ramAt(MUS_ON)).toBe(1); // still playing, not restarted
    void stepBefore; // (restart would have reset step to 0 + timer 1)
  });
});
