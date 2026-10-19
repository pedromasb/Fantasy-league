import { openDB } from 'idb'
import { createContext, useContext } from 'react'
import type { AppState, MarketEntry, Player, Pos, SquadSlot, SquadSnapshot, Status } from '../types'
import { emptyState } from '../types'

const DB_NAME = 'fantasy-asesor'
const KEY = 'state'

const db = () =>
  openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('kv')
    },
  })

export async function loadState(): Promise<AppState> {
  const s = (await (await db()).get('kv', KEY)) as AppState | undefined
  return s ? { ...emptyState(), ...s } : emptyState()
}

export async function persistState(s: AppState): Promise<void> {
  await (await db()).put('kv', s, KEY)
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const slug = (name: string) => normalize(name).replace(/ /g, '-')

/**
 * Find a known player for a (possibly truncated) on-screen name.
 * Line-up tiles cut names ("Unai Sim..."), so a unique prefix match counts.
 */
export function findPlayer(state: AppState, name: string, pos?: Pos, truncated = false): Player | undefined {
  const n = normalize(name)
  const all = Object.values(state.players)
  const exact = all.filter((p) => normalize(p.name) === n)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return exact.find((p) => p.pos === pos) ?? exact[0]
  if (!truncated && n.length < 3) return undefined
  const prefix = all.filter((p) => normalize(p.name).startsWith(n) && (!pos || p.pos === pos))
  return prefix.length === 1 ? prefix[0] : undefined
}

function ensurePlayer(state: AppState, name: string, pos: Pos, truncated = false): string {
  const found = findPlayer(state, name, pos, truncated)
  if (found) {
    // A full name replaces a truncated one seen earlier.
    if (normalize(name).length > normalize(found.name).length && normalize(name).startsWith(normalize(found.name))) {
      found.name = name
    }
    return found.id
  }
  let id = slug(name) || `jugador-${Date.now()}`
  if (state.players[id] && state.players[id].pos !== pos) id = `${id}-${pos.toLowerCase()}`
  state.players[id] = { id, name, pos }
  return id
}

export interface ReviewRow {
  name: string
  pos: Pos
  value?: number
  price?: number
  points?: number
  status: Status
  bids: number
  truncated?: boolean
  starter?: boolean
}

export const actions = {
  saveMarket(s: AppState, date: string, rows: ReviewRow[]): AppState {
    const next = structuredClone(s)
    const entries: MarketEntry[] = rows
      .filter((r) => r.name && r.value)
      .map((r) => ({
        playerId: ensurePlayer(next, r.name, r.pos),
        value: r.value!,
        price: r.price ?? r.value!,
        points: r.points ?? 0,
        status: r.status,
        bids: r.bids,
      }))
    // Merge with anything already saved for that day (several screenshots).
    const byId = new Map((next.markets[date] ?? []).map((e) => [e.playerId, e]))
    entries.forEach((e) => byId.set(e.playerId, e))
    next.markets[date] = [...byId.values()]
    return next
  },

  /**
   * A line-up only shows the XI + coach: bench players from the previous
   * snapshot are kept. A Squad-tab list is the full squad and replaces it,
   * keeping who was a starter.
   */
  saveSquad(s: AppState, date: string, rows: ReviewRow[], kind: 'lineup' | 'cards', meta: { formation?: string; teamValue?: number } = {}): AppState {
    const next = structuredClone(s)
    const before = Object.keys(next.squads).filter((d) => d <= date).sort().pop()
    const base = before ? next.squads[before] : undefined
    const sameDay = base?.date === date
    const baseById = new Map(base?.slots.map((x) => [x.playerId, x]))
    const fresh: SquadSlot[] = rows
      .filter((r) => r.name)
      .map((r) => {
        const slot: SquadSlot = { playerId: ensurePlayer(next, r.name, r.pos, r.truncated), starter: r.starter ?? false }
        if (r.value !== undefined) slot.value = r.value
        if (r.points !== undefined) slot.points = r.points
        if (r.status !== 'unknown') slot.status = r.status
        return slot
      })
    const freshIds = new Set(fresh.map((x) => x.playerId))
    let slots: SquadSlot[]
    if (kind === 'lineup') {
      const carried = sameDay ? (id: string) => baseById.get(id) : () => undefined
      slots = [
        ...fresh.map((x) => ({ ...carried(x.playerId), ...x })),
        ...(base?.slots ?? []).filter((x) => !freshIds.has(x.playerId)).map((x) => (sameDay ? { ...x, starter: false } : { playerId: x.playerId, starter: false })),
      ]
    } else {
      slots = fresh.map((x) => ({ ...x, starter: baseById.get(x.playerId)?.starter ?? false }))
    }
    next.squads[date] = {
      date,
      formation: meta.formation ?? base?.formation,
      teamValue: meta.teamValue ?? (sameDay ? base?.teamValue : undefined),
      slots,
    }
    return next
  },

  /** Manual squad edits create/patch today's snapshot from the latest one. */
  editSquad(s: AppState, change: (slots: SquadSlot[]) => SquadSlot[]): AppState {
    const next = structuredClone(s)
    const d = today()
    const latest = latestSquad(next)
    const base: SquadSnapshot = next.squads[d] ?? { date: d, formation: latest?.formation, teamValue: undefined, slots: (latest?.slots ?? []).map((x) => ({ playerId: x.playerId, starter: x.starter })) }
    next.squads[d] = { ...base, slots: change(structuredClone(base.slots)) }
    return next
  },

  updatePlayer(s: AppState, id: string, patch: Partial<Player>): AppState {
    const next = structuredClone(s)
    next.players[id] = { ...next.players[id], ...patch, id }
    return next
  },

  /** Merge a duplicate (e.g. truncated line-up name) into another player. */
  mergePlayer(s: AppState, fromId: string, intoId: string): AppState {
    const next = structuredClone(s)
    for (const d of Object.keys(next.markets)) {
      const has = next.markets[d].some((e) => e.playerId === intoId)
      next.markets[d] = next.markets[d]
        .filter((e) => !(has && e.playerId === fromId))
        .map((e) => (e.playerId === fromId ? { ...e, playerId: intoId } : e))
    }
    for (const snap of Object.values(next.squads)) {
      const has = snap.slots.some((x) => x.playerId === intoId)
      snap.slots = snap.slots
        .filter((x) => !(has && x.playerId === fromId))
        .map((x) => (x.playerId === fromId ? { ...x, playerId: intoId } : x))
    }
    if (next.purchases[fromId] !== undefined && next.purchases[intoId] === undefined) next.purchases[intoId] = next.purchases[fromId]
    delete next.purchases[fromId]
    delete next.players[fromId]
    return next
  },

  setPurchase(s: AppState, id: string, price?: number): AppState {
    const next = structuredClone(s)
    if (price === undefined || Number.isNaN(price)) delete next.purchases[id]
    else next.purchases[id] = price
    return next
  },

  setBudget(s: AppState, budget?: number): AppState {
    return { ...s, budget, budgetDate: today() }
  },

  deleteMarket(s: AppState, date: string): AppState {
    const next = structuredClone(s)
    delete next.markets[date]
    return next
  },

  deleteSquad(s: AppState, date: string): AppState {
    const next = structuredClone(s)
    delete next.squads[date]
    return next
  },
}

export function latestSquad(s: AppState): SquadSnapshot | undefined {
  const dates = Object.keys(s.squads).sort()
  return dates.length ? s.squads[dates[dates.length - 1]] : undefined
}

export interface Store {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  replace: (s: AppState) => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreContext missing')
  return s
}
