import { useEffect, useId, useState } from 'react'
import { money } from '../lib/format'

/** public/data/players/<ffId>.json, written by the daily sync for tracked players. */
export interface PlayerDeep {
  id: number
  name: string
  updated: string
  values: [string, number][]
  weeks: {
    week: number
    points: number | null
    minutes?: number
    goals?: number
    assists?: number
    yellow?: number
    red?: number
    date?: string
    rival?: string
    home?: boolean
    score?: [number, number]
    breakdown?: Record<string, [number, number]>
  }[]
  season?: Record<string, string>
}

export function usePlayerDeep(ffId?: number): PlayerDeep | null | undefined {
  const [data, setData] = useState<PlayerDeep | null | undefined>(undefined)
  useEffect(() => {
    if (!ffId) return
    let alive = true
    fetch(`${import.meta.env.BASE_URL}data/players/${ffId}.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
    return () => {
      alive = false
    }
  }, [ffId])
  return ffId ? data : null
}

const DAY = 864e5
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Value over the whole season (line) with the points of every matchday (bars) on the same dates. */
export function SeasonChart({ deep }: { deep: PlayerDeep }) {
  const id = useId()
  const values = deep.values.filter(([, v]) => v > 0)
  const weeks = deep.weeks.filter((w) => w.date)
  if (values.length < 2) return null
  const W = 340
  const H = 210
  const top = 16
  const valueBottom = 120
  const barsTop = 138
  const barsBottom = 186
  const t0 = Date.parse(values[0][0])
  const t1 = Math.max(Date.parse(values[values.length - 1][0]), ...weeks.map((w) => Date.parse(w.date!)))
  const span = Math.max(t1 - t0, DAY)
  const x = (d: string) => 6 + ((Date.parse(d) - t0) / span) * (W - 12)
  const vs = values.map(([, v]) => v)
  const vmin = Math.min(...vs)
  const vmax = Math.max(...vs)
  const y = (v: number) => top + (1 - (v - vmin) / (vmax - vmin || 1)) * (valueBottom - top)
  const line = values.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const pmax = Math.max(4, ...weeks.map((w) => Math.abs(w.points ?? 0)))
  const barW = Math.max(5, Math.min(14, (W - 12) / Math.max(weeks.length, 1) - 4))
  const zero = barsBottom - (barsBottom - barsTop) * (weeks.some((w) => (w.points ?? 0) < 0) ? 0.2 : 0)
  const scale = (zero - barsTop) / pmax
  const months: { label: string; x: number }[] = []
  for (let t = new Date(t0); t.getTime() <= t1; t = new Date(t.getFullYear(), t.getMonth() + 1, 1)) {
    const first = new Date(t.getFullYear(), t.getMonth(), 1)
    if (first.getTime() >= t0) months.push({ label: MONTHS[first.getMonth()], x: x(first.toISOString().slice(0, 10)) })
  }
  const last = values[values.length - 1]
  const tone = (p: number | null) => (p === null ? 'none' : p < 0 ? 'neg' : p >= 8 ? 'top' : p >= 5 ? 'good' : p >= 2 ? 'mid' : 'low')
  return (
    <div className="season-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent-2)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1="0" x2={W} y1={top + f * (valueBottom - top)} y2={top + f * (valueBottom - top)} className="grid" />
        ))}
        <path d={`${line} L${x(last[0])},${valueBottom} L${x(values[0][0])},${valueBottom} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="var(--accent-2)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last[0])} cy={y(last[1])} r="4" fill="var(--accent-2)" />
        <text x={8} y={top - 4} className="chart-label dim">{money(vmax)}</text>
        <text x={8} y={valueBottom + 12} className="chart-label dim">{money(vmin)}</text>
        <line x1="0" x2={W} y1={zero} y2={zero} className="grid" />
        {weeks.map((w) => {
          const p = w.points ?? 0
          const h = Math.abs(p) * scale
          const bx = x(w.date!) - barW / 2
          return (
            <g key={w.week}>
              <rect x={bx} y={p >= 0 ? zero - h : zero} width={barW} height={Math.max(h, w.points === null ? 0 : 1.5)} rx="2" className={`bar f-${tone(w.points)}`} />
              <text x={bx + barW / 2} y={p >= 0 ? zero - h - 3 : zero + h + 9} className="chart-axis" textAnchor="middle">{w.points ?? '–'}</text>
            </g>
          )
        })}
        {months.map((m) => (
          <text key={m.label + m.x} x={m.x} y={H - 6} className="chart-axis" textAnchor="middle">{m.label}</text>
        ))}
      </svg>
      <div className="chart-legend">
        <span><i className="lg-line" /> Valor de mercado</span>
        <span><i className="lg-bar" /> Puntos por jornada</span>
      </div>
    </div>
  )
}

const BREAKDOWN: Record<string, string> = {
  mins_played: 'Minutos', goals: 'Goles', goal_assist: 'Asistencias', offtarget_att_assist: 'Asist. sin gol',
  total_scoring_att: 'Tiros', pen_area_entries: 'Entradas al área', won_contest: 'Regates', ball_recovery: 'Recuperaciones',
  poss_lost_all: 'Pérdidas', effective_clearance: 'Despejes', goals_conceded: 'Goles encajados', saves: 'Paradas',
  penalty_save: 'Penaltis parados', penalty_won: 'Penaltis provocados', penalty_failed: 'Penaltis fallados',
  penalty_conceded: 'Penaltis cometidos', yellow_card: 'Amarilla', second_yellow_card: '2ª amarilla', red_card: 'Roja',
  own_goals: 'Gol en propia', marca_points: 'Nota prensa',
}

/** Matchday table: rival, result, minutes, goals, assists, points; tap a row for the points breakdown. */
export function MatchdayTable({ deep }: { deep: PlayerDeep }) {
  const [open, setOpen] = useState<number | null>(null)
  const rows = [...deep.weeks].reverse()
  return (
    <div className="mtable">
      <div className="mrow mhead"><span>J</span><span>Rival</span><span>Min</span><span>G</span><span>A</span><span>Pts</span></div>
      {rows.map((w) => (
        <div key={w.week}>
          <button className={`mrow ${w.breakdown ? 'has-detail' : ''}`} onClick={() => w.breakdown && setOpen(open === w.week ? null : w.week)}>
            <span className="muted">{w.week}</span>
            <span className="mrival">
              {w.rival ? `${w.home ? '🏠' : '✈️'} ${w.rival}` : '—'}
              {w.score && <small className={w.score[0] > w.score[1] ? 'pos' : w.score[0] < w.score[1] ? 'neg' : 'muted'}> {w.score[0]}-{w.score[1]}</small>}
            </span>
            <span>{w.minutes ?? (w.points === null ? 0 : '—')}</span>
            <span>{w.goals || ''}</span>
            <span>{w.assists || ''}</span>
            <b className={`mpts f-${w.points === null ? 'none' : w.points < 0 ? 'neg' : w.points >= 8 ? 'top' : w.points >= 5 ? 'good' : w.points >= 2 ? 'mid' : 'low'}`}>{w.points ?? '–'}</b>
          </button>
          {open === w.week && w.breakdown && (
            <div className="breakdown">
              {Object.entries(w.breakdown)
                .filter(([k]) => BREAKDOWN[k])
                .map(([k, [v, p]]) => (
                  <span key={k}>
                    {BREAKDOWN[k]} <b>{v}</b> <small className={p > 0 ? 'pos' : p < 0 ? 'neg' : 'muted'}>{p > 0 ? `+${p}` : p} pts</small>
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}
      {rows.some((w) => w.breakdown) && <p className="small muted" style={{ marginTop: 6 }}>Toca una jornada con ▸ para ver de dónde salen sus puntos.</p>}
    </div>
  )
}

const SEASON_KEYS = [
  'Partidos jugados', 'Titular', 'Minutos jugados', 'Goles', 'Asistencias', 'Tiros a puerta / Tiros', 'Goles / Tiros',
  'Ocasiones claras creadas', 'Pases completados / Pases', 'Pases clave', 'Regates con éxito', 'Centros precisos / Centros',
  'Balones robados', 'Pases interceptados', 'Duelos aéreos ganados', 'Despejes efectivos', 'Tiros bloqueados',
  'Posesiones perdidas', 'Faltas recibidas', 'Faltas cometidas', 'Tarjetas amarillas', 'Tarjeta roja', 'Paradas',
  'Goles encajados', 'Penaltis anotados / Lanzados', 'Penaltis provocados',
]

/** Advanced season stats from futbolfantasy, with a per-90 line where it helps. */
export function AdvancedStats({ season }: { season: Record<string, string> }) {
  const minutes = parseInt(season['Minutos jugados'] ?? '0', 10)
  const per90 = (k: string) => {
    const v = parseInt(season[k] ?? '', 10)
    return minutes >= 180 && Number.isFinite(v) ? ((v / minutes) * 90).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : undefined
  }
  const keys = SEASON_KEYS.filter((k) => season[k] !== undefined && !(season[k] === '0' && !['Goles', 'Asistencias'].includes(k)))
  return (
    <div className="adv">
      {keys.map((k) => (
        <div key={k} className="adv-row">
          <span>{k}</span>
          <b>{season[k]}</b>
          {['Pases clave', 'Regates con éxito', 'Balones robados', 'Despejes efectivos', 'Posesiones perdidas', 'Duelos aéreos ganados', 'Pases interceptados'].includes(k) && per90(k) && (
            <small className="muted">{per90(k)}/90'</small>
          )}
        </div>
      ))}
    </div>
  )
}
