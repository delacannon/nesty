import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assemble } from '@nesty/asm6502';
import { buildInes, CHR_SIZE } from '../src/ines';
import { fontChrTiles, FONT_BASE_TILE } from '../src/font';
import { bootRom, distinctColors } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));

function buildHelloRom(): Uint8Array {
  const src = readFileSync(join(here, 'fixtures/hello.asm'), 'utf8');
  const r = assemble(src, { origin: 0x8000 });
  expect(r.errors).toEqual([]);
  expect(r.bin.length).toBe(0x8000);

  const chr = new Uint8Array(CHR_SIZE);
  chr.set(fontChrTiles(), FONT_BASE_TILE * 16);
  return buildInes(r.bin, chr);
}

describe('hello world ROM', () => {
  it('assembles to a full 32KB PRG with vectors', () => {
    const rom = buildHelloRom();
    expect(rom.length).toBe(16 + 0x8000 + 0x2000);
    // reset vector points into PRG
    const lo = rom[16 + 0x7ffc]!;
    const hi = rom[16 + 0x7ffd]!;
    expect(hi).toBeGreaterThanOrEqual(0x80);
    expect((hi << 8) | lo).toBe(0x8000); // reset: is first thing in file
  });

  it('boots in jsnes and renders text', () => {
    const rom = buildHelloRom();
    const run = bootRom(rom);
    run.frames(60);
    const fb = run.lastFrame();
    expect(fb.length).toBe(256 * 240);
    // backdrop + white text = at least 2 distinct colors on screen
    expect(distinctColors(fb)).toBeGreaterThanOrEqual(2);
  });
});
