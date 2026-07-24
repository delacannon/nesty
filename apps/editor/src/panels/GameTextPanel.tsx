import { useEffect, useRef, useState } from 'react';
import { buildRom, type BuildResult } from '@nesty/compiler';
import {
  bitsyToNesty,
  helloWorld,
  nostromo,
  serialize,
  validate,
  type GameData,
} from '@nesty/core';
import { download, fileStem } from '../download';
import { decodeGameImage } from '../cartridge';
import { decodeGameFile, encodeGameFile } from '../gamefile';
import { confirmAction } from '../store/confirmStore';
import { useGameStore } from '../store/gameStore';

// shared warning for every action that overwrites the whole game
const REPLACE_WARN =
  'This replaces your entire current game — rooms, art, palettes, dialogs, everything. Your current game is kept in undo history (Ctrl+Z).';
const confirmReplace = (what: string) =>
  confirmAction({
    title: 'Attention',
    message: `${what}\n\n${REPLACE_WARN}`,
    confirmLabel: 'Replace game',
    danger: true,
  });

export function GameTextPanel() {
  const s = useGameStore();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [build, setBuild] = useState<BuildResult | null>(null);
  const [packInfo, setPackInfo] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // download the game as an ultra-compressed, re-importable .nesty file
  const saveCompressed = async () => {
    const g = useGameStore.getState().game;
    const bytes = await encodeGameFile(g);
    download(
      fileStem(g.title) + '.nesty',
      bytes,
      'application/octet-stream',
    );
    setPackInfo(`saved ${(bytes.length / 1024).toFixed(2)} KB compressed`);
  };

  // textarea import: auto-detect Bitsy data and convert, else parse as NESty
  const importFromText = async () => {
    if (!(await confirmReplace('Import the game data in the editor?'))) return;
    if (/#\s*BITSY\s+VERSION/i.test(text)) {
      const { game, warnings } = bitsyToNesty(text);
      applyLoaded(
        game,
        warnings.length
          ? `imported from Bitsy · ${warnings.length} note(s): ${warnings.join('; ')}`
          : 'imported from Bitsy',
      );
      return;
    }
    setErrors(s.importText(text));
  };

  const applyLoaded = (game: GameData, note: string) => {
    const errs = validate(game).filter((d) => d.severity === 'error');
    if (errs.length) {
      setErrors(errs.map((d) => d.message));
      return;
    }
    useGameStore.getState().loadGame(game);
    setText(serialize(game));
    setErrors([]);
    setPackInfo(note);
  };

  const loadCompressed = async (file: File) => {
    if (!(await confirmReplace(`Load "${file.name}"?`))) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // PNG cartridge or raw .nesty container — sniff by PNG signature
      const isPng =
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
      const game = isPng
        ? await decodeGameImage(file)
        : await decodeGameFile(bytes);
      applyLoaded(game, `loaded ${(bytes.length / 1024).toFixed(2)} KB`);
    } catch (e) {
      setErrors([`import failed: ${(e as Error).message}`]);
    }
  };


  useEffect(() => {
    setText(serialize(useGameStore.getState().game));
    setErrors([]);
  }, []);

  // keep the ROM card in sync with the game (debounced like the status bar)
  useEffect(() => {
    const t = setTimeout(() => setBuild(buildRom(s.game)), 600);
    return () => clearTimeout(t);
  }, [s.game]);

  return (
    <div className='panel w-data'>
      <header>data</header>
      <div className='body data-wrap'>
        <div className='toolbar'>
          <button
            className='primary'
            title='import NESty data, or paste Bitsy game data to convert it'
            onClick={() => void importFromText()}
          >
            import
          </button>
          <button
            onClick={() => setText(serialize(useGameStore.getState().game))}
          >
            refresh from editor
          </button>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(text);
            }}
          >
            copy
          </button>
          <button
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              if (
                await confirmAction({
                  title: 'Attention',
                  message:
                    'Start a new blank game? Your current game is kept in undo history (Ctrl+Z).',
                  confirmLabel: 'New game',
                  danger: true,
                })
              )
                useGameStore.getState().newGame();
            }}
          >
            new game
          </button>
        </div>
        <div className='field-row'>
          <label>examples</label>
          <button
            className='small'
            title='feature tour: flags, vars, events, overlays, all transitions'
            onClick={async () => {
              if (!(await confirmReplace('Load the "hello world quest" example?')))
                return;
              const t = serialize(helloWorld());
              setText(t);
              setErrors(useGameStore.getState().importText(t));
            }}
          >
            load hello world quest
          </button>
          <button
            className='small'
            title='ALIEN (1979) homage: 5 rooms, power/code/override gating, MU-TH-UR, a lurking xenomorph, all transitions'
            onClick={async () => {
              if (!(await confirmReplace('Load the "NOSTROMO" example?'))) return;
              const t = serialize(nostromo());
              setText(t);
              setErrors(useGameStore.getState().importText(t));
            }}
          >
            load NOSTROMO (alien)
          </button>
        </div>
        {errors.map((e, i) => (
          <div className='diag' key={i}>
            {e}
          </div>
        ))}
        <textarea
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className='toolbar'>
          <button
            disabled={!build?.ok || !build.rom}
            title='download iNES ROM'
            onClick={() =>
              build?.rom &&
              download(
                fileStem(s.game.title) + '.nes',
                build.rom,
                'application/octet-stream',
              )
            }
          >
            ⬇ .nes
          </button>
          <button
            disabled={!build?.asm}
            title='download generated assembly'
            onClick={() =>
              build?.asm &&
              download(fileStem(s.game.title) + '.asm', build.asm, 'text/plain')
            }
          >
            ⬇ .asm
          </button>
          <button
            style={{ marginLeft: 'auto' }}
            title='download an ultra-compressed, re-importable game file'
            onClick={() => void saveCompressed()}
          >
            ⬇ .nesty (min)
          </button>
          <button
            title='import a .nesty file or cartridge PNG'
            onClick={() => fileInput.current?.click()}
          >
            ⬆ import file
          </button>
          <input
            ref={fileInput}
            type='file'
            accept='.nesty,.png,image/png,application/octet-stream'
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadCompressed(f);
              e.target.value = '';
            }}
          />
        </div>
        {packInfo && <div className='keys'>{packInfo}</div>}
        <div className='keys'>
          <b>←→↑↓</b> walk · <b>Z</b> A (talk / advance) · <b>Enter</b> start
        </div>
        {build?.ok && build.report && (
          <div className='keys'>
            PRG {build.report.prgUsed}/32768 · BG CHR {build.report.bgChrUsed}
            /256 · SPR CHR {build.report.sprChrUsed}/256 ·{' '}
            {build.report.dialogBytes}B dialog
          </div>
        )}
      </div>
    </div>
  );
}
