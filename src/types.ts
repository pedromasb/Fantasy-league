export type Pos = 'GK' | 'DEF' | 'MID' | 'STR' | 'COA'

export type Status = 'available' | 'injured' | 'doubtful' | 'suspended' | 'unknown'

export interface Player {
  id: string
  name: string
  pos: Pos
  team?: string
}

/** One player as listed in the market on a given day. */
export interface MarketEntry {
  playerId: string
  value: number
  price: number
  points: number
  status: Status
  bids: number
}

export interface SquadSlot {
  playerId: string
  /** Part of the starting XI (or the coach slot) in the uploaded line-up. */
  starter: boolean
  /** Value/points if the squad text carried them (Squad tab). */
  value?: number
  points?: number
  status?: Status
}

export interface SquadSnapshot {
  date: string
  formation?: string
  teamValue?: number
  slots: SquadSlot[]
}

export interface AppState {
  version: 1
  players: Record<string, Player>
  /** date (YYYY-MM-DD) -> entries */
  markets: Record<string, MarketEntry[]>
  /** date (YYYY-MM-DD) -> snapshot */
  squads: Record<string, SquadSnapshot>
  /** playerId -> purchase price, entered by the user */
  purchases: Record<string, number>
  budget?: number
  budgetDate?: string
}

export const emptyState = (): AppState => ({
  version: 1,
  players: {},
  markets: {},
  squads: {},
  purchases: {},
})
