import { useState } from 'react'
import { IconClipboard, IconTrash } from '../components/Icons'
import { Segmented } from '../components/ui'
import { POS_LABEL, POS_ORDER, STATUS_LABEL, money } from '../lib/format'
import { useNav } from '../lib/nav'
import { detectKind, parseCards, parseLineup, parseMarket, type TextKind } from '../lib/parse'
import { actions, findPlayer, today, useStore, type ReviewRow } from '../lib/store'
import type { Pos, Status } from '../types'

type Mode = 'auto' | TextKind
const MODES: { value: Mode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'market', label: 'Mercado' },
  { value: 'lineup', label: 'Alineación' },
  { value: 'cards', label: 'Squad' },
]
const KIND_NAME: Record<TextKind, string> = { market: 'Mercado', lineup: 'Alineación', cards: 'Lista de plantilla' }

export function Import({ initialText }: { initialText?: string }) {
  const { state, update } = useStore()
  const { go, toast } = useNav()
  const [mode, setMode] = useState<Mode>('auto')
  const [date, setDate] = useState(today())
  const [text, setText] = useState(initialText ?? '')
  const [kind, setKind] = useState<TextKind | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [meta, setMeta] = useState<{ formation?: string; teamValue?: number }>({})
  const [help, setHelp] = useState(!initialText)

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setText(t)
      else toast('El portapapeles está vacío')
    } catch {
      toast('No se pudo leer el portapapeles: mantén pulsado el cuadro y elige Pegar')
    }
  }

  const analyze = () => {
    const k = mode === 'auto' ? detectKind(text) : mode
    setKind(k)
    if (k === 'lineup') {
      const l = parseLineup(text)
      setMeta({ formation: l.formation, teamValue: l.teamValue })
      const r: ReviewRow[] = l.players.map((p) => ({ name: p.name, pos: p.pos, status: 'unknown', bids: 0, truncated: p.truncated, starter: true }))
      if (l.coach) r.push({ name: l.coach.name, pos: 'COA', status: 'unknown', bids: 0, truncated: l.coach.truncated, starter: true })
      setRows(r)
    } else {
      const cards = k === 'market' ? parseMarket(text) : parseCards(text)
      setMeta({})
      setRows(cards.map((c) => ({ ...c, starter: false })))
    }
  }

  const set = (i: number, patch: Partial<ReviewRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i))

  const save = () => {
    if (!kind) return
    if (kind === 'market') update((s) => actions.saveMarket(s, date, rows))
    else update((s) => actions.saveSquad(s, date, rows, kind, kind === 'lineup' ? meta : {}))
    toast(`${KIND_NAME[kind]} guardado: ${rows.length} jugadores`)
    setText('')
    setRows([])
    setKind(null)
    go(kind === 'market' ? 'market' : 'squad')
  }

  const missingValue = kind === 'market' && rows.some((r) => !r.value)

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">Pantallazo → texto → datos</p>
          <h1>Importar</h1>
        </div>
      </header>

      {!kind ? (
        <>
          <div className={`card pad help ${help ? 'open' : ''}`}>
            <button className="help-head" onClick={() => setHelp((h) => !h)}>
              <span>📱 Cómo copiar el texto en tu Pixel</span>
              <span className="muted">{help ? '−' : '+'}</span>
            </button>
            {help && (
              <ol className="steps">
                <li>Haz el pantallazo en LaLiga Fantasy (mercado o alineación). Para el mercado puedes usar <b>Capturar más</b> y sacar toda la lista de una vez.</li>
                <li>Abre la captura y pulsa <b>Lens</b> → <b>Texto</b> → <b>Seleccionar todo</b> → <b>Copiar</b>. También vale <b>Copiar texto</b> desde la vista de Recientes.</li>
                <li>Vuelve aquí y pulsa <b>Pegar</b>. O, desde Lens, usa <b>Compartir → Fantasy Asesor</b> si has instalado la app.</li>
              </ol>
            )}
          </div>

          <Segmented options={MODES} value={mode} onChange={setMode} />

          <div className="card pad stack gap">
            <div className="row gap">
              <label className="field grow">
                <span>Fecha de los datos</span>
                <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
              </label>
              <button className="btn paste" onClick={paste}><IconClipboard width={18} height={18} /> Pegar</button>
            </div>
            <textarea
              className="paste-area"
              placeholder={'Pega aquí el texto copiado…\n\nCOA Luís Castro\nLALIGA\nAvailable\nFSYP 13\nValue 610,931\nPrice 610,931'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
            />
            <button className="btn primary wide" disabled={!text.trim()} onClick={analyze}>Analizar texto</button>
          </div>
        </>
      ) : (
        <>
          <div className="review-head card pad">
            <div>
              <span className="eyebrow">Detectado</span>
              <h3>{KIND_NAME[kind]} · {rows.length} jugadores</h3>
              {kind === 'lineup' && (
                <p className="muted small">
                  Formación {meta.formation ?? '¿?'} · Valor {money(meta.teamValue)}
                </p>
              )}
            </div>
            <button className="link" onClick={() => setKind(null)}>Volver</button>
          </div>

          {rows.length === 0 && (
            <div className="card pad">
              <p>No he encontrado jugadores en el texto. Prueba a elegir el tipo a mano (Mercado / Alineación) o copia de nuevo el texto completo.</p>
            </div>
          )}

          {kind === 'lineup' && rows.length > 0 && (
            <p className="footnote">Los nombres cortados ("Unai Sim…") se enlazan solos si ya conoces al jugador del mercado. Si no, puedes completarlos ahora o fusionarlos más tarde desde su ficha.</p>
          )}

          <div className="stack gap-s">
            {rows.map((r, i) => {
              const known = findPlayer(state, r.name, r.pos, r.truncated)
              return (
                <div key={i} className="review-row card">
                  <div className="row gap-s">
                    <select className={`pos-select pos-${r.pos}`} value={r.pos} onChange={(e) => set(i, { pos: e.target.value as Pos })}>
                      {POS_ORDER.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
                    </select>
                    <input className="grow name-input" value={r.name} onChange={(e) => set(i, { name: e.target.value, truncated: false })} />
                    <button className="icon-btn sm" onClick={() => remove(i)} aria-label="Quitar"><IconTrash width={18} height={18} /></button>
                  </div>
                  <div className="row gap-s review-meta">
                    <span className={`tag ${known ? 'tone-good' : 'tone-info'}`}>{known ? `✓ ${known.name}` : r.truncated ? 'Nuevo · nombre cortado' : 'Nuevo'}</span>
                    {kind === 'lineup' && (
                      <label className="mini-check">
                        <input type="checkbox" checked={r.starter ?? true} onChange={(e) => set(i, { starter: e.target.checked })} /> Titular
                      </label>
                    )}
                  </div>
                  {kind !== 'lineup' && (
                    <div className="review-grid">
                      <label className="field sm"><span>Valor</span><input inputMode="numeric" value={r.value ?? ''} onChange={(e) => set(i, { value: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></label>
                      {kind === 'market' && (
                        <label className="field sm"><span>Precio</span><input inputMode="numeric" value={r.price ?? ''} onChange={(e) => set(i, { price: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></label>
                      )}
                      <label className="field sm"><span>Puntos</span><input inputMode="numeric" value={r.points ?? ''} onChange={(e) => set(i, { points: e.target.value === '' ? undefined : Number(e.target.value.replace(/[^\d-]/g, '')) })} /></label>
                      <label className="field sm">
                        <span>Estado</span>
                        <select value={r.status} onChange={(e) => set(i, { status: e.target.value as Status })}>
                          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {kind !== 'market' && rows.length > 0 && (
            <button className="btn ghost wide" onClick={() => setRows((r) => [...r, { name: '', pos: 'MID', status: 'unknown', bids: 0, starter: false }])}>+ Añadir jugador</button>
          )}

          <div className="sticky-save">
            {missingValue && <p className="small warn-text">Los jugadores sin valor no se guardarán.</p>}
            <button className="btn primary wide" disabled={!rows.length} onClick={save}>Guardar {rows.length} jugadores</button>
          </div>
        </>
      )}
    </div>
  )
}
