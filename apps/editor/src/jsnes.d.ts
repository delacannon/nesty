declare module 'jsnes' {
  export interface NesOptions {
    onFrame?: (frameBuffer: number[]) => void;
    onAudioSample?: (left: number, right: number) => void;
    emulateSound?: boolean;
    sampleRate?: number;
  }
  export class NES {
    constructor(options?: NesOptions);
    loadROM(data: string): void;
    frame(): void;
    reset(): void;
    buttonDown(player: number, button: number): void;
    buttonUp(player: number, button: number): void;
    cpu: { mem: number[] };
  }
  export const Controller: {
    BUTTON_A: number;
    BUTTON_B: number;
    BUTTON_SELECT: number;
    BUTTON_START: number;
    BUTTON_UP: number;
    BUTTON_DOWN: number;
    BUTTON_LEFT: number;
    BUTTON_RIGHT: number;
  };
}
