import { describe, expect, it } from 'vitest';
import { defaultGame, parse, serialize, validate } from '../src';
import type { GameData } from '../src';

function richGame(): GameData {
  const game = defaultGame();
  game.title = 'round trip quest';
  game.flags = [{ id: 'd', name: 'door open' }];
  game.variables = [{ id: 's', name: 'score', initial: 3 }];
  game.dialogs = { c: 'Hello there.\nSecond line.', e: 'The end.' };
  game.sprites = [
    {
      id: 'c',
      name: 'cat',
      frames: game.avatar.frames,
      sprPal: 1,
      dlgId: 'c',
      room: '0',
      x: 4,
      y: 6,
    },
  ];
  game.items = [{ id: 'k', name: 'key', frames: [game.avatar.frames[0]!], sprPal: 2, dlgId: 'e' }];
  game.sprites[0]!.altCond = { kind: 'item', itemId: 'k', negate: false };
  game.sprites[0]!.altDlgId = 'e';
  const room = game.rooms[0]!;
  room.exits.push({ x: 15, y: 7, destRoom: '0', destX: 1, destY: 7 });
  room.exits.push({
    x: 0,
    y: 7,
    destRoom: '0',
    destX: 14,
    destY: 7,
    req: { kind: 'item', itemId: 'k', negate: true },
    lockedDlgId: 'c',
  });
  room.endings.push({ x: 8, y: 3, dlgId: 'e' });
  room.endings.push({ x: 9, y: 3, dlgId: 'e', req: { kind: 'item', itemId: 'k', negate: false } });
  room.items.push({ itemId: 'k', x: 3, y: 9 });
  room.items.push({ itemId: 'k', x: 4, y: 9, appearCond: { kind: 'flag', flagId: 'd', negate: false } });
  room.overlays.push({ x: 5, y: 5, tileId: 'a', cond: { kind: 'var', varId: 's', cmp: '>=', value: 5 } });
  room.events.push({
    x: 6,
    y: 6,
    once: true,
    cond: { kind: 'count', itemId: 'k', cmp: '>=', value: 2 },
    actions: [
      { type: 'setFlag', flagId: 'd' },
      { type: 'addVar', varId: 's', delta: -2 },
      { type: 'setVar', varId: 's', value: 9 },
      { type: 'spriteAnim', spriteId: 'c', mode: 'f1' },
      { type: 'showDialog', dlgId: 'c' },
    ],
  });
  room.events.push({ x: 7, y: 6, actions: [{ type: 'toggleFlag', flagId: 'd' }] });
  game.sprites[0]!.appearCond = { kind: 'flag', flagId: 'd', negate: true };
  room.pmap[17] = 2;
  game.sfx.walk = [{ freq: 220, frames: 3, vol: 4, duty: 1 }];
  game.sfx.pickup = [
    { freq: 440, frames: 2, vol: 8, duty: 2 },
    { freq: 880, frames: 6, vol: 8, duty: 3 },
  ];
  // second song + room assignment (defaultGame already carries 'town')
  // directional avatar art + movement options
  game.avatar.framesUp = [game.avatar.frames[0]!.slice()];
  game.avatar.framesDown = game.avatar.frames.map((f) => f.slice());
  game.avatar.flipOnMove = true;
  game.smoothMove = true;
  game.moveSpeed = 8;
  game.moveCont = true;
  game.songs.push({
    id: 'b',
    name: 'battle-ish',
    bpm: 132,
    root: 57,
    scale: 'minor',
    lead: { duty: 3, decay: 5, octave: 1 },
    melody: { duty: 0, decay: 12, octave: -1 },
    bassOctave: -1,
    drumDecay: 6,
    drumMode: 1,
    patterns: [
      {
        lead: [1, 0, 3, 0, 5, 0, 3, 0, 1, 0, 3, 0, 6, 0, 5, 0],
        melody: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        bass: [1, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0],
        drum: [1, 0, 14, 0, 8, 0, 14, 0, 1, 0, 14, 0, 8, 0, 14, 16],
      },
    ],
    order: [0, 0],
  });
  return game;
}

describe('text format round trip', () => {
  it('serialize -> parse -> serialize is stable', () => {
    const g1 = richGame();
    const text1 = serialize(g1);
    const { game: g2, errors } = parse(text1);
    expect(errors).toEqual([]);
    const text2 = serialize(g2);
    expect(text2).toBe(text1);
  });

  it('parsed game deep-equals original', () => {
    const g1 = richGame();
    const { game: g2 } = parse(serialize(g1));
    expect(g2.title).toBe(g1.title);
    expect(g2.rooms).toEqual(g1.rooms);
    expect(g2.tiles).toEqual(g1.tiles);
    expect(g2.sprites).toEqual(g1.sprites);
    expect(g2.items).toEqual(g1.items);
    expect(g2.dialogs).toEqual(g1.dialogs);
    expect(g2.avatar).toEqual(g1.avatar);
    expect(g2.palettes).toEqual(g1.palettes);
    expect(g2.sfx).toEqual(g1.sfx);
    expect(g2.songs).toEqual(g1.songs);
    expect(g2.rooms[0]!.songId).toBe('town');
    expect(g2.flags).toEqual(g1.flags);
    expect(g2.variables).toEqual(g1.variables);
  });

  it('legacy item cond tokens still parse', () => {
    const roomBlock =
      'ROOM 9\nNAME r9\nPAL 0\n' +
      '0000000000000000\n'.repeat(15) +
      'EXT 0,0 9 1,1 ?!k x\nEND x 2,2 ?k\n';
    const { game, errors } = parse(roomBlock);
    expect(errors).toEqual([]);
    const r9 = game.rooms.find((r) => r.id === '9')!;
    expect(r9.exits[0]!.req).toEqual({ kind: 'item', itemId: 'k', negate: true });
    expect(r9.endings[0]!.req).toEqual({ kind: 'item', itemId: 'k', negate: false });
  });

  it('new cond tokens parse', () => {
    const roomBlock =
      'ROOM 9\nNAME r9\nPAL 0\n' +
      '0000000000000000\n'.repeat(15) +
      'EXT 0,0 9 1,1 ?k>=10 x\n' +
      'OVL 5,5 a ?*door\n' +
      'EVT 6,6 once ?$score!=0 : flag+ door; var+ score 1\n';
    const { game, errors } = parse(roomBlock);
    expect(errors).toEqual([]);
    const r9 = game.rooms.find((r) => r.id === '9')!;
    expect(r9.exits[0]!.req).toEqual({ kind: 'count', itemId: 'k', cmp: '>=', value: 10 });
    expect(r9.overlays[0]).toEqual({
      x: 5,
      y: 5,
      tileId: 'a',
      cond: { kind: 'flag', flagId: 'door', negate: false },
    });
    expect(r9.events[0]).toEqual({
      x: 6,
      y: 6,
      once: true,
      cond: { kind: 'var', varId: 'score', cmp: '!=', value: 0 },
      actions: [
        { type: 'setFlag', flagId: 'door' },
        { type: 'addVar', varId: 'score', delta: 1 },
      ],
    });
  });

  it('validate catches bad song references', () => {
    const g = defaultGame();
    g.rooms[0]!.songId = 'nope';
    g.songs[0]!.order = [7];
    const errors = validate(g).filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('default game validates clean', () => {
    expect(validate(defaultGame()).filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('validate catches broken references', () => {
    const g = defaultGame();
    g.startRoom = 'zz';
    g.rooms[0]!.exits.push({ x: 0, y: 0, destRoom: 'nope', destX: 0, destY: 0 });
    const errors = validate(g).filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
