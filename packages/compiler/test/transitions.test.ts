import { describe, expect, it } from 'vitest';
import { blankRoom, defaultGame, type GameData } from '@nesty/core';
import { buildRom } from '../src/index';
import { bootRom, Controller } from './helpers';

const CUR_ROOM = 0x05; // zp cur_room

function twoRoomGame(): GameData {
  const game = defaultGame();
  const r0 = blankRoom('0', game.palettes[0]!.id);
  const r1 = blankRoom('1', game.palettes[0]!.id);
  game.rooms = [r0, r1];
  game.startX = 14;
  game.startY = 7;
  return game;
}

function enterGame(rom: Uint8Array) {
  const r = bootRom(rom);
  r.frames(10);
  r.press(Controller.BUTTON_START, 2);
  r.frames(5);
  return r;
}

describe('exit transitions', () => {
  it('scroll exit reaches the destination room', () => {
    const game = twoRoomGame();
    game.rooms[0]!.exits.push({
      x: 15,
      y: 7,
      destRoom: '1',
      destX: 1,
      destY: 7,
      transition: 'scroll',
    });
    const r = enterGame(buildRom(game).rom!);
    expect(r.ramAt(CUR_ROOM)).toBe(0);
    r.press(Controller.BUTTON_RIGHT, 4); // step onto the exit
    r.frames(120); // scroll anim (~32 frames) + settle
    expect(r.ramAt(CUR_ROOM)).toBe(1);
    // engine is alive and walkable after the transition
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(10);
    expect(r.ramAt(0x06)).toBe(2); // player_x moved 1→2
  });

  it('applies the destination palette as the scroll starts', () => {
    const game = twoRoomGame();
    game.palettes.push({
      ...JSON.parse(JSON.stringify(game.palettes[0]!)),
      id: '1',
      name: 'dest',
      backdrop: 0x21, // light blue — absent from room 0's screen
    });
    game.rooms[1]!.palId = '1';
    game.rooms[0]!.exits.push({
      x: 15,
      y: 7,
      destRoom: '1',
      destX: 1,
      destY: 7,
      transition: 'scroll',
    });
    const r = enterGame(buildRom(game).rom!);
    const before = new Set(r.lastFrame());
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(12); // mid-scroll
    const mid = r.lastFrame();
    expect(mid.some((c) => !before.has(c))).toBe(true); // dest palette on screen
    r.frames(120);
    expect(r.ramAt(CUR_ROOM)).toBe(1);
  });

  it('vertical scroll (south edge) reaches the destination room', () => {
    const game = twoRoomGame();
    game.startX = 7;
    game.startY = 13;
    game.rooms[0]!.exits.push({
      x: 7,
      y: 14,
      destRoom: '1',
      destX: 7,
      destY: 1,
      transition: 'scroll',
    });
    const r = enterGame(buildRom(game).rom!);
    r.press(Controller.BUTTON_DOWN, 4);
    r.frames(150); // 30 prep + 30 scroll frames + settle
    expect(r.ramAt(CUR_ROOM)).toBe(1);
  });

  it('diagonal wipe exit reaches the destination room', () => {
    const game = twoRoomGame();
    game.rooms[0]!.exits.push({
      x: 15,
      y: 7,
      destRoom: '1',
      destX: 1,
      destY: 7,
      transition: 'diag',
    });
    const r = enterGame(buildRom(game).rom!);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(180); // wipe (~40 frames) + settle
    expect(r.ramAt(CUR_ROOM)).toBe(1);
  });

  for (const t of ['fade', 'curtain', 'blinds'] as const) {
    it(`${t} exit reaches the destination room`, () => {
      const game = twoRoomGame();
      game.rooms[0]!.exits.push({
        x: 15,
        y: 7,
        destRoom: '1',
        destX: 1,
        destY: 7,
        transition: t,
      });
      const r = enterGame(buildRom(game).rom!);
      r.press(Controller.BUTTON_RIGHT, 4);
      r.frames(220); // longest: fade 8×6 frames + settle
      expect(r.ramAt(CUR_ROOM)).toBe(1);
      r.press(Controller.BUTTON_RIGHT, 4);
      r.frames(10);
      expect(r.ramAt(0x06)).toBe(2); // still walkable
    });
  }

  it('plain exit still cuts instantly', () => {
    const game = twoRoomGame();
    game.rooms[0]!.exits.push({
      x: 15,
      y: 7,
      destRoom: '1',
      destX: 1,
      destY: 7,
    });
    const r = enterGame(buildRom(game).rom!);
    r.press(Controller.BUTTON_RIGHT, 4);
    r.frames(20);
    expect(r.ramAt(CUR_ROOM)).toBe(1);
  });
});
