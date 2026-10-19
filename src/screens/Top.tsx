import { useMemo, useState } from 'react'
import { PlayerRow } from '../components/PlayerRow'
import { Chips, Delta, Empty, Segmented } from '../components/ui'
import { allDates, knownPlayers, type PlayerSummary } from '../lib/analysis'
import { initials, money, num, POS_LABEL, prettyDate } from '../lib/format'
import { useNav } from '../lib/nav'
import { useStore } from '../lib/store'
import type { Pos } from '../types'

type Board = 'points' | 'risers' | 'fallers' | 'ppm' | 'value'
const BOARDS: { value: Board; label: string; icon: string; sub: string }[] = [
  { value: 'points', label: 'Puntos', icon: '🏆', sub: 'Más puntos en la temporada' },
  { value: 'risers', label: 'Suben', icon: '🚀', sub: 'Mayor subida de valor ese día' },
  { value: 'fallers', label: 'Bajan', icon: '🧊', sub: 'Mayor caída de valor ese día' },
  { value: 'ppm', label: 'Rentables', icon: '💰', sub: 'Más puntos por millón invertido' },
  { value: 'value', label: 'Valiosos', icon: '💎', sub: 'Jugadores más caros' },
]

export function Top() {
  const { state } = useStore()
  const { go } = useNav()
  const dates = allDates(state).reverse()
  const [date, setDate] = useState(dates[0] ?? '')
  const [board, setBoard] = useState<Board>('points')
  const [pos, setPos] = useState<Pos | 'ALL'>('ALL')
  const current = dates.includes(date) ? date : dates[0]
  const players = useMemo(() => (current ? knownPlayers(state, current) : []), [state, current])

  if (!dates.length)
    return (
      <div className="screen">
        <header className="top"><h1>Top jugadores</h1></header>
        <Empty icon="🏆" title="Sin datos" text="Los rankings se construyen con cada mercado y plantilla que importes." action={<button className="btn primary" onClick={() => go('import')}>Importar</button>} />
      </div>
    )

  const pool = players.filter((p) => pos === 'ALL' || p.player.pos === pos)
  const seenToday = (p: PlayerSummary) => p.lastSeen === current
  const ranked: PlayerSummary[] = (() => {
    switch (board) {
      case 'points': return [...pool].filter((p) => p.points !== undefined).sort((a, b) => b.points! - a.points!)
      case 'risers': return pool.filter((p) => seenToday(p) && (p.changePct ?? 0) > 0).sort((a, b) => b.changePct! - a.changePct!)
      case 'fallers': return pool.filter((p) => seenToday(p) && (p.changePct ?? 0) < 0).sort((a, b) => a.changePct! - b.changePct!)
      case 'ppm': return pool.filter((p) => p.ppm !== undefined && (p.points ?? 0) > 0).sort((a, b) => b.ppm! - a.ppm!)
      case 'value': return pool.filter((p) => p.value).sort((a, b) => b.value! - a.value!)
    }
  })().slice(0, 25)
  const info = BOARDS.find((b) => b.value === board)!
  const podium = ranked.slice(0, 3)

  const metric = (p: PlayerSummary) => {
    switch (board) {
      case 'points': return <b className="metric">{p.points}<small> pts</small></b>
      case 'risers':
      case 'fallers': return <span className="metric-col"><Delta value={p.changePct} /><small className="muted">{money(p.change)}</small></span>
      case 'ppm': return <b className="metric">{num(p.ppm)}<small> /M€</small></b>
      case 'value': return <b className="metric">{money(p.value)}</b>
    }
  }

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">{players.length} jugadores seguidos · {prettyDate(current, true)}</p>
          <h1>Top jugadores</h1>
        </div>
      </header>
      {dates.length > 1 && <Chips options={dates.slice(0, 14).map((d) => ({ value: d, label: prettyDate(d) }))} value={current} onChange={setDate} />}

      <div className="boards">
        {BOARDS.map((b) => (
          <button key={b.value} className={`board ${b.value === board ? 'on' : ''}`} onClick={() => setBoard(b.value)}>
            <span>{b.icon}</span>{b.label}
          </button>
        ))}
      </div>
      <Segmented options={[{ value: 'ALL', label: 'Todos' }, ...(['GK', 'DEF', 'MID', 'STR', 'COA'] as Pos[]).map((p) => ({ value: p, label: POS_LABEL[p] }))]} value={pos} onChange={(v) => setPos(v as Pos | 'ALL')} />

      {podium.length === 3 && (
        <div className="podium">
          {[podium[1], podium[0], podium[2]].map((p, i) => (
            <PodiumCard key={p.player.id} p={p} place={[2, 1, 3][i]} metric={metric(p)} />
          ))}
        </div>
      )}

      <p className="muted small board-sub">{info.icon} {info.sub}</p>
      <div className="list card">
        {ranked.length === 0 && <p className="muted pad">No hay datos para este ranking. {board === 'risers' || board === 'fallers' ? 'Hace falta ver a un jugador en dos días distintos.' : ''}</p>}
        {ranked.map((p, i) => (
          <PlayerRow key={p.player.id} p={p} rank={i + 1} right={metric(p)} />
        ))}
      </div>
      <p className="footnote">Los rankings incluyen a todos los jugadores que han aparecido en tus mercados y en tu plantilla hasta ese día.</p>
    </div>
  )
}

function PodiumCard({ p, place, metric }: { p: PlayerSummary; place: number; metric: React.ReactNode }) {
  const { openPlayer } = useNav()
  return (
    <button className={`podium-card place-${place}`} onClick={() => openPlayer(p.player.id)}>
      <span className="medal">{['🥇', '🥈', '🥉'][place - 1]}</span>
      <span className={`podium-avatar pos-ring-${p.player.pos}`}>{initials(p.player.name)}</span>
      <b className="podium-name">{p.player.name}</b>
      {metric}
      <span className="podium-step">{place}</span>
    </button>
  )
}
