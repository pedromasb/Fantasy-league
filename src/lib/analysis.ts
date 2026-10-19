import type { AppState, MarketEntry, Player, Pos, SquadSnapshot, Status } from '../types'
import { latestSquad } from './data'

export interface Obs {
  date: string
  value?: number
  price?: number
  points?: number
  status?: Status
  source: 'market' | 'squad'
  bids?: number
}

/** Every sighting of a player, oldest first; market data wins on the same day. */
export function history(s: AppState, id: string): Obs[] {
  const byDate = new Map<string, Obs>()
  for (const [date, snap] of Object.entries(s.squads)) {
    const slot = snap.slots.find((x) => x.playerId === id)
    if (slot) byDate.set(date, { date, value: slot.value, points: slot.points, status: slot.status, source: 'squad' })
  }
  for (const [date, entries] of Object.entries(s.markets)) {
    const e = entries.find((x) => x.playerId === id)
    if (e) {
      const prev = byDate.get(date)
      byDate.set(date, { date, value: e.value, price: e.price, points: e.points, status: e.status, bids: e.bids, source: 'market' })
      if (prev?.value && !e.value) byDate.get(date)!.value = prev.value
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface PlayerSummary {
  player: Player
  value?: number
  points?: number
  status: Status
  lastSeen?: string
  /** Value change vs. the previous sighting with a value. */
  change?: number
  changePct?: number
  /** Average daily % change over the last sightings (up to 7). */
  trend?: number
  ppm?: number
  marketDays: number
  values: number[]
}

export function summarize(s: AppState, id: string, upTo?: string): PlayerSummary {
  const h = history(s, id).filter((o) => !upTo || o.date <= upTo)
  const withValue = h.filter((o) => o.value)
  const last = withValue[withValue.length - 1]
  const prev = withValue[withValue.length - 2]
  const lastPts = [...h].reverse().find((o) => o.points !== undefined)
  const lastStatus = [...h].reverse().find((o) => o.status)
  const recent = withValue.slice(-8)
  let trend: number | undefined
  if (recent.length >= 2) {
    const days = Math.max(1, dayDiff(recent[0].date, recent[recent.length - 1].date))
    trend = Math.pow(recent[recent.length - 1].value! / recent[0].value!, 1 / days) - 1
  }
  const value = last?.value
  const points = lastPts?.points
  return {
    player: s.players[id],
    value,
    points,
    status: lastStatus?.status ?? 'unknown',
    lastSeen: h[h.length - 1]?.date,
    change: last && prev ? last.value! - prev.value! : undefined,
    changePct: last && prev ? last.value! / prev.value! - 1 : undefined,
    trend,
    ppm: value && points !== undefined ? points / Math.max(value / 1e6, 0.1) : undefined,
    marketDays: h.filter((o) => o.source === 'market').length,
    values: withValue.map((o) => o.value!),
  }
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
}

function rank(x: number, arr: number[]): number {
  if (arr.length <= 1) return 0.5
  const below = arr.filter((v) => v < x).length
  const equal = arr.filter((v) => v === x).length
  return (below + (equal - 1) / 2) / (arr.length - 1)
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

export type Tag = { label: string; tone: 'good' | 'bad' | 'warn' | 'info' }

export interface MarketInsight extends PlayerSummary {
  entry: MarketEntry
  score: number
  tags: Tag[]
}

/** Score every player in a day's market (0–100) relative to the rest of that market. */
export function marketInsights(s: AppState, date: string): MarketInsight[] {
  const entries = s.markets[date] ?? []
  const sums = entries.map((e) => summarize(s, e.playerId, date))
  const ppms = sums.map((x) => x.ppm ?? 0)
  const pts = sums.map((x) => x.points ?? 0)
  const owned = new Set(latestSquad(s)?.slots.map((x) => x.playerId))

  return entries
    .map((entry, i) => {
      const sum = sums[i]
      const mom = sum.trend !== undefined ? (clamp(sum.trend, -0.05, 0.05) + 0.05) / 0.1 : 0.5
      let score = 100 * (0.4 * rank(ppms[i], ppms) + 0.3 * rank(pts[i], pts) + 0.3 * mom)
      if (entry.status === 'injured') score *= 0.5
      if (entry.status === 'doubtful') score *= 0.8
      if (entry.status === 'suspended') score *= 0.7
      if (entry.price > entry.value * 1.05) score *= 0.9

      const tags: Tag[] = []
      if (owned.has(entry.playerId)) tags.push({ label: 'En tu plantilla', tone: 'info' })
      if (score >= 75) tags.push({ label: 'Oportunidad', tone: 'good' })
      if (rank(ppms[i], ppms) >= 0.85 && (sum.points ?? 0) > 0) tags.push({ label: 'Chollo', tone: 'good' })
      if ((sum.trend ?? 0) > 0.015) tags.push({ label: 'En alza', tone: 'good' })
      if ((sum.trend ?? 0) < -0.015) tags.push({ label: 'A la baja', tone: 'bad' })
      if (entry.status === 'injured') tags.push({ label: 'Lesionado', tone: 'bad' })
      if (entry.status === 'doubtful') tags.push({ label: 'Duda', tone: 'warn' })
      if (entry.status === 'suspended') tags.push({ label: 'Sancionado', tone: 'bad' })
      if (entry.bids > 0) tags.push({ label: `${entry.bids} ${entry.bids === 1 ? 'puja' : 'pujas'}`, tone: 'warn' })
      if (entry.price > entry.value * 1.05) tags.push({ label: 'Precio inflado', tone: 'warn' })
      if (sum.marketDays === 1 && Object.keys(s.markets).length > 1) tags.push({ label: 'Nuevo', tone: 'info' })
      return { ...sum, entry, score: Math.round(score), tags }
    })
    .sort((a, b) => b.score - a.score)
}

export const FORMATIONS = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1']

export interface SquadMember extends PlayerSummary {
  starter: boolean
  purchase?: number
  gain?: number
}

export function squadMembers(s: AppState, snap = latestSquad(s)): SquadMember[] {
  if (!snap) return []
  return snap.slots
    .filter((x) => s.players[x.playerId])
    .map((x) => {
      const sum = summarize(s, x.playerId)
      const purchase = s.purchases[x.playerId]
      return {
        ...sum,
        starter: x.starter,
        purchase,
        gain: purchase !== undefined && sum.value !== undefined ? sum.value - purchase : undefined,
      }
    })
}

const playable = (m: PlayerSummary) => m.status !== 'injured' && m.status !== 'suspended'
const strength = (m: PlayerSummary) => (m.points ?? 0) * (m.status === 'doubtful' ? 0.6 : 1)

/** Best XI by season points among available players, trying every legal formation. */
export function bestLineup(members: SquadMember[]): { formation: string; ids: string[]; total: number } | undefined {
  const byPos = (p: Pos) => members.filter((m) => m.player.pos === p && playable(m)).sort((a, b) => strength(b) - strength(a))
  const gk = byPos('GK')
  if (!gk.length) return undefined
  let best: { formation: string; ids: string[]; total: number } | undefined
  for (const f of FORMATIONS) {
    const [d, m, st] = f.split('-').map(Number)
    const pick = [gk.slice(0, 1), byPos('DEF').slice(0, d), byPos('MID').slice(0, m), byPos('STR').slice(0, st)].flat()
    const total = pick.reduce((a, x) => a + strength(x), 0)
    const filled = pick.length === 11
    if (!best || (filled && (best.ids.length < 11 || total > best.total)) || (!filled && best.ids.length < 11 && pick.length > best.ids.length)) {
      best = { formation: f, ids: pick.map((x) => x.player.id), total }
    }
  }
  const coach = members.find((m) => m.player.pos === 'COA')
  if (best && coach) best.ids.push(coach.player.id)
  return best
}

export interface Advice {
  tone: 'good' | 'bad' | 'warn' | 'info'
  icon: string
  title: string
  text: string
  playerId?: string
}

export function teamValueOf(s: AppState, snap: SquadSnapshot): number | undefined {
  if (snap.teamValue) return snap.teamValue
  const vals = snap.slots.map((x) => x.value ?? summarize(s, x.playerId, snap.date).value)
  return vals.every((v) => v !== undefined) && vals.length ? vals.reduce((a, b) => a + b!, 0) : undefined
}

/** Rule-based daily tips from squad + latest market. */
export function dailyAdvice(s: AppState): Advice[] {
  const out: Advice[] = []
  const members = squadMembers(s)
  const marketDate = Object.keys(s.markets).sort().pop()

  for (const m of members) {
    if (m.status === 'injured' && m.starter)
      out.push({ tone: 'bad', icon: '🩹', title: `${m.player.name} está lesionado`, text: 'Sácalo del once o valora venderlo antes de que pierda más valor.', playerId: m.player.id })
    else if (m.status === 'doubtful' && m.starter)
      out.push({ tone: 'warn', icon: '❓', title: `${m.player.name} es duda`, text: 'Ten preparado un recambio por si no juega.', playerId: m.player.id })
    else if (m.status === 'suspended')
      out.push({ tone: 'warn', icon: '🟥', title: `${m.player.name} está sancionado`, text: 'No puntuará esta jornada.', playerId: m.player.id })
  }

  const falling = members.filter((m) => (m.trend ?? 0) < -0.01).sort((a, b) => (a.trend ?? 0) - (b.trend ?? 0))
  for (const m of falling.slice(0, 2))
    out.push({ tone: 'warn', icon: '📉', title: `${m.player.name} pierde valor`, text: `Baja de media un ${Math.abs((m.trend ?? 0) * 100).toFixed(1)}% al día. Si no rinde, plantéate venderlo.`, playerId: m.player.id })

  const rising = members.filter((m) => (m.trend ?? 0) > 0.015).sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))
  for (const m of rising.slice(0, 1))
    out.push({ tone: 'good', icon: '📈', title: `${m.player.name} se revaloriza`, text: `Sube de media un ${((m.trend ?? 0) * 100).toFixed(1)}% al día. Buen activo para mantener.`, playerId: m.player.id })

  const budget = s.budget
  const lineup = bestLineup(members)
  const snap = latestSquad(s)
  if (lineup && snap) {
    const current = new Set(snap.slots.filter((x) => x.starter).map((x) => x.playerId))
    const outs = lineup.ids.filter((id) => !current.has(id))
    if (outs.length && current.size)
      out.push({ tone: 'info', icon: '🧠', title: `Once recomendado: ${lineup.formation}`, text: `Mete a ${outs.map((id) => s.players[id]?.name).join(', ')}. Míralo en Plantilla.` })
  }

  if (budget !== undefined && budget < 0)
    out.push({ tone: 'bad', icon: '⚠️', title: 'Saldo negativo', text: 'Con saldo negativo no puntúas: vende antes del cierre de la jornada.' })

  if (marketDate && marketDate !== todayStr()) out.push({ tone: 'info', icon: '⏰', title: 'Mercado sin actualizar', text: 'El último mercado no es de hoy: pásame el pantallazo en el chat.' })
  return out
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function allDates(s: AppState): string[] {
  return [...new Set([...Object.keys(s.markets), ...Object.keys(s.squads)])].sort()
}

/** Players known up to `date`, each with its latest data. */
export function knownPlayers(s: AppState, date: string): PlayerSummary[] {
  return Object.keys(s.players)
    .map((id) => summarize(s, id, date))
    .filter((x) => x.lastSeen)
}
