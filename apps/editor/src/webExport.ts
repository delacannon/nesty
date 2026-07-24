// Builds a self-contained, itch.io-ready web build as a ZIP:
//   index.html   – player page, canvas shown at NES resolution ×2 (512×480)
//   jsnes.min.js – emulator (UMD, global `jsnes`), inlined at build time
//   player.js    – tiny runner glue (plain JS, no bundler needed)
//   rom.js       – the ROM as base64 (window.NESTY_ROM), so no fetch/CORS
//   game.nes     – the raw ROM too, for other emulators
//   README.txt   – controls + how to upload to itch.io
// Everything runs offline (works on file:// and when itch serves the zip).
import jsnesMin from 'jsnes/dist/jsnes.min.js?raw';
import { toBase64 } from './download';
import { buildZip } from './zip';

/** NES framebuffer is 256×240; itch embeds default to 2× that. */
export const WEB_SCALE = 2;
export const WEB_W = 256 * WEB_SCALE;
export const WEB_H = 240 * WEB_SCALE;

const INDEX_HTML = (title: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
<title>${escapeHtml(title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  #stage { position: fixed; inset: 0; display: flex; align-items: center;
    justify-content: center; }
  /* size set by JS to fill the window at the NES 256:240 aspect ratio */
  #screen { image-rendering: pixelated; background: #000; display: block; }
</style>
</head>
<body>
  <div id="stage">
    <canvas id="screen" width="256" height="240"></canvas>
  </div>
  <script src="jsnes.min.js"></script>
  <script src="rom.js"></script>
  <script src="player.js"></script>
</body>
</html>
`;

// Plain-JS runner: mirrors src/nes/NesRunner.ts but uses the UMD `jsnes`
// global and the base64 ROM in window.NESTY_ROM. No modules, no build step.
const PLAYER_JS = `(function () {
  var jsnes = window.jsnes, C = jsnes.Controller;
  var KEYMAP = {
    ArrowUp: C.BUTTON_UP, ArrowDown: C.BUTTON_DOWN,
    ArrowLeft: C.BUTTON_LEFT, ArrowRight: C.BUTTON_RIGHT,
    KeyZ: C.BUTTON_A, KeyX: C.BUTTON_B,
    Enter: C.BUTTON_START, ShiftRight: C.BUTTON_SELECT, ShiftLeft: C.BUTTON_SELECT,
  };
  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  var img = ctx.createImageData(256, 240);
  var buf32 = new Uint32Array(img.data.buffer);

  // Fill the window while keeping the NES 256:240 aspect ratio (letterbox).
  function fit() {
    var s = Math.min(window.innerWidth / 256, window.innerHeight / 240);
    canvas.style.width = Math.max(1, Math.floor(256 * s)) + 'px';
    canvas.style.height = Math.max(1, Math.floor(240 * s)) + 'px';
  }
  fit();
  window.addEventListener('resize', fit);

  var RING = 16384, ring = new Float32Array(RING), rR = 0, rW = 0;
  var nes = new jsnes.NES({
    emulateSound: true, sampleRate: 44100,
    onFrame: function (fb) { for (var i = 0; i < 256 * 240; i++) buf32[i] = 0xff000000 | fb[i]; },
    onAudioSample: function (l, r) { ring[rW % RING] = (l + r) / 2; rW++; },
  });

  // base64 ROM -> binary string (jsnes.loadROM wants a byte string)
  var b = atob(window.NESTY_ROM), s = '';
  for (var i = 0; i < b.length; i++) s += b[i];
  nes.loadROM(s);

  var running = false, raf = 0, last = 0, acc = 0;
  function loop(t) {
    if (!running) return;
    acc += Math.min(t - last, 100); last = t;
    var fm = 1000 / 60;
    while (acc >= fm) { nes.frame(); acc -= fm; }
    ctx.putImageData(img, 0, 0);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running) return; running = true; last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  // Audio needs a user gesture; enable it once on the first key/pointer.
  var audioOn = false;
  function audio() {
    if (audioOn) return; audioOn = true;
    var actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    var node = actx.createScriptProcessor(2048, 0, 1);
    node.onaudioprocess = function (e) {
      var out = e.outputBuffer.getChannelData(0);
      for (var i = 0; i < out.length; i++) {
        out[i] = rR < rW ? ring[rR % RING] : 0;
        if (rR < rW) rR++;
      }
    };
    node.connect(actx.destination);
  }
  window.addEventListener('keydown', audio);
  window.addEventListener('pointerdown', audio);

  window.addEventListener('keydown', function (e) {
    var btn = KEYMAP[e.code];
    if (btn === undefined) return;
    nes.buttonDown(1, btn); e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    var btn = KEYMAP[e.code];
    if (btn === undefined) return;
    nes.buttonUp(1, btn); e.preventDefault();
  });

  // Auto-start: run the emulator immediately, no play button.
  start();
})();
`;

const README = (title: string, stem: string) => `${title} — NES web build
${'='.repeat(title.length + 16)}

Made with NESty. Runs in the browser via the jsnes emulator.

UPLOAD TO ITCH.IO
  1. Zip stays as-is — do NOT re-zip a folder; index.html must be at the root.
  2. New project -> Kind of project: HTML.
  3. Upload this .zip, tick "This file will be played in the browser".
  4. Set the embed/viewport size to ${WEB_W} x ${WEB_H} (NES resolution x${WEB_SCALE}).
     The game auto-scales to any size while keeping the NES aspect ratio.
  5. Recommended: tick "Fullscreen button" on (itch adds its own).

The game starts automatically. Sound turns on at the first key press
(browsers block audio until you interact).

CONTROLS
  Arrows walk · Z = A · X = B · Enter = Start · Shift = Select

FILES
  index.html     the player page (open it to test locally)
  jsnes.min.js   emulator
  player.js      glue code
  rom.js         the ROM (base64) the player loads
  ${stem}.nes    raw ROM, for standalone emulators
`;

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

/** Assemble the itch.io-ready web build as a ZIP byte array. */
export function buildWebZip(rom: Uint8Array, title: string, stem: string): Uint8Array {
  return buildZip([
    { name: 'index.html', data: INDEX_HTML(title) },
    { name: 'jsnes.min.js', data: jsnesMin },
    { name: 'player.js', data: PLAYER_JS },
    { name: 'rom.js', data: `window.NESTY_ROM=${JSON.stringify(toBase64(rom))};\n` },
    { name: `${stem}.nes`, data: rom },
    { name: 'README.txt', data: README(title, stem) },
  ]);
}
