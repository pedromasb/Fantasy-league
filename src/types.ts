export type Pos = 'GK' | 'DEF' | 'MID' | 'STR' | 'COA'

export type Status = 'available' | 'injured' | 'doubtful' | 'suspended' | 'unknown'

export interface Source {
  title: string
  url: string
}

/** Season numbers gathered from the web; any field may be missing. */
export interface SeasonStats {
  season: string
  apps?: number
  starts?: number
  minutes?: number
  goals?: number
  assists?: number
  shots?: number
  yellow?: number
  red?: number
  /** Free-form extras such as "Paradas": 100. */
  extra?: Record<string, string | number>
}

export interface NewsItem {
  date: string
  text: string
  tone?: 'good' | 'bad' | 'warn' | 'info'
}

export interface Player {
  id: string
  name: string
  pos: Pos
  team?: string
  fullName?: string
  born?: string
  nationality?: string
  stats?: SeasonStats[]
  news?: NewsItem[]
  sources?: Source[]
  statsUpdated?: string
}

/** One player as listed in the market on a given day. */
export interface MarketEntry {
  playerId: string
  value: number
  price: number
  points: number
  status: Status
  bids: number
  /** Fantasy points per matchday played. */
  average?: number
  /** Last five matchdays, oldest first; null = did not play. */
  recent?: (number | null)[]
}

export interface SquadSlot {
  playerId: string
  /** Part of the starting XI (or the coach slot) in the line-up screenshot. */
  starter: boolean
  value?: number
  points?: number
  status?: Status
  average?: number
  recent?: (number | null)[]
  /** Release clause; rivals can buy the player by paying it. */
  clause?: number
  /** Days left before the clause can be paid (recent signings). */
  clauseLockDays?: number
  captain?: boolean
}

export interface PendingBid {
  playerId: string
  amount: number
  date: string
  note?: string
}

export interface SquadSnapshot {
  date: string
  formation?: string
  teamValue?: number
  signings?: string
  slots: SquadSlot[]
}

export type Verdict = 'fichar' | 'pujar' | 'vigilar' | 'evitar' | 'mantener' | 'vender' | 'alinear' | 'banquillo'

export interface PlayerRec {
  verdict: Verdict
  text: string
  /** Highest sensible bid in euros. */
  maxBid?: number
  confidence?: 'alta' | 'media' | 'baja'
}

export interface ReportItem {
  text: string
  playerId?: string
}

export interface Report {
  date: string
  title: string
  summary: string
  sections: { title: string; icon: string; items: ReportItem[] }[]
  /** playerId -> recommendation for that day */
  players: Record<string, PlayerRec>
  lineup?: { formation: string; ids: string[]; note?: string }
}

export interface AppState {
  version: 1
  updated: string
  players: Record<string, Player>
  /** date (YYYY-MM-DD) -> entries */
  markets: Record<string, MarketEntry[]>
  /** date (YYYY-MM-DD) -> snapshot */
  squads: Record<string, SquadSnapshot>
  /** playerId -> purchase price */
  purchases: Record<string, number>
  budget?: number
  budgetDate?: string
  /** Bids placed in the market that have not resolved yet. */
  bids?: PendingBid[]
  /** date (YYYY-MM-DD) -> daily report */
  reports: Record<string, Report>
}
