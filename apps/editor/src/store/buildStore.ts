import { create } from 'zustand';
import type { BuildReport } from '@nesty/compiler';
import type { Diagnostic } from '@nesty/core';

/** Last compiler result, shared by the status bar, build terminal and
 *  download buttons so the ROM is built once per edit. */
interface BuildState {
  ok: boolean;
  report?: BuildReport;
  diagnostics: Diagnostic[];
  rom?: Uint8Array;
  asm?: string;
  built: boolean;
  setResult: (r: Omit<BuildState, 'setResult' | 'built'>) => void;
}

export const useBuildStore = create<BuildState>((set) => ({
  ok: false,
  diagnostics: [],
  built: false,
  setResult: (r) => set({ ...r, built: true }),
}));
