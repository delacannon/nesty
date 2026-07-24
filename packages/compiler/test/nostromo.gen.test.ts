/**
 * NOSTROMO generator/verifier. The game itself lives in
 * packages/core/src/nostromo.ts (exported as an editor example). This builds
 * it to a ROM, asserts it is clean and fully solvable, and writes
 * games/nostromo.{nesty,nes,asm} at the repo root.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bootRom, Controller, type Runner } from './helpers';
import { nostromo, serialize, validate } from '@nesty/core';
import { buildRom } from '../src';

describe('nostromo (generated game)', () => {
  it('validates and builds a clean ROM, and writes it to games/', () => {
    const game = nostromo();

    const problems = validate(game).filter((d) => d.severity === 'error');
    expect(problems).toEqual([]);

    const build = buildRom(game);
    const errs = build.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(build.ok).toBe(true);
    expect(build.rom!.length).toBe(16 + 0x8000 + 0x2000); // header + 32KB PRG + 8KB CHR

    const here = dirname(fileURLToPath(import.meta.url));
    const outDir = join(here, '../../../games');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'nostromo.nesty'), serialize(game));
    writeFileSync(join(outDir, 'nostromo.nes'), build.rom!);
    if (build.asm) writeFileSync(join(outDir, 'nostromo.asm'), build.asm);
  });

  it('is solvable start-to-airlock, and every gate holds', () => {
    // build with instant movement for deterministic scripted input (room/puzzle
    // logic is identical regardless of movement mode)
    const build = buildRom({ ...nostromo(), smoothMove: false });
    expect(build.ok).toBe(true);
    const sym = build.symbols!;
    const S = (n: string) => {
      const v = sym.get(n);
      if (v === undefined) throw new Error(`symbol ${n} missing`);
      return v;
    };
    const run: Runner = bootRom(build.rom!);
    run.frames(10);

    const ST_WALK = 1;
    const ST_DIALOG = 2;
    const ST_ENDING = 3;
    const st = () => run.ramAt(S('game_state'));
    const px = () => run.ramAt(S('player_x'));
    const py = () => run.ramAt(S('player_y'));
    const room = () => run.ramAt(S('cur_room'));
    const settle = () => {
      for (let i = 0; i < 400 && run.ramAt(S('in_load')) !== 0; i++)
        run.frames(1);
      run.frames(150); // let the exit transition (fade/scroll/…) play out fully
    };
    const closeDlg = () => {
      for (let i = 0; i < 60 && st() === ST_DIALOG; i++) {
        run.frames(24);
        run.press(Controller.BUTTON_A);
      }
    };
    const step = (btn: number) => {
      run.press(btn);
      if (st() === ST_DIALOG) closeDlg();
    };
    const go = (btn: number, n: number) => {
      for (let i = 0; i < n; i++) step(btn);
    };
    const U = Controller.BUTTON_UP;
    const D = Controller.BUTTON_DOWN;
    const L = Controller.BUTTON_LEFT;
    const R = Controller.BUTTON_RIGHT;
    const at = (label: string, r: number) => {
      if (room() !== r)
        throw new Error(
          `${label}: expected room ${r}, got ${room()} at (${px()},${py()})`,
        );
    };

    // ---- boot ----
    run.press(Controller.BUTTON_START);
    settle();
    expect(st()).toBe(ST_WALK);
    at('start', 0);

    // ---- room 0 cryo: grab the card, trip the wake log, leave east ----
    go(U, 1); // card at (7,6)
    go(D, 3); // wake event at (7,9)
    go(U, 2); // back to (7,7)
    go(R, 8); // east door -> corridor
    settle();
    at('cryo->corridor', 1);

    // ---- room 1 corridor: throw both breakers (restores power) ----
    go(R, 2);
    go(U, 3); // breaker A at (3,4)
    go(D, 3);
    go(R, 9);
    go(D, 3); // breaker B at (12,10)
    // doors are sealed until power (pw>=2); prove the east door only opens now
    go(U, 3);
    go(R, 3); // east door -> mess
    settle();
    at('power opened east door -> mess', 3);

    // ---- room 3 mess: read the log (code + wakes the alien), take coolant ----
    go(R, 2);
    go(U, 3); // science log at (3,4)
    go(D, 3);
    go(R, 3); // to (6,7)
    go(U, 4); // to (6,3)
    go(R, 1); // coolant at (7,3)
    go(L, 1);
    go(D, 4); // back to (6,7)
    go(L, 6); // west door -> corridor
    settle();
    at('mess->corridor', 1);

    // ---- room 1 -> bridge (north door, needs power) ----
    go(L, 7); // to (7,7)
    go(U, 7); // north door -> bridge
    settle();
    at('corridor->bridge', 2);

    // ---- room 2 bridge: read Order 937 (needs the code) -> override flag ----
    go(U, 7); // 937 console at (7,5)
    go(D, 8); // south door -> corridor
    settle();
    at('bridge->corridor', 1);

    // ---- room 1 -> engineering (south, needs power + access card) ----
    go(D, 13); // south door -> engineering
    settle();
    at('corridor->engineering', 4);

    // ---- room 4 engineering: purge valves 1->2->3, then the airlock ----
    go(D, 4); // to (7,5)
    go(L, 5); // valve 1 at (2,5)
    go(R, 11); // valve 2 at (13,5)
    go(D, 2);
    go(L, 6); // valve 3 at (7,7)
    // descend through the coolant lock, then the 937 override lock, to the plate
    go(D, 1);
    go(L, 3); // to (4,8)
    go(D, 2); // through coolant gap (4,9) into row 10
    go(R, 7); // to (11,10)
    go(D, 2); // through override gap (11,11) into row 12
    go(L, 4); // to (7,12)
    go(D, 1); // airlock plate (7,13) -> ending
    closeDlg();
    expect(st()).toBe(ST_ENDING);
  });
});
