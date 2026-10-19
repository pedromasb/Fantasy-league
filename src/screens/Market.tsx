import { useMemo, useState } from 'react'
import { PlayerRow } from '../components/PlayerRow'
import { Chips, Empty, ScoreRing, Segmented } from '../components/ui'
import { marketInsights, type MarketInsight } from '../lib/analysis'
import { money, num, POS_LABEL, prettyDate } from '../lib/format'
import { useNav } from '../lib/nav'
import { useStore } from '../lib/store'
import type { Pos } from '../types'

type Sort = 'score' | 'value' | 'points' | 'ppm' | 'trend'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'score', label: 'Nota' },
  { value: 'ppm', label: 'Pts/M€' },
  { value: 'points', label: 'Puntos' },
  { value: 'trend', label: 'Tendencia' },
  { value: 'value', label: 'Precio' },
]
const sorters: Record<Sort, (a: MarketInsight, b: MarketInsight) => number> = {
  score: (a, b) => b.score - a.score,
  value: (a, b) => a.entry.price - b.entry.price,
  points: (a, b) => (b.points ?? 0) - (a.points ?? 0),
  ppm: (a, b) => (b.ppm ?? 0) - (a.ppm ?? 0),
  trend: (a, b) => (b.trend ?? -1) - (a.trend ?? -1),
}

export function Market() {
  const { state } = useStore()
  const { go } = useNav()
  const dates = Object.keys(state.markets).sort().reverse()
  const [date, setDate] = useState(dates[0] ?? '')
  const [pos, setPos] = useState<Pos | 'ALL'>('ALL')
  const [sort, setSort] = useState<Sort>('score')
  const [affordable, setAffordable] = useState(false)
  const current = dates.includes(date) ? date : dates[0]
  const insights = useMemo(() => (current ? marketInsights(state, current) : []), [state, current])

  if (!dates.length)
    return (
      <div className="screen">
        <header className="top"><h1>Mercado</h1></header>
        <Empty icon="🛒" title="Aún no hay mercado" text="Copia el texto del pantallazo del mercado y pégalo en Importar." action={<button className="btn primary" onClick={() => go('import')}>Importar mercado</button>} />
      </div>
    )

  const list = insights
    .filter((x) => pos === 'ALL' || x.player.pos === pos)
    .filter((x) => !affordable || state.budget === undefined || x.entry.price <= state.budget)
    .sort(sorters[sort])
  const totalValue = insights.reduce((a, x) => a + x.entry.price, 0)
  const opps = insights.filter((x) => x.score >= 75).length
  const injured = insights.filter((x) => x.status === 'injured').length

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">{insights.length} jugadores · {prettyDate(current, true)}</p>
          <h1>Mercado</h1>
        </div>
      </header>

      {dates.length > 1 && (
        <Chips options={dates.slice(0, 14).map((d) => ({ value: d, label: prettyDate(d) }))} value={current} onChange={setDate} />
      )}

      <div className="mini-kpis">
        <div><b>{opps}</b><span>oportunidades</span></div>
        <div><b>{money(totalValue)}</b><span>en venta</span></div>
        <div><b>{injured}</b><span>lesionados</span></div>
      </div>

      <Segmented options={[{ value: 'ALL', label: 'Todos' }, ...(['GK', 'DEF', 'MID', 'STR', 'COA'] as Pos[]).map((p) => ({ value: p, label: POS_LABEL[p] }))]} value={pos} onChange={(v) => setPos(v as Pos | 'ALL')} />

      <div className="row between toolbar">
        <Chips options={SORTS} value={sort} onChange={setSort} />
      </div>
      {state.budget !== undefined && (
        <label className="switch">
          <input type="checkbox" checked={affordable} onChange={(e) => setAffordable(e.target.checked)} />
          <span className="switch-ui" />
          Solo lo que puedo pagar ({money(state.budget)})
        </label>
      )}

      <div className="list card">
        {list.length === 0 && <p className="muted pad">Nadie cumple el filtro.</p>}
        {list.map((x) => (
          <PlayerRow
            key={x.player.id}
            p={x}
            tags={x.tags}
            sub={
              <>
                <b>{money(x.entry.price)}</b>
                <span className="muted">· {x.points ?? 0} pts · {num(x.ppm)} pts/M€</span>
              </>
            }
            right={<ScoreRing score={x.score} />}
          />
        ))}
      </div>
      <p className="footnote">La nota (0–100) combina rentabilidad (puntos por millón), puntos totales y tendencia del valor, y penaliza lesiones y precios inflados.</p>
    </div>
  )
}
