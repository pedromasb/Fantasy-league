import { createContext, useContext } from 'react'

export type Tab = 'home' | 'market' | 'import' | 'squad' | 'top' | 'settings'

export interface Nav {
  tab: Tab
  go: (t: Tab) => void
  openPlayer: (id: string) => void
  toast: (msg: string) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const n = useContext(NavContext)
  if (!n) throw new Error('NavContext missing')
  return n
}
