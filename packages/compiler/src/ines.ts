/** iNES file builder: 16B header + 32KB PRG + 8KB CHR, mapper 0 (NROM). */

export const PRG_SIZE = 0x8000; // 2 × 16KB, mapped $8000-$FFFF
export const CHR_SIZE = 0x2000; // 8KB

export function buildInes(prg: Uint8Array, chr: Uint8Array): Uint8Array {
  // PRG must be the full 32KB image so the vectors at $FFFA-$FFFF exist.
  if (prg.length !== PRG_SIZE)
    throw new Error(`PRG must be exactly ${PRG_SIZE} bytes (got ${prg.length}); end source with .org $fffa vectors`);
  if (chr.length > CHR_SIZE) throw new Error(`CHR too large: ${chr.length} > ${CHR_SIZE}`);

  const header = new Uint8Array(16);
  header[0] = 0x4e; // 'N'
  header[1] = 0x45; // 'E'
  header[2] = 0x53; // 'S'
  header[3] = 0x1a;
  header[4] = 2; // PRG banks × 16KB
  header[5] = 1; // CHR banks × 8KB
  // mapper 0, horizontal mirroring: $2000≡$2400 (E/W wrap scroll) and a
  // distinct $2800 below (N/S scroll target) for room transitions
  header[6] = 0x00;

  const rom = new Uint8Array(16 + PRG_SIZE + CHR_SIZE);
  rom.set(header, 0);
  rom.set(prg, 16);
  rom.set(chr, 16 + PRG_SIZE); // shorter CHR = zero-padded
  return rom;
}
