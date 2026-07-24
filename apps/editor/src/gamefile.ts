// Ultra-compressed, re-importable game file: pack the model to dense binary
// (packGame) then deflate-raw it in the browser. A 3-byte magic marks the
// container so import can tell it from a plain .txt export.
import { packGame, unpackGame, type GameData } from '@nesty/core';

const MAGIC = [0x4e, 0x5a, 0x43] as const; // 'NZC'

async function pipe(bytes: Uint8Array, mode: 'deflate-raw'): Promise<Uint8Array>;
async function pipe(
  bytes: Uint8Array,
  mode: 'inflate',
): Promise<Uint8Array>;
async function pipe(bytes: Uint8Array, mode: string): Promise<Uint8Array> {
  const stream =
    mode === 'inflate'
      ? new DecompressionStream('deflate-raw')
      : new CompressionStream('deflate-raw');
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Encode a game to the compressed container bytes (for download). */
export async function encodeGameFile(g: GameData): Promise<Uint8Array> {
  const body = await pipe(packGame(g), 'deflate-raw');
  const out = new Uint8Array(MAGIC.length + body.length);
  out.set(MAGIC, 0);
  out.set(body, MAGIC.length);
  return out;
}

/** Decode compressed container bytes back to a game (for import). */
export async function decodeGameFile(bytes: Uint8Array): Promise<GameData> {
  const hasMagic =
    bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1] && bytes[2] === MAGIC[2];
  if (!hasMagic) throw new Error('not a NESty compressed game file');
  const packed = await pipe(bytes.subarray(MAGIC.length), 'inflate');
  return unpackGame(packed);
}
