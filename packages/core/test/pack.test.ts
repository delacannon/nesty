import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  cartridgeGeometry,
  catQuest,
  frameCartridge,
  helloWorld,
  packGame,
  sampleGame,
  serialize,
  theThing,
  unframeCartridge,
  unpackGame,
  validate,
  type GameData,
} from '../src';

const games: [string, () => GameData][] = [
  ['helloWorld', helloWorld],
  ['catQuest', catQuest],
  ['theThing', theThing],
  ['sample', sampleGame],
];

describe('binary pack codec', () => {
  for (const [name, fn] of games) {
    it(`${name}: round-trips exactly`, () => {
      const g = fn();
      const back = unpackGame(packGame(g));
      expect(back).toEqual(g);
      // and the decoded game is still valid
      expect(validate(back).filter((d) => d.severity === 'error')).toEqual([]);
    });

    it(`${name}: deflated pack beats deflated text by a wide margin`, () => {
      const g = fn();
      const packed = packGame(g);
      const gz = deflateRawSync(packed, { level: 9 }).length;
      const textGz = deflateRawSync(serialize(g), { level: 9 }).length;
      // eslint-disable-next-line no-console
      console.log(
        `${name}: raw pack=${packed.length}B  deflate=${gz}B  ` +
          `(vs deflated text ${textGz}B)`,
      );
      // the binary codec is meaningfully smaller than compressing the text
      expect(gz).toBeLessThan(textGz * 0.9);
      // and hard-capped so a regression that bloats the format is caught
      expect(gz).toBeLessThan(3200);
    });
  }

  it('rejects non-pack bytes', () => {
    expect(() => unpackGame(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('frames a game into a cartridge pixel grid and back', () => {
    const g = helloWorld();
    const packed = deflateRawSync(packGame(g), { level: 9 });
    const scale = 4;
    const { side, rgb } = frameCartridge(new Uint8Array(packed), scale);
    // grid holds the payload and stays a sane label size
    expect(side * side * 3).toBeGreaterThanOrEqual(packed.length + 8);
    expect(side).toBeLessThanOrEqual(64);

    // simulate a ×scale nearest-neighbour upscale, then sample block top-lefts
    const W = side * scale;
    const big = new Uint8Array(W * W * 3);
    for (let i = 0; i < side * side; i++) {
      const col = i % side;
      const row = (i / side) | 0;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = ((row * scale + dy) * W + (col * scale + dx)) * 3;
          big[o] = rgb[i * 3]!;
          big[o + 1] = rgb[i * 3 + 1]!;
          big[o + 2] = rgb[i * 3 + 2]!;
        }
    }
    const readNative = (cx: number, cy: number): [number, number, number] => {
      const o = (cy * W + cx) * 3;
      return [big[o]!, big[o + 1]!, big[o + 2]!];
    };
    const { scale: s2, side: side2 } = cartridgeGeometry(readNative(0, 0));
    expect(s2).toBe(scale);
    expect(side2).toBe(side);
    const recovered = unframeCartridge((i) =>
      readNative((i % side2) * s2, ((i / side2) | 0) * s2),
    );
    expect(Buffer.from(recovered).equals(Buffer.from(packed))).toBe(true);
    // and the whole pipeline reconstructs the game
    expect(unpackGame(inflateRawSync(recovered))).toEqual(g);
  });
});
