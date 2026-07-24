// Tiny in-page NES player: runs the Hello World ROM on jsnes so visitors can
// play a real NESty build right on the landing page. Adapted from the editor's
// NesRunner (apps/editor/src/nes/NesRunner.ts).
import { Controller, NES } from 'jsnes';

const KEYMAP: Record<string, number> = {
  ArrowUp: Controller.BUTTON_UP,
  ArrowDown: Controller.BUTTON_DOWN,
  ArrowLeft: Controller.BUTTON_LEFT,
  ArrowRight: Controller.BUTTON_RIGHT,
  KeyZ: Controller.BUTTON_A,
  KeyX: Controller.BUTTON_B,
  Enter: Controller.BUTTON_START,
  ShiftRight: Controller.BUTTON_SELECT,
  ShiftLeft: Controller.BUTTON_SELECT,
};

const AUDIO_RING = 16384;

class NesRunner {
  private nes: NES;
  private raf = 0;
  private imageData: ImageData;
  private buf32: Uint32Array;
  private running = false;
  private lastTime = 0;
  private acc = 0;

  private audioCtx: AudioContext | null = null;
  private ring = new Float32Array(AUDIO_RING);
  private ringR = 0;
  private ringW = 0;

  constructor(private ctx: CanvasRenderingContext2D) {
    this.imageData = ctx.createImageData(256, 240);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);
    this.nes = new NES({
      onFrame: (fb) => {
        for (let i = 0; i < 256 * 240; i++) this.buf32[i] = 0xff000000 | fb[i]!;
      },
      emulateSound: true,
      sampleRate: 44100,
      onAudioSample: (l, r) => {
        this.ring[this.ringW % AUDIO_RING] = (l + r) / 2;
        this.ringW++;
      },
    });
  }

  get audioOn(): boolean {
    return this.audioCtx !== null;
  }

  /** Must be called from a user gesture. */
  enableAudio(): void {
    if (this.audioCtx) return;
    const ctx = new AudioContext({ sampleRate: 44100 });
    const node = ctx.createScriptProcessor(2048, 0, 1);
    node.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < out.length; i++) {
        out[i] = this.ringR < this.ringW ? this.ring[this.ringR % AUDIO_RING]! : 0;
        if (this.ringR < this.ringW) this.ringR++;
      }
    };
    node.connect(ctx.destination);
    this.audioCtx = ctx;
  }

  disableAudio(): void {
    void this.audioCtx?.close();
    this.audioCtx = null;
  }

  loadRom(rom: Uint8Array): void {
    let s = '';
    for (let i = 0; i < rom.length; i += 0x8000) {
      s += String.fromCharCode(...rom.subarray(i, i + 0x8000));
    }
    this.nes.loadROM(s);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.acc += Math.min(t - this.lastTime, 100);
      this.lastTime = t;
      const frameMs = 1000 / 60;
      while (this.acc >= frameMs) {
        this.nes.frame();
        this.acc -= frameMs;
      }
      this.ctx.putImageData(this.imageData, 0, 0);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  press(btn: number, down: boolean): void {
    if (down) this.nes.buttonDown(1, btn);
    else this.nes.buttonUp(1, btn);
  }

  handleKey(code: string, down: boolean): boolean {
    const btn = KEYMAP[code];
    if (btn === undefined) return false;
    this.press(btn, down);
    return true;
  }
}

const BTN: Record<string, number> = {
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  start: Controller.BUTTON_START,
};

export async function mountNesEmbed(root: HTMLElement): Promise<void> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.nes-canvas');
  const soundBtn = root.querySelector<HTMLButtonElement>('[data-nes="sound"]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-nes="reset"]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let rom: Uint8Array;
  try {
    const res = await fetch('/hello.nes');
    rom = new Uint8Array(await res.arrayBuffer());
  } catch {
    root.classList.add('nes-failed');
    return;
  }

  const runner = new NesRunner(ctx);
  runner.loadRom(rom);
  runner.start();
  root.classList.add('nes-live');

  // capture the keyboard only while the player is engaged, so arrow keys don't
  // hijack page scrolling for everyone else.
  let active = false;
  const setActive = (on: boolean) => {
    active = on;
    root.classList.toggle('nes-active', on);
  };
  root.addEventListener('pointerenter', () => setActive(true));
  root.addEventListener('pointerleave', () => setActive(false));
  canvas.addEventListener('pointerdown', () => {
    setActive(true);
    runner.enableAudio();
    syncSound();
  });

  window.addEventListener('keydown', (e) => {
    if (!active) return;
    if (runner.handleKey(e.code, true)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (!active) return;
    if (runner.handleKey(e.code, false)) e.preventDefault();
  });

  // on-screen touch pad
  root.querySelectorAll<HTMLElement>('[data-btn]').forEach((el) => {
    const btn = BTN[el.dataset.btn!];
    if (btn === undefined) return;
    const down = (e: Event) => {
      e.preventDefault();
      setActive(true);
      runner.enableAudio();
      syncSound();
      runner.press(btn, true);
    };
    const up = (e: Event) => {
      e.preventDefault();
      runner.press(btn, false);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  });

  const syncSound = () => {
    if (soundBtn) soundBtn.textContent = runner.audioOn ? '🔊 Sound on' : '🔈 Sound off';
  };
  soundBtn?.addEventListener('click', () => {
    if (runner.audioOn) runner.disableAudio();
    else runner.enableAudio();
    syncSound();
  });
  resetBtn?.addEventListener('click', () => {
    runner.press(Controller.BUTTON_START, true);
    setTimeout(() => runner.press(Controller.BUTTON_START, false), 60);
  });
  syncSound();

  // don't waste cycles when scrolled away
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) runner.start();
          else runner.stop();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(root);
  }
}
