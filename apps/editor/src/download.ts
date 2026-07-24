/** Trigger a browser download of a generated file. */
export function download(
  name: string,
  data: Uint8Array | string,
  type: string,
) {
  const blob = new Blob(
    [data instanceof Uint8Array ? (data.slice().buffer as ArrayBuffer) : data],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Encode bytes to a base64 string (chunked to dodge call-stack limits). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Decode a base64 string back to bytes. */
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** localStorage keys used to hand a built ROM to the standalone player tab. */
export const PLAY_ROM_KEY = 'nesty:play:rom';
export const PLAY_TITLE_KEY = 'nesty:play:title';

/** Filename stem from a game title. */
export function fileStem(title: string): string {
  return (title || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
