import { createContext, useContext } from 'react'

export type Tab = 'home' | 'report' | 'market' | 'squad' | 'top'

export interface Nav {
  tab: Tab
  go: (t: Tab) => void
  openPlayer: (id: string) => void
  /** Open a league-wide player that I do not track (league.json id). */
  openLeague: (id: number) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const n = useContext(NavContext)
  if (!n) throw new Error('NavContext missing')
  return n
}
