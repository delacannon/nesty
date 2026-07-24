import { describe, expect, it } from 'vitest';
import { bitsyToNesty, validate } from '../src';

const SAMPLE = `Write your game's title here

# BITSY VERSION 8.15

! VER_MAJ 8
! VER_MIN 15
! ROOM_FORMAT 1
! DLG_COMPAT 0
! TXT_MODE 0

PAL 0
0,82,204
128,159,255
255,255,255
NAME blueprint

ROOM 0
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
0,a,a,a,a,a,a,a,a,a,a,a,a,a,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0
0,a,a,a,a,a,a,a,a,a,a,a,a,a,a,0
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
NAME example room
PAL 0
TUNE 2

TIL a
11111111
10000001
10000001
10011001
10011001
10000001
10000001
11111111
NAME block

SPR A
00011000
00011000
00011000
00111100
01111110
10111101
00100100
00100100
POS 0 4,4

SPR a
00000000
00000000
01010001
01110001
01110010
01111100
00111100
00100100
NAME cat
DLG 0
POS 0 8,12
BLIP 1

ITM 0
00000000
00000000
00000000
00111100
01100100
00100100
00011000
00000000
NAME tea
DLG 1

ITM 1
00000000
00111100
00100100
00111100
00010000
00011000
00010000
00011000
NAME key
DLG 2
BLIP 2

DLG 0
I'm a cat
NAME cat dialog

DLG 1
You found a nice warm cup of tea
NAME tea dialog

DLG 2
A key! {wvy}What does it open?{wvy}
NAME key dialog

VAR a
42

TUNE 2
0,0,2s,0,0,0,0,0
NAME tuneful town

BLIP 1
E5,B5,B5
NAME meow
`;

describe('bitsy import', () => {
  it('converts the sample without validation errors', () => {
    const { game, warnings } = bitsyToNesty(SAMPLE);
    expect(validate(game).filter((d) => d.severity === 'error')).toEqual([]);

    expect(game.title).toBe("Write your game's title here");
    expect(game.rooms).toHaveLength(1);
    // 16 wide × 15 tall
    expect(game.rooms[0]!.tiles).toHaveLength(240);
    // avatar came from SPR A, positioned by POS
    expect(game.startRoom).toBe('0');
    expect(game.startX).toBe(4);
    expect(game.startY).toBe(4);
    // one tile, one sprite (cat), two items (tea, key)
    expect(game.tiles.map((t) => t.id)).toEqual(['a']);
    expect(game.sprites.map((s) => s.id)).toEqual(['a']);
    expect(game.items.map((i) => i.id)).toEqual(['0', '1']);
    // dialog keys namespaced, wavy markup translated
    expect(game.dialogs['d0']).toBe("I'm a cat");
    expect(game.dialogs['d2']).toContain('[wave]What does it open?[/wave]');
    expect(game.sprites[0]!.dlgId).toBe('d0');
    // variable preserved
    expect(game.variables).toEqual([{ id: 'a', name: 'a', initial: 42 }]);
    // music not translated -> warning + fallback song
    expect(warnings.join(' ')).toMatch(/music/i);
    expect(game.songs).toHaveLength(1);
  });

  it('scales 8×8 art to a 16×16 frame', () => {
    const { game } = bitsyToNesty(SAMPLE);
    const f = game.tiles[0]!.frames[0]!;
    expect(f).toHaveLength(256);
    // top-left Bitsy pixel is '1' -> 2×2 block of 1s at the frame's corner
    expect([f[0], f[1], f[16], f[17]]).toEqual([1, 1, 1, 1]);
  });
});
