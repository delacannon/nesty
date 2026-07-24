import type { Cmp, Cond, GameData } from '@nesty/core';

const CMPS: Cmp[] = ['>=', '<', '==', '!='];

const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v) || 0));

/** Generic condition editor: always / item / count / flag / var. */
export function CondEditor({
  game,
  cond,
  noneLabel = 'always',
  onChange,
}: {
  game: GameData;
  cond?: Cond;
  noneLabel?: string;
  onChange: (cond: Cond | undefined) => void;
}) {
  const setKind = (k: string) => {
    if (!k) return onChange(undefined);
    if (k === 'item' && game.items[0])
      onChange({ kind: 'item', itemId: game.items[0].id, negate: false });
    else if (k === 'count' && game.items[0])
      onChange({ kind: 'count', itemId: game.items[0].id, cmp: '>=', value: 1 });
    else if (k === 'flag' && game.flags[0])
      onChange({ kind: 'flag', flagId: game.flags[0].id, negate: false });
    else if (k === 'var' && game.variables[0])
      onChange({ kind: 'var', varId: game.variables[0].id, cmp: '>=', value: 1 });
  };

  return (
    <>
      <select
        title='condition kind'
        value={cond?.kind ?? ''}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value=''>{noneLabel}</option>
        <option value='item' disabled={game.items.length === 0}>
          item
        </option>
        <option value='count' disabled={game.items.length === 0}>
          count
        </option>
        <option value='flag' disabled={game.flags.length === 0}>
          flag
        </option>
        <option value='var' disabled={game.variables.length === 0}>
          var
        </option>
      </select>
      {cond?.kind === 'item' && (
        <>
          <select
            title='has / does not have'
            value={cond.negate ? '!' : ''}
            onChange={(e) => onChange({ ...cond, negate: e.target.value === '!' })}
          >
            <option value=''>has</option>
            <option value='!'>no</option>
          </select>
          <select
            value={cond.itemId}
            onChange={(e) => onChange({ ...cond, itemId: e.target.value })}
          >
            {game.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.id} {it.name}
              </option>
            ))}
          </select>
        </>
      )}
      {cond?.kind === 'count' && (
        <>
          <select
            value={cond.itemId}
            onChange={(e) => onChange({ ...cond, itemId: e.target.value })}
          >
            {game.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.id} {it.name}
              </option>
            ))}
          </select>
          <select
            value={cond.cmp}
            onChange={(e) => onChange({ ...cond, cmp: e.target.value as Cmp })}
          >
            {CMPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type='number'
            min={0}
            max={255}
            style={{ width: 48 }}
            value={cond.value}
            onChange={(e) =>
              onChange({ ...cond, value: clampByte(Number(e.target.value)) })
            }
          />
        </>
      )}
      {cond?.kind === 'flag' && (
        <>
          <select
            title='flag set / clear'
            value={cond.negate ? '!' : ''}
            onChange={(e) => onChange({ ...cond, negate: e.target.value === '!' })}
          >
            <option value=''>set</option>
            <option value='!'>clear</option>
          </select>
          <select
            value={cond.flagId}
            onChange={(e) => onChange({ ...cond, flagId: e.target.value })}
          >
            {game.flags.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || f.id}
              </option>
            ))}
          </select>
        </>
      )}
      {cond?.kind === 'var' && (
        <>
          <select
            value={cond.varId}
            onChange={(e) => onChange({ ...cond, varId: e.target.value })}
          >
            {game.variables.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || v.id}
              </option>
            ))}
          </select>
          <select
            value={cond.cmp}
            onChange={(e) => onChange({ ...cond, cmp: e.target.value as Cmp })}
          >
            {CMPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type='number'
            min={0}
            max={255}
            style={{ width: 48 }}
            value={cond.value}
            onChange={(e) =>
              onChange({ ...cond, value: clampByte(Number(e.target.value)) })
            }
          />
        </>
      )}
    </>
  );
}

/** lock condition + locked-message controls shared by exits and endings */
export function CondPicker({
  game,
  req,
  lockedDlgId,
  onChange,
}: {
  game: GameData;
  req?: Cond;
  lockedDlgId?: string;
  onChange: (req: Cond | undefined, lockedDlgId: string | undefined) => void;
}) {
  const dlgIds = Object.keys(game.dialogs);
  if (
    game.items.length === 0 &&
    game.flags.length === 0 &&
    game.variables.length === 0
  )
    return null;
  return (
    <>
      <CondEditor
        game={game}
        cond={req}
        onChange={(cond) => onChange(cond, cond ? lockedDlgId : undefined)}
      />
      {req && (
        <select
          title='message when locked'
          value={lockedDlgId ?? ''}
          onChange={(e) => onChange(req, e.target.value || undefined)}
        >
          <option value=''>locked: silent</option>
          {dlgIds.map((id) => (
            <option key={id} value={id}>
              locked: {id}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
