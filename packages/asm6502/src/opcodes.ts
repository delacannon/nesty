/**
 * All 151 official 6502 opcodes.
 * Addressing modes:
 *  imp implied, acc accumulator, imm #v, zp $nn, zpx $nn,x, zpy $nn,y,
 *  abs $nnnn, abx $nnnn,x, aby $nnnn,y, ind ($nnnn) (jmp only),
 *  izx ($nn,x), izy ($nn),y, rel branch
 */
export type AddrMode =
  | 'imp'
  | 'acc'
  | 'imm'
  | 'zp'
  | 'zpx'
  | 'zpy'
  | 'abs'
  | 'abx'
  | 'aby'
  | 'ind'
  | 'izx'
  | 'izy'
  | 'rel';

export const MODE_SIZE: Record<AddrMode, number> = {
  imp: 1,
  acc: 1,
  imm: 2,
  zp: 2,
  zpx: 2,
  zpy: 2,
  abs: 3,
  abx: 3,
  aby: 3,
  ind: 3,
  izx: 2,
  izy: 2,
  rel: 2,
};

export const OPCODES: Record<string, Partial<Record<AddrMode, number>>> = {
  adc: { imm: 0x69, zp: 0x65, zpx: 0x75, abs: 0x6d, abx: 0x7d, aby: 0x79, izx: 0x61, izy: 0x71 },
  and: { imm: 0x29, zp: 0x25, zpx: 0x35, abs: 0x2d, abx: 0x3d, aby: 0x39, izx: 0x21, izy: 0x31 },
  asl: { acc: 0x0a, zp: 0x06, zpx: 0x16, abs: 0x0e, abx: 0x1e },
  bcc: { rel: 0x90 },
  bcs: { rel: 0xb0 },
  beq: { rel: 0xf0 },
  bit: { zp: 0x24, abs: 0x2c },
  bmi: { rel: 0x30 },
  bne: { rel: 0xd0 },
  bpl: { rel: 0x10 },
  brk: { imp: 0x00 },
  bvc: { rel: 0x50 },
  bvs: { rel: 0x70 },
  clc: { imp: 0x18 },
  cld: { imp: 0xd8 },
  cli: { imp: 0x58 },
  clv: { imp: 0xb8 },
  cmp: { imm: 0xc9, zp: 0xc5, zpx: 0xd5, abs: 0xcd, abx: 0xdd, aby: 0xd9, izx: 0xc1, izy: 0xd1 },
  cpx: { imm: 0xe0, zp: 0xe4, abs: 0xec },
  cpy: { imm: 0xc0, zp: 0xc4, abs: 0xcc },
  dec: { zp: 0xc6, zpx: 0xd6, abs: 0xce, abx: 0xde },
  dex: { imp: 0xca },
  dey: { imp: 0x88 },
  eor: { imm: 0x49, zp: 0x45, zpx: 0x55, abs: 0x4d, abx: 0x5d, aby: 0x59, izx: 0x41, izy: 0x51 },
  inc: { zp: 0xe6, zpx: 0xf6, abs: 0xee, abx: 0xfe },
  inx: { imp: 0xe8 },
  iny: { imp: 0xc8 },
  jmp: { abs: 0x4c, ind: 0x6c },
  jsr: { abs: 0x20 },
  lda: { imm: 0xa9, zp: 0xa5, zpx: 0xb5, abs: 0xad, abx: 0xbd, aby: 0xb9, izx: 0xa1, izy: 0xb1 },
  ldx: { imm: 0xa2, zp: 0xa6, zpy: 0xb6, abs: 0xae, aby: 0xbe },
  ldy: { imm: 0xa0, zp: 0xa4, zpx: 0xb4, abs: 0xac, abx: 0xbc },
  lsr: { acc: 0x4a, zp: 0x46, zpx: 0x56, abs: 0x4e, abx: 0x5e },
  nop: { imp: 0xea },
  ora: { imm: 0x09, zp: 0x05, zpx: 0x15, abs: 0x0d, abx: 0x1d, aby: 0x19, izx: 0x01, izy: 0x11 },
  pha: { imp: 0x48 },
  php: { imp: 0x08 },
  pla: { imp: 0x68 },
  plp: { imp: 0x28 },
  rol: { acc: 0x2a, zp: 0x26, zpx: 0x36, abs: 0x2e, abx: 0x3e },
  ror: { acc: 0x6a, zp: 0x66, zpx: 0x76, abs: 0x6e, abx: 0x7e },
  rti: { imp: 0x40 },
  rts: { imp: 0x60 },
  sbc: { imm: 0xe9, zp: 0xe5, zpx: 0xf5, abs: 0xed, abx: 0xfd, aby: 0xf9, izx: 0xe1, izy: 0xf1 },
  sec: { imp: 0x38 },
  sed: { imp: 0xf8 },
  sei: { imp: 0x78 },
  sta: { zp: 0x85, zpx: 0x95, abs: 0x8d, abx: 0x9d, aby: 0x99, izx: 0x81, izy: 0x91 },
  stx: { zp: 0x86, zpy: 0x96, abs: 0x8e },
  sty: { zp: 0x84, zpx: 0x94, abs: 0x8c },
  tax: { imp: 0xaa },
  tay: { imp: 0xa8 },
  tsx: { imp: 0xba },
  txa: { imp: 0x8a },
  txs: { imp: 0x9a },
  tya: { imp: 0x98 },
};

export function isMnemonic(word: string): boolean {
  return Object.prototype.hasOwnProperty.call(OPCODES, word.toLowerCase());
}
