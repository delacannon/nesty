import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse, serialize } from '@nesty/core';
import { buildRom } from '../src';
import { sampleGame } from './sampleGame';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, 'fixtures/sample.rom.sha256');

// Run `UPDATE_GOLDENS=1 pnpm --filter @nesty/compiler test` after intentional
// engine/compiler changes; review the asm diff in fixtures/sample.asm.
describe('golden ROM', () => {
  it('sample game ROM hash is stable', () => {
    const build = buildRom(sampleGame());
    expect(build.ok).toBe(true);
    const hash = createHash('sha256').update(build.rom!).digest('hex');
    if (process.env.UPDATE_GOLDENS || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, hash + '\n');
      writeFileSync(join(here, 'fixtures/sample.asm'), build.asm!);
    }
    expect(hash).toBe(readFileSync(goldenPath, 'utf8').trim());
  });

  it('game data text round-trips through the compiler identically', () => {
    const g1 = sampleGame();
    const { game: g2, errors } = parse(serialize(g1));
    expect(errors).toEqual([]);
    const rom1 = buildRom(g1).rom!;
    const rom2 = buildRom(g2).rom!;
    expect(Buffer.from(rom2).equals(Buffer.from(rom1))).toBe(true);
  });
});
