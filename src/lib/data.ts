import { createContext, useContext } from 'react'
import type { AppState, PlayerRec, Report, SquadSnapshot } from '../types'

/** Data is a static file in the repo, updated from the chat each day. */
export async function loadData(): Promise<AppState> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/fantasy.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as AppState
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const lastKey = <T,>(rec: Record<string, T>): T | undefined => {
  const k = Object.keys(rec).sort().pop()
  return k ? rec[k] : undefined
}

export const latestSquad = (s: AppState): SquadSnapshot | undefined => lastKey(s.squads)
export const latestReport = (s: AppState): Report | undefined => lastKey(s.reports)

/** Most recent recommendation written for a player. */
export function latestRec(s: AppState, id: string): (PlayerRec & { date: string }) | undefined {
  const dates = Object.keys(s.reports).sort().reverse()
  for (const d of dates) {
    const r = s.reports[d].players[id]
    if (r) return { ...r, date: d }
  }
  return undefined
}

export const DataContext = createContext<AppState | null>(null)

export function useData(): AppState {
  const s = useContext(DataContext)
  if (!s) throw new Error('DataContext missing')
  return s
}
