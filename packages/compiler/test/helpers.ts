import { NES, Controller } from 'jsnes';

export { Controller };

export interface Runner {
  nes: NES;
  frames: (n: number) => void;
  lastFrame: () => number[];
  press: (button: number, framesHeld?: number) => void;
  ramAt: (addr: number) => number;
}

export function bootRom(rom: Uint8Array): Runner {
  let last: number[] = [];
  const nes = new NES({
    onFrame: (fb) => {
      last = fb;
    },
    emulateSound: false,
  });
  let romStr = '';
  for (let i = 0; i < rom.length; i += 0x8000) {
    romStr += String.fromCharCode(...rom.subarray(i, i + 0x8000));
  }
  nes.loadROM(romStr);
  const frames = (n: number) => {
    for (let i = 0; i < n; i++) nes.frame();
  };
  return {
    nes,
    frames,
    lastFrame: () => last,
    press: (button: number, framesHeld = 2) => {
      nes.buttonDown(1, button);
      frames(framesHeld);
      nes.buttonUp(1, button);
      frames(2);
    },
    ramAt: (addr: number) => nes.cpu.mem[addr]!,
  };
}

export function distinctColors(fb: number[]): number {
  return new Set(fb).size;
}
