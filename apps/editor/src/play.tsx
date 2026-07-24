// Standalone fullscreen player. Opened in a new tab from the editor's play
// mode: the built ROM is handed over through localStorage, decoded here and
// run big — canvas letterboxed to fill the window, plus a real Fullscreen
// button. No React: a bare DOM host keeps the emulator loop simple.
import { NesRunner } from './nes/NesRunner';
import { fromBase64, PLAY_ROM_KEY, PLAY_TITLE_KEY } from './download';

const title = localStorage.getItem(PLAY_TITLE_KEY) || 'NESty';
document.title = `${title} · play`;

const style = document.createElement('style');
style.textContent = `
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden;
    font-family: 'IBM Plex Mono', monospace; color: #cfe; }
  #stage { position: fixed; inset: 0; display: flex; align-items: center;
    justify-content: center; }
  #screen { image-rendering: pixelated; background: #000; }
  #fs { position: fixed; top: 12px; right: 12px; z-index: 3; cursor: pointer;
    background: #12121f; color: #cfe; border: 1px solid #3cbcfc;
    padding: 6px 10px; font: inherit; box-shadow: 3px 3px 0 rgba(0,0,0,.5); }
  #fs:hover { background: #1c1c30; }
  #overlay { position: fixed; inset: 0; z-index: 2; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; background: rgba(0,0,0,.86); text-align: center; }
  #overlay button { cursor: pointer; background: #3cbcfc; color: #000;
    border: none; padding: 14px 26px; font: inherit; font-size: 16px;
    box-shadow: 4px 4px 0 rgba(0,0,0,.5); }
  #overlay .keys { color: #89a; font-size: 12px; line-height: 1.7; }
  #msg { text-align: center; line-height: 1.8; }
`;
document.head.appendChild(style);

const stage = document.createElement('div');
stage.id = 'stage';
document.body.appendChild(stage);

const romB64 = localStorage.getItem(PLAY_ROM_KEY);
if (!romB64) {
  const msg = document.createElement('div');
  msg.id = 'msg';
  msg.innerHTML =
    'No game loaded.<br/>Back in the editor, press <b>▶ play</b> then ' +
    '<b>⛶ new tab</b>.';
  stage.appendChild(msg);
} else {
  const canvas = document.createElement('canvas');
  canvas.id = 'screen';
  canvas.width = 256;
  canvas.height = 240;
  canvas.tabIndex = 0;
  stage.appendChild(canvas);

  // letterbox: fit 256×240 into the window, integer-ish scale, keep aspect
  const fit = () => {
    const scale = Math.max(
      1,
      Math.min(window.innerWidth / 256, window.innerHeight / 240),
    );
    canvas.style.width = `${Math.floor(256 * scale)}px`;
    canvas.style.height = `${Math.floor(240 * scale)}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  const runner = new NesRunner(canvas.getContext('2d')!);
  runner.loadRom(fromBase64(romB64));

  const down = (e: KeyboardEvent) => {
    if (runner.handleKey(e.code, true)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => {
    if (runner.handleKey(e.code, false)) e.preventDefault();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  // Fullscreen toggle (also reachable via the overlay's play button)
  const fsBtn = document.createElement('button');
  fsBtn.id = 'fs';
  fsBtn.textContent = '⛶ fullscreen';
  fsBtn.onclick = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
    canvas.focus();
  };
  document.body.appendChild(fsBtn);

  // Audio + real-time start need a user gesture — gate behind a click overlay.
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  const play = document.createElement('button');
  play.textContent = `▶ play ${title}`;
  const keys = document.createElement('div');
  keys.className = 'keys';
  keys.innerHTML =
    '←→↑↓ walk · <b>Z</b> A · <b>X</b> B · <b>Enter</b> start · ' +
    '<b>Shift</b> select<br/>⛶ button (top-right) for true fullscreen';
  overlay.append(play, keys);
  document.body.appendChild(overlay);

  play.onclick = () => {
    overlay.remove();
    runner.start();
    runner.enableAudio();
    canvas.focus();
    void document.documentElement.requestFullscreen().catch(() => {});
  };
}
