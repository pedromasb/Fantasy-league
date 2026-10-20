import { useEffect, useId, useMemo, useState } from 'react'
import { useData } from '../lib/data'
import { money, prettyDate } from '../lib/format'
import { useLeague } from '../lib/league'
import { teamFfIds, teamHistory } from '../lib/team'
import type { Pos } from '../types'
import type { PlayerDeep } from './SeasonCharts'

function useDeeps(ids: number[]): Map<number, PlayerDeep> | undefined {
  const key = ids.join(',')
  const [data, setData] = useState<Map<number, PlayerDeep>>()
  useEffect(() => {
    let alive = true
    Promise.all(
      key.split(',').filter(Boolean).map((id) =>
        fetch(`${import.meta.env.BASE_URL}data/players/${id}.json`, { cache: 'no-cache' })
          .then((r) => (r.ok ? (r.json() as Promise<PlayerDeep>) : null))
          .catch(() => null),
      ),
    ).then((all) => alive && setData(new Map(all.filter((d): d is PlayerDeep => !!d).map((d) => [d.id, d]))))
    return () => {
      alive = false
    }
  }, [key])
  return data
}

/** Team value day by day (line) with my points per matchday (bars) and every signing and sale marked. */
export function TeamSeason() {
  const id = useId()
  const state = useData()
  const league = useLeague()
  const ids = useMemo(() => teamFfIds(state), [state])
  const deeps = useDeeps(ids)
  const hist = useMemo(() => {
    if (!deeps) return undefined
    const pos = new Map<number, Pos>((league?.players ?? []).map((p) => [p.id, p.pos]))
    return teamHistory(state, deeps, pos)
  }, [state, deeps, league])
  if (!hist || hist.values.length < 2) return null

  const W = 340
  const H = 220
  const top = 18
  const valueBottom = 120
  const barsTop = 142
  const barsBottom = 192
  const values = hist.values
  const t0 = Date.parse(values[0][0])
  const t1 = Math.max(Date.parse(values[values.length - 1][0]), ...hist.weeks.map((w) => Date.parse(w.date)))
  const x = (d: string) => 10 + ((Date.parse(d) - t0) / Math.max(t1 - t0, 864e5)) * (W - 20)
  const vs = values.map(([, v]) => v)
  const vmin = Math.min(...vs)
  const vmax = Math.max(...vs)
  const y = (v: number) => top + (1 - (v - vmin) / (vmax - vmin || 1)) * (valueBottom - top)
  const valueAt = (d: string) => (values.find(([day]) => day >= d) ?? values[values.length - 1])[1]
  const path = (pts: [string, number][]) => pts.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const line = path(values)
  const approx = values.filter(([d]) => d <= hist.known)
  const exact = values.filter(([d]) => d >= hist.known)
  const pmax = Math.max(10, ...hist.weeks.map((w) => w.points))
  const barW = Math.max(8, Math.min(18, (W - 20) / Math.max(hist.weeks.length, 1) - 6))
  const scale = (barsBottom - barsTop) / pmax
  const first = values[0]
  const last = values[values.length - 1]
  const diff = last[1] - first[1]
  const estimated = hist.weeks.some((w) => !w.real)

  return (
    <div className="card pad">
      <div className="card-title">Tu equipo esta temporada</div>
      <p className="small muted" style={{ marginBottom: 6 }}>
        Valor {money(first[1])} → <b>{money(last[1])}</b>{' '}
        <span className={diff >= 0 ? 'pos' : 'neg'}>({diff >= 0 ? '+' : ''}{money(diff)})</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent-2)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${x(last[0])},${valueBottom} L${x(first[0])},${valueBottom} Z`} fill={`url(#${id})`} />
        {approx.length > 1 && <path d={path(approx)} fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />}
        {exact.length > 1 && <path d={path(exact)} fill="none" stroke="var(--accent-2)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
        {approx.length > 1 && <line x1={x(hist.known)} x2={x(hist.known)} y1={top} y2={barsBottom} className="grid" strokeDasharray="2 3" />}
        <text x={10} y={top - 6} className="chart-label dim">{money(vmax)}</text>
        <text x={10} y={valueBottom + 12} className="chart-label dim">{money(vmin)}</text>
        {hist.events.map((e, i) => {
          const ex = x(e.date)
          const ey = y(valueAt(e.date))
          return (
            <g key={i}>
              <circle cx={ex} cy={ey} r="4.5" className={e.kind === 'compra' ? 'ev-buy' : 'ev-sell'} />
              <title>{`${e.kind === 'compra' ? 'Fichas' : 'Vendes'} a ${e.name} (${prettyDate(e.date)})${e.amount ? ` · ${money(e.amount)}` : ''}`}</title>
            </g>
          )
        })}
        <line x1="0" x2={W} y1={barsBottom} y2={barsBottom} className="grid" />
        {hist.weeks.map((w) => {
          const h = Math.max(w.points, 0) * scale
          const bx = x(w.date) - barW / 2
          return (
            <g key={w.week}>
              <rect x={bx} y={barsBottom - h} width={barW} height={Math.max(h, 1.5)} rx="3" className={w.real ? 'bar f-good' : 'bar f-est'} />
              <text x={bx + barW / 2} y={barsBottom - h - 3} className="chart-axis" textAnchor="middle">{w.points}</text>
              <text x={bx + barW / 2} y={H - 14} className="chart-axis" textAnchor="middle">J{w.week}</text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="lg-line" /> Valor de tu plantilla</span>
        <span><i className="lg-dot ev-buy" /> Fichaje</span>
        <span><i className="lg-dot ev-sell" /> Venta</span>
      </div>
      <div className="team-events">
        {[...hist.events].reverse().map((e, i) => (
          <span key={i} className={e.kind === 'compra' ? 'pos' : 'neg'}>
            {e.kind === 'compra' ? '＋' : '−'} {e.name} <small className="muted">{prettyDate(e.date)}{e.amount ? ` · ${money(e.amount)}` : ''}</small>
          </span>
        ))}
      </div>
      {approx.length > 1 && (
        <p className="small muted" style={{ marginTop: 6 }}>
          Línea discontinua: antes del {prettyDate(hist.known)} no tengo tu histórico de fichajes, así que supongo la misma plantilla. Si me pasas pantallazos del histórico más antiguo, la completo.
        </p>
      )}
      {estimated && (
        <p className="small muted" style={{ marginTop: 6 }}>
          Barras claras: puntos estimados (portero y 10 mejores de los que tenías esa jornada, sin entrenador). Pásame un pantallazo de tus puntos por jornada y pongo los reales (barras verdes).
        </p>
      )}
    </div>
  )
}
