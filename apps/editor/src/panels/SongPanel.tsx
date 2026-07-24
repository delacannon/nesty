import { useEffect, useRef, useState } from 'react';
import type { Song, SongPattern, SongScale } from '@nesty/core';
import {
  blankPattern,
  blankSong,
  fieldSong,
  MAX_ORDER,
  MAX_PATTERNS,
  MAX_SONGS,
  rowFreq,
  SONG_ROWS,
  SONG_STEPS,
  townSong,
} from '@nesty/core';
import { songFramesPerRow } from '@nesty/compiler';
import { useGameStore } from '../store/gameStore';

const CHANNELS = ['lead', 'melody', 'bass', 'drum'] as const;
type Channel = (typeof CHANNELS)[number];

const SCALES: SongScale[] = ['penta', 'major', 'minor', 'chromatic'];
const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const rootLabel = (midi: number) =>
  `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** drum grid zones, bottom to top (mirror engine noise_rows) */
const drumZone = (row: number) =>
  row < 4 ? 'kick' : row < 8 ? 'tom' : row < 12 ? 'snare' : 'hat';

// ---- WebAudio preview: rough APU stand-in --------------------------------

interface Player {
  ctx: AudioContext;
  noise: AudioBuffer;
  timer: number;
  step: number;
  ordPos: number;
  nextTime: number;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function scheduleStep(
  p: Player,
  song: Song,
  pat: SongPattern,
  step: number,
  t: number,
) {
  const stepDur = songFramesPerRow(song.bpm) / 60;
  const tone = (
    v: number,
    ch: 'lead' | 'melody' | 'bass',
    type: OscillatorType,
    decay: number,
    gainMul: number,
  ) => {
    if (v === 0) return;
    const osc = p.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = rowFreq(song, v - 1, ch);
    const g = p.ctx.createGain();
    const vol = 0.12 * gainMul;
    g.gain.setValueAtTime(vol, t);
    const dur =
      ch === 'bass' ? stepDur : Math.min(1.2, ((decay + 1) * 15) / 240);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g).connect(p.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  tone(pat.lead[step]!, 'lead', 'square', song.lead.decay, 1);
  tone(pat.melody[step]!, 'melody', 'square', song.melody.decay, 0.8);
  tone(pat.bass[step]!, 'bass', 'triangle', 15, 1.4);
  const dv = pat.drum[step]!;
  if (dv > 0) {
    const src = p.ctx.createBufferSource();
    src.buffer = p.noise;
    // metallic mode reads brighter/ringier: push the rate up
    const rate = 0.25 + ((dv - 1) / 15) * 3;
    src.playbackRate.value = song.drumMode ? rate * 2.5 : rate;
    const g = p.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.linearRampToValueAtTime(0, t + ((song.drumDecay + 1) * 15) / 240);
    src.connect(g).connect(p.ctx.destination);
    src.start(t);
    src.stop(t + 0.4);
  }
}

// --------------------------------------------------------------------------

export function SongPanel() {
  const s = useGameStore();
  const game = s.game;
  const [songId, setSongId] = useState(game.songs[0]?.id ?? '');
  const [channel, setChannel] = useState<Channel>('melody');
  const [patIdx, setPatIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playCol, setPlayCol] = useState(-1);
  const player = useRef<Player | null>(null);

  const song = game.songs.find((x) => x.id === songId) ?? game.songs[0];
  const pat =
    song?.patterns[Math.min(patIdx, (song?.patterns.length ?? 1) - 1)];

  const mutateSong = (fn: (sg: Song) => void, snap = true) => {
    if (!song) return;
    const st = useGameStore.getState();
    if (snap) st.snapshot();
    st.mutateGame((g) => {
      const sg = g.songs.find((x) => x.id === song.id);
      if (sg) fn(sg);
    });
  };

  const stop = () => {
    setPlaying(false);
    setPlayCol(-1);
    if (player.current) {
      clearInterval(player.current.timer);
      void player.current.ctx.close();
      player.current = null;
    }
  };
  useEffect(() => stop, []);

  const play = () => {
    if (!song || playing) return;
    const ctx = new AudioContext();
    const p: Player = {
      ctx,
      noise: makeNoise(ctx),
      timer: 0,
      step: 0,
      ordPos: 0,
      nextTime: ctx.currentTime + 0.1,
    };
    player.current = p;
    setPlaying(true);
    const tick = () => {
      // read the live song each tick so edits are heard immediately
      const live = useGameStore
        .getState()
        .game.songs.find((x) => x.id === song.id);
      if (!live) return stop();
      const stepDur = songFramesPerRow(live.bpm) / 60;
      while (p.nextTime < p.ctx.currentTime + 0.15) {
        const patOrd =
          live.patterns[live.order[p.ordPos] ?? 0] ?? live.patterns[0]!;
        scheduleStep(p, live, patOrd, p.step, p.nextTime);
        const col = p.step;
        const delay = Math.max(0, (p.nextTime - p.ctx.currentTime) * 1000);
        setTimeout(() => setPlayCol(col), delay);
        p.nextTime += stepDur;
        p.step++;
        if (p.step >= SONG_STEPS) {
          p.step = 0;
          p.ordPos = (p.ordPos + 1) % live.order.length;
        }
      }
    };
    tick();
    p.timer = window.setInterval(tick, 60);
  };

  const addSong = (make: () => Song) => {
    const st = useGameStore.getState();
    if (st.game.songs.length >= MAX_SONGS) return;
    st.snapshot();
    const base = make();
    let id = base.id;
    let n = 1;
    while (st.game.songs.some((x) => x.id === id)) id = base.id + n++;
    st.mutateGame((g) => g.songs.push({ ...base, id }));
    setSongId(id);
    setPatIdx(0);
  };

  if (!song || !pat) {
    return (
      <div className='panel w-song'>
        <header>song</header>
        <div className='body'>
          <div className='toolbar'>
            <button
              className='small'
              onClick={() => addSong(() => blankSong('a'))}
            >
              + new song
            </button>
            <button className='small' onClick={() => addSong(townSong)}>
              + town example
            </button>
            <button className='small' onClick={() => addSong(fieldSong)}>
              + field example
            </button>
          </div>
          <div className='keys'>
            no songs yet — add one, then assign it to a room
          </div>
        </div>
      </div>
    );
  }

  const chSteps = pat[channel];
  const noteOfRow = (row: number): string => {
    const f = rowFreq(song, row, channel === 'drum' ? 'melody' : channel);
    return rootLabel(Math.round(69 + 12 * Math.log2(f / 440)));
  };

  return (
    <div className='panel w-song'>
      <header>
        song · {song.id}
        <span className='hint'>
          {playing
            ? 'playing (loops)'
            : `${song.patterns.length} patterns · loops forever`}
        </span>
      </header>
      <div className='body'>
        <div className='toolbar'>
          <select
            value={song.id}
            onChange={(e) => {
              setSongId(e.target.value);
              setPatIdx(0);
            }}
          >
            {game.songs.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.id} {sg.name}
              </option>
            ))}
          </select>
          <button
            className='small'
            onClick={() => addSong(() => blankSong('a'))}
            title='add song'
          >
            +
          </button>
          <button
            className='small'
            onClick={() => addSong(townSong)}
            title='bundled example: calm town loop'
          >
            + town
          </button>
          <button
            className='small'
            onClick={() => addSong(fieldSong)}
            title='bundled example: peaceful flower field, 4 patterns'
          >
            + field
          </button>
          <button
            className='small'
            onClick={() => {
              if (
                !confirm(`Delete song '${song.id}'? Rooms using it go silent.`)
              )
                return;
              stop();
              const st = useGameStore.getState();
              st.snapshot();
              st.mutateGame((g) => {
                g.songs = g.songs.filter((x) => x.id !== song.id);
                if (g.splash?.songId === song.id) delete g.splash.songId;
                for (const r of g.rooms) {
                  if (r.songId === song.id) delete r.songId;
                  // dangling playSong actions -> stop music
                  for (const ev of r.events)
                    for (const a of ev.actions)
                      if (a.type === 'playSong' && a.songId === song.id)
                        a.songId = undefined;
                }
              });
              setSongId(useGameStore.getState().game.songs[0]?.id ?? '');
            }}
          >
            delete
          </button>
          <button
            className={playing ? 'on small' : 'small'}
            onClick={() => (playing ? stop() : play())}
            style={{ marginLeft: 'auto' }}
          >
            {playing ? '■ stop' : '▶ play'}
          </button>
        </div>

        <div className='field-row'>
          <label>name</label>
          <input
            type='text'
            value={song.name}
            onChange={(e) =>
              mutateSong((sg) => (sg.name = e.target.value), false)
            }
          />
          <label>bpm</label>
          <input
            type='number'
            min={40}
            max={240}
            value={song.bpm}
            style={{ width: 56 }}
            onChange={(e) =>
              mutateSong(
                (sg) =>
                  (sg.bpm = Math.max(
                    40,
                    Math.min(240, Number(e.target.value) || 100),
                  )),
              )
            }
          />
          <label>root</label>
          <select
            value={song.root}
            onChange={(e) =>
              mutateSong((sg) => (sg.root = Number(e.target.value)))
            }
          >
            {[48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 72].map(
              (m) => (
                <option key={m} value={m}>
                  {rootLabel(m)}
                </option>
              ),
            )}
          </select>
          <label>scale</label>
          <select
            value={song.scale}
            onChange={(e) =>
              mutateSong((sg) => (sg.scale = e.target.value as SongScale))
            }
          >
            {SCALES.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>

        <div className='toolbar'>
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              className={channel === ch ? 'on small' : 'small'}
              onClick={() => setChannel(ch)}
            >
              {ch}
            </button>
          ))}
          {(channel === 'lead' || channel === 'melody') && (
            <>
              <label>duty</label>
              <select
                title='pulse width: thinner = reedier, 50% = round'
                value={song[channel].duty}
                onChange={(e) =>
                  mutateSong(
                    (sg) =>
                      (sg[channel].duty = (Number(e.target.value) & 3) as
                        | 0
                        | 1
                        | 2
                        | 3),
                  )
                }
              >
                {['12%', '25%', '50%', '75%'].map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </>
          )}
          {channel !== 'drum' && (
            <>
              <label>oct</label>
              <select
                title='octave shift: widens the channel range'
                value={
                  channel === 'bass' ? song.bassOctave : song[channel].octave
                }
                onChange={(e) => {
                  const v = Math.max(-2, Math.min(2, Number(e.target.value)));
                  mutateSong((sg) => {
                    if (channel === 'bass') sg.bassOctave = v;
                    else sg[channel].octave = v;
                  });
                }}
              >
                {[-2, -1, 0, 1, 2].map((o) => (
                  <option key={o} value={o}>
                    {o > 0 ? `+${o}` : o}
                  </option>
                ))}
              </select>
            </>
          )}
          {channel !== 'bass' && (
            <>
              <label>decay</label>
              <input
                type='number'
                min={0}
                max={15}
                style={{ width: 48 }}
                value={
                  channel === 'drum' ? song.drumDecay : song[channel].decay
                }
                onChange={(e) => {
                  const v = Math.max(
                    0,
                    Math.min(15, Number(e.target.value) || 0),
                  );
                  mutateSong((sg) => {
                    if (channel === 'drum') sg.drumDecay = v;
                    else sg[channel].decay = v;
                  });
                }}
              />
            </>
          )}
          {channel === 'drum' && (
            <>
              <label>mode</label>
              <select
                title='noise character: white = drums, metal = ringy/tonal'
                value={song.drumMode}
                onChange={(e) =>
                  mutateSong(
                    (sg) =>
                      (sg.drumMode = (Number(e.target.value) & 1) as 0 | 1),
                  )
                }
              >
                <option value={0}>white</option>
                <option value={1}>metal</option>
              </select>
            </>
          )}
        </div>

        <div className='song-grid'>
          {[...Array(SONG_ROWS)].map((_, ri) => {
            const row = SONG_ROWS - 1 - ri; // top row = 15
            return (
              <div className='song-row' key={row}>
                <span className='song-row-label'>
                  {channel === 'drum' ? drumZone(row) : noteOfRow(row)}
                </span>
                {[...Array(SONG_STEPS)].map((_, step) => {
                  const on = chSteps[step] === row + 1;
                  return (
                    <button
                      key={step}
                      className={
                        'song-cell' +
                        (on ? ' on' : '') +
                        (step === playCol ? ' playhead' : '') +
                        (step % 4 === 0 ? ' beat' : '')
                      }
                      onClick={() =>
                        mutateSong((sg) => {
                          const p2 =
                            sg.patterns[
                              Math.min(patIdx, sg.patterns.length - 1)
                            ]!;
                          p2[channel][step] = on ? 0 : row + 1;
                        })
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className='toolbar'>
          <label>pattern</label>
          {song.patterns.map((_, i) => (
            <button
              key={i}
              className={i === patIdx ? 'on small' : 'small'}
              onClick={() => setPatIdx(i)}
            >
              {i}
            </button>
          ))}
          <button
            className='small'
            disabled={song.patterns.length >= MAX_PATTERNS}
            title='add pattern (clones current)'
            onClick={() =>
              mutateSong((sg) => {
                const src =
                  sg.patterns[Math.min(patIdx, sg.patterns.length - 1)]!;
                sg.patterns.push(
                  JSON.parse(JSON.stringify(src)) as SongPattern,
                );
                setPatIdx(sg.patterns.length - 1);
              })
            }
          >
            +
          </button>
          <button
            className='small'
            disabled={song.patterns.length <= 1}
            title='delete current pattern'
            onClick={() =>
              mutateSong((sg) => {
                sg.patterns.splice(patIdx, 1);
                sg.order = sg.order
                  .map((o) => (o > patIdx ? o - 1 : o))
                  .filter((o) => o < sg.patterns.length);
                if (sg.order.length === 0) sg.order = [0];
                setPatIdx(Math.min(patIdx, sg.patterns.length - 1));
              })
            }
          >
            −
          </button>
          <span style={{ width: 12 }} />
          <label>order</label>
          {song.order.map((o, i) => (
            <button
              key={i}
              className='small'
              title='click: next pattern · shift-click: remove'
              onClick={(e) =>
                mutateSong((sg) => {
                  if (e.shiftKey) {
                    if (sg.order.length > 1) sg.order.splice(i, 1);
                  } else sg.order[i] = (sg.order[i]! + 1) % sg.patterns.length;
                })
              }
            >
              {o}
            </button>
          ))}
          <button
            className='small'
            disabled={song.order.length >= MAX_ORDER}
            onClick={() =>
              mutateSong((sg) =>
                sg.order.push(sg.order[sg.order.length - 1] ?? 0),
              )
            }
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
