import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  current: (ConfirmOptions & { resolve: (v: boolean) => void }) | null;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  resolve: (v: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  ask: (o) =>
    new Promise<boolean>((resolve) => {
      // if a prompt is already open, dismiss it as cancelled first
      get().current?.resolve(false);
      set({ current: { ...o, resolve } });
    }),
  resolve: (v) => {
    const c = get().current;
    if (c) {
      c.resolve(v);
      set({ current: null });
    }
  },
}));

/** Imperatively ask for confirmation; resolves true if the user confirms. */
export const confirmAction = (o: ConfirmOptions) => useConfirm.getState().ask(o);
