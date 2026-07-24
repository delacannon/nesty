import { assemble } from '@nesty/asm6502';
import type { Diagnostic, GameData } from '@nesty/core';
import { validate } from '@nesty/core';
import engineAsm from '../engine/engine.asm?raw';
import { chrgen } from './chrgen';
import { datagen } from './datagen';
import { buildInes, PRG_SIZE } from './ines';
import { PRG_ORIGIN } from './layout';

export { chrgen } from './chrgen';
export { datagen } from './datagen';
export { buildInes, PRG_SIZE, CHR_SIZE } from './ines';
export * from './dialogEncode';
export * from './font';
export * from './layout';
export * from './sfxgen';
export * from './songgen';

export interface BuildReport {
  prgUsed: number;
  prgFree: number;
  bgChrUsed: number; // tiles of 256
  /** bgChrUsed split: font/UI reserved · dialog glyph variants · tile art */
  bgFontTiles: number;
  bgDialogTiles: number;
  bgTileTiles: number;
  sprChrUsed: number;
  dialogBytes: number;
  roomBytes: number;
}

export interface BuildResult {
  ok: boolean;
  rom?: Uint8Array;
  asm?: string;
  chr?: Uint8Array;
  symbols?: Map<string, number>;
  diagnostics: Diagnostic[];
  report?: BuildReport;
}

const VECTORS = '\ndata_end:\n.org $fffa\n.word nmi, reset, irq\n';

export function buildRom(game: GameData): BuildResult {
  const diagnostics = validate(game);
  if (diagnostics.some((d) => d.severity === 'error')) {
    return { ok: false, diagnostics };
  }

  const chrRes = chrgen(game);
  for (const msg of chrRes.diagnostics)
    diagnostics.push({ severity: 'error', message: msg });
  if (diagnostics.some((d) => d.severity === 'error'))
    return { ok: false, diagnostics };

  const data = datagen(game, chrRes);
  const source = engineAsm + '\n' + data.asm + VECTORS;
  const asmRes = assemble(source, { origin: PRG_ORIGIN });
  for (const e of asmRes.errors)
    diagnostics.push({
      severity: 'error',
      message: `asm line ${e.line}: ${e.message}`,
    });
  if (asmRes.errors.length > 0) return { ok: false, diagnostics, asm: source };

  const dataEnd = asmRes.symbols.get('data_end') ?? 0;
  if (dataEnd > 0xfffa || asmRes.bin.length !== PRG_SIZE) {
    diagnostics.push({
      severity: 'error',
      message: `game data overflows the 32KB ROM by ${dataEnd - 0xfffa} bytes — remove rooms/dialog`,
    });
    return { ok: false, diagnostics, asm: source };
  }
  const prgUsed = dataEnd - PRG_ORIGIN;

  const rom = buildInes(asmRes.bin, chrRes.chr);
  return {
    ok: true,
    rom,
    asm: source,
    chr: chrRes.chr,
    symbols: asmRes.symbols,
    diagnostics,
    report: {
      prgUsed: prgUsed + 6,
      prgFree: PRG_SIZE - prgUsed - 6,
      bgChrUsed: chrRes.bgTilesUsed,
      bgFontTiles: chrRes.bgFontTiles,
      bgDialogTiles: chrRes.bgDialogTiles,
      bgTileTiles: chrRes.bgTileTiles,
      sprChrUsed: chrRes.sprTilesUsed,
      dialogBytes: data.report.dialogBytes,
      roomBytes: data.report.roomBytes,
    },
  };
}
