import { latestSquad } from './data'
import type { PlayerDeep } from '../components/SeasonCharts'
import type { AppState, Pos } from '../types'

export interface TeamEvent {
  date: string
  kind: 'compra' | 'venta'
  name: string
  ffId: number
  amount?: number
}

export interface TeamHistory {
  /** Day -> sum of the market value of the players I owned that day. */
  values: [string, number][]
  /** Matchdays since the first known transfer. */
  weeks: { week: number; date: string; points: number; real: boolean }[]
  events: TeamEvent[]
  start: string
  /** First transfer in the ledger; before it the squad is assumed unchanged. */
  known: string
}

/** Current squad ffIds plus every bought or sold player, i.e. the deep files needed. */
export function teamFfIds(state: AppState): number[] {
  const ids = new Set<number>()
  for (const x of latestSquad(state)?.slots ?? []) {
    const ff = state.players[x.playerId]?.ffId
    if (ff) ids.add(ff)
  }
  for (const e of teamEvents(state)) ids.add(e.ffId)
  return [...ids]
}

export function teamEvents(state: AppState): TeamEvent[] {
  return (state.ledger ?? [])
    .filter((l) => l.kind === 'compra' || l.kind === 'venta')
    .flatMap((l): TeamEvent[] => {
      const ffId = l.ffId ?? (l.playerId ? state.players[l.playerId]?.ffId : undefined)
      return ffId ? [{ date: l.date, kind: l.kind as 'compra' | 'venta', name: l.playerName, amount: l.amount, ffId }] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Who I owned on a day: start from today's squad and undo the later transfers. */
function ownedOn(current: Set<number>, events: TeamEvent[], day: string): Set<number> {
  const owned = new Set(current)
  for (const e of [...events].reverse()) {
    if (e.date <= day) break
    if (e.kind === 'compra') owned.delete(e.ffId)
    else owned.add(e.ffId)
  }
  return owned
}

/** Value on a day; before the first known value, that first value. */
const valueOn = (deep: PlayerDeep, day: string) => {
  let v = deep.values.find(([, x]) => x > 0)?.[1]
  for (const [d, x] of deep.values) {
    if (d > day) break
    if (x > 0) v = x
  }
  return v
}

/** Best possible score with the players I had: top goalkeeper plus the ten best outfield players. */
function bestEleven(scores: { pos: Pos; pts: number }[]) {
  const sorted = [...scores].sort((a, b) => b.pts - a.pts)
  const gk = sorted.find((s) => s.pos === 'GK')
  const field = sorted.filter((s) => s.pos !== 'GK' && s.pos !== 'COA').slice(0, 10)
  return (gk?.pts ?? 0) + field.reduce((a, s) => a + s.pts, 0)
}

export function teamHistory(state: AppState, deeps: Map<number, PlayerDeep>, pos: Map<number, Pos>): TeamHistory | undefined {
  const snap = latestSquad(state)
  if (!snap) return undefined
  const current = new Set(snap.slots.map((x) => state.players[x.playerId]?.ffId).filter((x): x is number => !!x))
  const events = teamEvents(state)
  const known = events[0]?.date ?? snap.date
  // Draw from the first matchday; the squad before the first known transfer is an approximation.
  const firstWeek = [...deeps.values()].flatMap((d) => d.weeks.filter((w) => w.week === 1 && w.date).map((w) => w.date!)).sort()[0]
  const start = firstWeek && firstWeek < known ? firstWeek : known
  const end = [...deeps.values()].reduce((m, d) => (d.values.length && d.values[d.values.length - 1][0] > m ? d.values[d.values.length - 1][0] : m), start)

  const values: [string, number][] = []
  for (let t = Date.parse(start); t <= Date.parse(end); t += 864e5) {
    const day = new Date(t).toISOString().slice(0, 10)
    let sum = 0
    let missing = false
    for (const id of ownedOn(current, events, day)) {
      const deep = deeps.get(id)
      const v = deep && valueOn(deep, day)
      if (v === undefined) missing = true
      else sum += v
    }
    if (!missing) values.push([day, sum])
  }

  // Postponed games give odd dates; place each matchday at the median date of its games.
  const byWeek = new Map<number, string[]>()
  for (const d of deeps.values()) for (const w of d.weeks) if (w.date) byWeek.set(w.week, [...(byWeek.get(w.week) ?? []), w.date])
  const weekDates = new Map<number, string>()
  for (const [week, dates] of byWeek) {
    const median = dates.sort()[Math.floor(dates.length / 2)]
    if (median >= start) weekDates.set(week, median)
  }
  const weeks = [...weekDates.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, date]) => {
      const real = state.matchdayPoints?.[String(week)]
      if (real !== undefined) return { week, date, points: real, real: true }
      const scores = [...ownedOn(current, events, date)].map((id) => ({
        pos: pos.get(id) ?? 'MID',
        pts: deeps.get(id)?.weeks.find((w) => w.week === week)?.points ?? 0,
      }))
      return { week, date, points: bestEleven(scores), real: false }
    })
  return { values, weeks, events, start, known }
}
