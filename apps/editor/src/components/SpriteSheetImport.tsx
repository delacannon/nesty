import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colorToHex, nearestNesColor } from '@nesty/core';
import type { Frame16, Pixel, SubPal } from '@nesty/core';
import { nextId, useGameStore, type DrawTarget } from '../store/gameStore';

type RGB = [number, number, number];
type SheetKind = 'sprite' | 'item' | 'tile';

/**
 * Spritesheet importer: load a PNG grid, click NxN cells, and add each as a
 * sprite/item/tile. A single shared 3-colour sub-palette is derived from the
 * whole selection (NES-quantised) and written into every palette's chosen
 * SPR (or BG, for tiles) slot, so all imported cells display correctly under
 * the NES colour limit. Rendered through a portal to document.body so the
 * modal escapes the transformed panel and centres on the viewport.
 */
export function SpriteSheetImport({
  kind,
  onClose,
}: {
  kind: SheetKind;
  onClose: () => void;
}) {
  const src = useRef<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [cell, setCell] = useState(16);
  const [spal, setSpal] = useState<SubPal>(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const dispScale = dims ? (dims.w <= 256 ? 2 : 1) : 1;
  const cols = dims ? Math.floor(dims.w / cell) : 0;
  const rows = dims ? Math.floor(dims.h / cell) : 0;

  const loadFile = async (file: File) => {
    try {
      const bmp = await createImageBitmap(file);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      src.current = ctx.getImageData(0, 0, bmp.width, bmp.height);
      setDims({ w: bmp.width, h: bmp.height });
      setSel(new Set());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // read a source pixel
  const px = (x: number, y: number): [number, number, number, number] => {
    const d = src.current!;
    const o = (y * d.width + x) * 4;
    return [d.data[o]!, d.data[o + 1]!, d.data[o + 2]!, d.data[o + 3]!];
  };

  // sample a cell into 16×16 (nearest) → callback per target pixel
  const eachCellPixel = (
    col: number,
    row: number,
    fn: (tx: number, ty: number, r: number, g: number, b: number, a: number) => void,
  ) => {
    for (let ty = 0; ty < 16; ty++)
      for (let tx = 0; tx < 16; tx++) {
        const sx = col * cell + Math.floor((tx * cell) / 16);
        const sy = row * cell + Math.floor((ty * cell) / 16);
        const [r, g, b, a] = px(sx, sy);
        fn(tx, ty, r, g, b, a);
      }
  };

  // redraw sheet + grid + selection
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !dims || !src.current) return;
    const off = document.createElement('canvas');
    off.width = dims.w;
    off.height = dims.h;
    off.getContext('2d')!.putImageData(src.current, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, dims.w * dispScale, dims.h * dispScale);
    ctx.drawImage(off, 0, 0, dims.w * dispScale, dims.h * dispScale);
    const cs = cell * dispScale;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cs + 0.5, 0);
      ctx.lineTo(x * cs + 0.5, rows * cs);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cs + 0.5);
      ctx.lineTo(cols * cs, y * cs + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,188,252,0.35)';
    ctx.strokeStyle = '#3cbcfc';
    ctx.lineWidth = 2;
    for (const key of sel) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillRect(c! * cs, r! * cs, cs, cs);
      ctx.strokeRect(c! * cs + 1, r! * cs + 1, cs - 2, cs - 2);
    }
  }, [dims, cell, sel, dispScale, cols, rows]);

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!dims) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left) / (cell * dispScale));
    const cy = Math.floor((e.clientY - rect.top) / (cell * dispScale));
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
    const key = `${cx},${cy}`;
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const addSelected = () => {
    if (!src.current || sel.size === 0) return;
    const cells = [...sel].map((k) => k.split(',').map(Number) as [number, number]);

    // derive the 3 most-common opaque colours across the whole selection
    const freq = new Map<string, { c: RGB; n: number }>();
    for (const [c, r] of cells)
      eachCellPixel(c, r, (_tx, _ty, rr, gg, bb, aa) => {
        if (aa < 128) return;
        const key = `${rr},${gg},${bb}`;
        const e = freq.get(key);
        if (e) e.n++;
        else freq.set(key, { c: [rr, gg, bb], n: 1 });
      });
    const top = [...freq.values()].sort((a, b) => b.n - a.n).slice(0, 3).map((v) => v.c);
    if (top.length === 0) {
      setErr('selection is fully transparent');
      return;
    }
    while (top.length < 3) top.push(top[top.length - 1]!);
    const nesTriple = top.map((c) => nearestNesColor(...c)) as [number, number, number];
    const nearestIdx = (r: number, g: number, b: number): Pixel => {
      let bi = 0;
      let bd = Infinity;
      top.forEach((c, i) => {
        const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      return (bi + 1) as Pixel;
    };

    const st = useGameStore.getState();
    st.snapshot();
    let lastId = '';
    st.mutateGame((g) => {
      // shared sub-palette in every palette so cells read right anywhere
      for (const p of g.palettes)
        if (kind === 'tile') p.bg[spal] = [...nesTriple];
        else p.spr[spal] = [...nesTriple];
      const pool =
        kind === 'sprite' ? g.sprites : kind === 'item' ? g.items : g.tiles;
      const used = new Set(pool.map((x) => x.id));
      for (const [c, r] of cells) {
        const frame = new Array<Pixel>(256).fill(0) as Frame16;
        eachCellPixel(c, r, (tx, ty, rr, gg, bb, aa) => {
          frame[ty * 16 + tx] = aa < 128 ? 0 : nearestIdx(rr, gg, bb);
        });
        const id = nextId(used);
        used.add(id);
        lastId = id;
        if (kind === 'sprite')
          g.sprites.push({
            id,
            name: `sprite ${id}`,
            frames: [frame],
            sprPal: spal,
            room: st.curRoomId,
            x: 2,
            y: 2,
          });
        else if (kind === 'item')
          g.items.push({ id, name: `item ${id}`, frames: [frame], sprPal: spal });
        else
          g.tiles.push({ id, name: `tile ${id}`, wall: false, frames: [frame] });
      }
    });
    if (lastId)
      useGameStore.getState().setDrawTarget({ kind, id: lastId } as DrawTarget);
    onClose();
  };

  return createPortal(
    <div className='sheet-modal' onClick={onClose}>
      <div className='sheet-dialog' onClick={(e) => e.stopPropagation()}>
        <header>
          import spritesheet → {kind}
          <button className='small' onClick={onClose} style={{ marginLeft: 'auto' }}>
            ✕
          </button>
        </header>
        <div className='sheet-controls'>
          <input
            type='file'
            accept='.png,image/png'
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
            }}
          />
          <label>cell</label>
          <select value={cell} onChange={(e) => { setCell(Number(e.target.value)); setSel(new Set()); }}>
            {[8, 16, 24, 32].map((n) => (
              <option key={n} value={n}>
                {n}px
              </option>
            ))}
          </select>
          <label>spal</label>
          <select value={spal} onChange={(e) => setSpal(Number(e.target.value) as SubPal)}>
            {[0, 1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className='hint'>{sel.size} selected</span>
        </div>
        {err && <div className='diag'>{err}</div>}
        {dims && (
          <div className='sheet-scroll'>
            <canvas
              ref={canvasRef}
              width={dims.w * dispScale}
              height={dims.h * dispScale}
              onClick={onCanvasClick}
              style={{ cursor: 'pointer', imageRendering: 'pixelated' }}
            />
          </div>
        )}
        <div className='sheet-footer'>
          <SwatchPreview sel={sel} />
          <button
            className='primary'
            disabled={sel.size === 0}
            onClick={addSelected}
            style={{ marginLeft: 'auto' }}
          >
            add {sel.size || ''} {kind}
            {sel.size === 1 ? '' : 's'}
          </button>
        </div>
        <div className='keys'>
          click cells to select · colours reduced to 3 (NES limit) into{' '}
          {kind === 'tile' ? 'BG' : 'SPR'} sub-palette {spal} of every palette ·
          transparency = alpha
        </div>
      </div>
    </div>,
    document.body,
  );

  function SwatchPreview({ sel }: { sel: Set<string> }) {
    // live preview of the derived 3-colour palette
    const [cols3, setCols3] = useState<number[]>([]);
    useEffect(() => {
      if (!src.current || sel.size === 0) {
        setCols3([]);
        return;
      }
      const freq = new Map<string, { c: RGB; n: number }>();
      for (const key of sel) {
        const [c, r] = key.split(',').map(Number);
        eachCellPixel(c!, r!, (_tx, _ty, rr, gg, bb, aa) => {
          if (aa < 128) return;
          const k = `${rr},${gg},${bb}`;
          const e = freq.get(k);
          if (e) e.n++;
          else freq.set(k, { c: [rr, gg, bb], n: 1 });
        });
      }
      const top = [...freq.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 3)
        .map((v) => nearestNesColor(...v.c));
      setCols3(top);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sel, cell]);
    if (!cols3.length) return null;
    return (
      <div className='field-row'>
        <label>palette</label>
        {cols3.map((c, i) => (
          <span
            key={i}
            className='swatch'
            style={{ background: colorToHex(c), width: 18, height: 18 }}
            title={`$${c.toString(16).padStart(2, '0')}`}
          />
        ))}
      </div>
    );
  }
}
