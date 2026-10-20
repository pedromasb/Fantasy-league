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

type Selection = { kind: 'day'; date: string } | { kind: 'week'; week: number }

/** Team value day by day (line) with my points per matchday (bars) and every signing and sale marked; tap to see details. */
export function TeamSeason() {
  const id = useId()
  const state = useData()
  const league = useLeague()
  const ids = useMemo(() => teamFfIds(state), [state])
  const deeps = useDeeps(ids)
  const [sel, setSel] = useState<Selection>()
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
  // Several transfers on the same day share one marker.
  const days = [...new Set(hist.events.map((e) => e.date))].map((date) => {
    const evs = hist.events.filter((e) => e.date === date)
    const kinds = new Set(evs.map((e) => e.kind))
    return { date, evs, cls: kinds.size > 1 ? 'ev-mixed' : kinds.has('compra') ? 'ev-buy' : 'ev-sell' }
  })

  /** Tap on the value area: pick the nearest day. */
  const pickDay = (ev: React.MouseEvent<SVGRectElement>) => {
    const box = ev.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const px = ((ev.clientX - box.left) / box.width) * W
    const nearest = values.reduce((best, v) => (Math.abs(x(v[0]) - px) < Math.abs(x(best[0]) - px) ? v : best))
    setSel({ kind: 'day', date: nearest[0] })
  }

  const selDate = sel?.kind === 'day' ? sel.date : sel ? hist.weeks.find((w) => w.week === sel.week)?.date : undefined
  const selWeek = sel?.kind === 'week' ? hist.weeks.find((w) => w.week === sel.week) : undefined
  const selEvents = sel?.kind === 'day' ? hist.events.filter((e) => e.date === sel.date) : []
  const prevValue = selDate ? values.filter(([d]) => d < selDate).pop()?.[1] : undefined

  return (
    <div className="card pad">
      <div className="card-title">Tu equipo esta temporada</div>
      <p className="small muted" style={{ marginBottom: 6 }}>
        Valor {money(first[1])} → <b>{money(last[1])}</b>{' '}
        <span className={diff >= 0 ? 'pos' : 'neg'}>({diff >= 0 ? '+' : ''}{money(diff)})</span>
        {hist.weeks.some((w) => w.real) && <> · {hist.weeks.filter((w) => w.real).reduce((a, w) => a + w.points, 0)} pts reales</>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart team-chart">
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
        <rect x={0} y={0} width={W} height={valueBottom + 6} fill="transparent" onClick={pickDay} style={{ cursor: 'pointer' }} />
        {selDate && (
          <g pointerEvents="none">
            <line x1={x(selDate)} x2={x(selDate)} y1={top} y2={barsBottom} className="sel-line" />
            <circle cx={x(selDate)} cy={y(valueAt(selDate))} r="4" fill="var(--accent-2)" />
          </g>
        )}
        {days.map((d) => {
          const ex = x(d.date)
          const ey = y(valueAt(d.date))
          const on = sel?.kind === 'day' && sel.date === d.date
          return (
            <g key={d.date} onClick={() => setSel({ kind: 'day', date: d.date })} style={{ cursor: 'pointer' }}>
              <circle cx={ex} cy={ey} r="13" fill="transparent" />
              <circle cx={ex} cy={ey} r={on ? 7 : 5.5} className={d.cls} />
              {d.evs.length > 1 && <text x={ex} y={ey + 3} className="ev-count" textAnchor="middle">{d.evs.length}</text>}
            </g>
          )
        })}
        <line x1="0" x2={W} y1={barsBottom} y2={barsBottom} className="grid" />
        {hist.weeks.map((w) => {
          const h = Math.max(w.points, 0) * scale
          const bx = x(w.date) - barW / 2
          const on = sel?.kind === 'week' && sel.week === w.week
          return (
            <g key={w.week} onClick={() => setSel({ kind: 'week', week: w.week })} style={{ cursor: 'pointer' }}>
              <rect x={bx - 3} y={barsTop - 14} width={barW + 6} height={H - barsTop + 14} fill="transparent" />
              <rect x={bx} y={barsBottom - h} width={barW} height={Math.max(h, 1.5)} rx="3" className={`bar ${w.real ? 'f-good' : 'f-est'} ${on ? 'bar-on' : ''}`} />
              <text x={bx + barW / 2} y={barsBottom - h - 3} className="chart-axis" textAnchor="middle">{w.points}</text>
              <text x={bx + barW / 2} y={H - 14} className="chart-axis" textAnchor="middle">J{w.week}</text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="lg-dot ev-buy" /> Fichaje</span>
        <span><i className="lg-dot ev-sell" /> Venta</span>
        <span><i className="lg-dot ev-mixed" /> Ambos</span>
      </div>

      <div className="team-detail">
        {!sel && <p className="small muted">Toca la línea, un punto o una barra para ver el detalle.</p>}
        {sel && selDate && (
          <>
            <div className="row between">
              <b>{selWeek ? `Jornada ${selWeek.week} · ${prettyDate(selWeek.date)}` : prettyDate(selDate, true)}</b>
              <button className="link" onClick={() => setSel(undefined)}>Cerrar</button>
            </div>
            <p className="small">
              Valor de tu plantilla: <b>{money(valueAt(selDate))}</b>
              {prevValue !== undefined && (
                <span className={valueAt(selDate) >= prevValue ? 'pos' : 'neg'}> ({valueAt(selDate) >= prevValue ? '+' : ''}{money(valueAt(selDate) - prevValue)} ese día)</span>
              )}
            </p>
            {selWeek && (
              <p className="small">
                Puntos: <b>{selWeek.points}</b> {selWeek.real ? '(reales)' : '(estimados: portero y 10 mejores de los que tenías)'}
              </p>
            )}
            {selEvents.map((e, i) => (
              <p key={i} className={`small ev-line ${e.kind === 'compra' ? 'pos' : 'neg'}`}>
                {e.kind === 'compra' ? '＋ Fichas a' : '− Vendes a'} <b>{e.name}</b>{e.amount ? ` por ${money(e.amount)}` : ''}
              </p>
            ))}
            {sel.kind === 'day' && selEvents.length === 0 && <p className="small muted">Sin fichajes ni ventas ese día.</p>}
          </>
        )}
      </div>

      {approx.length > 1 && (
        <p className="small muted" style={{ marginTop: 6 }}>
          Línea discontinua: antes del {prettyDate(hist.known)} no tengo tu histórico de fichajes, así que supongo la misma plantilla. Si me pasas pantallazos del histórico más antiguo, la completo.
        </p>
      )}
      {estimated && (
        <p className="small muted" style={{ marginTop: 6 }}>
          Barras claras: puntos estimados (portero y 10 mejores de los que tenías esa jornada, sin entrenador). Barras verdes: tus puntos reales.
        </p>
      )}
    </div>
  )
}
