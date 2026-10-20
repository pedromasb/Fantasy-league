import { createContext, useContext } from 'react'
import type { Player, Pos, Status } from '../types'

/** Whole-league data synced daily by scripts/sync-league.mjs. */
export interface LeaguePlayer {
  id: number
  name: string
  fullName?: string
  pos: Pos
  teamId: number
  team: string
  value?: number
  /** Value N days ago (1, 2, 3, 7, 14, 30). */
  valueAgo: Record<string, number>
  trendDays?: number
  next?: { week: number; rival: string; home: boolean; prob?: number }
  points?: number
  average?: number
  played?: number
  rank?: number
  lastSeason?: { points: number; average: number; played: number }
  titularity?: number
  status?: Status
  dayChange?: number
  /** Matchday -> LaLiga Fantasy points (null = in the squad, did not play). */
  weeks: Record<string, number | null>
  minutes?: Record<string, number>
  /** Points in the last five finished matchdays (null = did not play). */
  last5: (number | null)[]
  /** understat.com season totals. */
  xg?: {
    id: number
    games: number
    minutes: number
    goals: number
    xG: number
    npg: number
    npxG: number
    assists: number
    xA: number
    shots: number
    keyPasses: number
    xGChain: number
    xGBuildup: number
  }
}

export interface TeamRow {
  id: number
  name: string
  played: number
  pts: number
  gf: number
  ga: number
  form: ('W' | 'D' | 'L')[]
  rank: number
  /** understat.com expected goals for and against (season and last five matches). */
  xG?: number
  xGA?: number
  games?: number
  last5xG?: number
  last5xGA?: number
}

export interface Fixture {
  id: number
  week: number
  home: number
  away: number
  homeName: string
  awayName: string
  score?: [number, number]
  when?: string
  finished: boolean
}

export interface League {
  updated: string
  season: string
  lastWeek: number
  recentWeeks: number[]
  teams: Record<string, TeamRow>
  teamNames: Record<string, string>
  fixtures: Fixture[]
  players: LeaguePlayer[]
}

export async function loadLeague(): Promise<League | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/league.json`, { cache: 'no-cache' })
    return res.ok ? ((await res.json()) as League) : null
  } catch {
    return null
  }
}

export const LeagueContext = createContext<League | null>(null)
export const useLeague = () => useContext(LeagueContext)

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const TEAM_ALIASES: Record<string, string> = {
  'real betis': 'betis', 'celta vigo': 'celta', 'rayo vallecano': 'rayo', 'athletic club': 'athletic',
  'atletico madrid': 'atletico', 'atletico de madrid': 'atletico', 'racing de santander': 'racing', 'racing santander': 'racing',
  'deportivo la coruna': 'deportivo',
}
const teamKey = (s?: string) => (s ? (TEAM_ALIASES[norm(s)] ?? norm(s)) : '')

/** Find the league entry for one of my tracked players (by id, then name and team). */
export function matchLeague(league: League | null, p: Player | undefined): LeaguePlayer | undefined {
  if (!league || !p) return undefined
  if (p.ffId) return league.players.find((x) => x.id === p.ffId)
  const team = teamKey(p.team)
  const sameTeam = league.players.filter((x) => !team || teamKey(x.team) === team)
  const names = [p.name, p.fullName].filter(Boolean).map((n) => norm(n!))
  const exact = sameTeam.filter((x) => names.includes(norm(x.name)) || (x.fullName && names.includes(norm(x.fullName))))
  if (exact.length === 1) return exact[0]
  const words = new Set(names.flatMap((n) => n.split(' ')))
  const loose = sameTeam.filter((x) => norm(x.name).split(' ').every((w) => words.has(w)))
  return loose.length === 1 ? loose[0] : undefined
}

/** Points over the last five finished matchdays. */
export const formPoints = (p: LeaguePlayer) => p.last5.reduce<number>((a, x) => a + (x ?? 0), 0)

/** Upcoming fixtures for a team, soonest first. */
export function nextFixtures(league: League, teamId: number, n = 5): (Fixture & { home_: boolean; rival: string; rivalId: number })[] {
  return league.fixtures
    .filter((f) => !f.finished && (f.home === teamId || f.away === teamId))
    .sort((a, b) => a.week - b.week)
    .slice(0, n)
    .map((f) => ({ ...f, home_: f.home === teamId, rival: f.home === teamId ? f.awayName : f.homeName, rivalId: f.home === teamId ? f.away : f.home }))
}

/** Rival's expected goals for and against per match: 60% season, 40% last five matches. */
export function teamRates(t?: TeamRow): { xg: number; xga: number } | undefined {
  if (!t || t.xG === undefined || t.xGA === undefined || !t.games) return undefined
  const blend = (season: number, last5?: number) =>
    last5 === undefined ? season / t.games! : 0.6 * (season / t.games!) + 0.4 * (last5 / Math.min(5, t.games!))
  return { xg: blend(t.xG, t.last5xG), xga: blend(t.xGA, t.last5xGA) }
}

/** Share of teams (0-1) with a lower value than v. */
const percentile = (v: number, all: number[]) => all.filter((x) => x < v).length / Math.max(all.length - 1, 1)

/**
 * 1 (easy) to 5 (hard). Goalkeepers and defenders face the rival's attack (its xG),
 * midfielders and forwards its defence (a low xGA is hard); without a position both count.
 * Falls back to the table position when there is no understat data. Playing away adds difficulty.
 */
export function difficulty(league: League, rivalId: number, home: boolean, pos?: Pos): number {
  const rates = Object.values(league.teams).map(teamRates).filter((r): r is { xg: number; xga: number } => !!r)
  const r = teamRates(league.teams[rivalId])
  let hard: number
  if (r && rates.length > 2) {
    const attack = percentile(r.xg, rates.map((x) => x.xg))
    const defence = 1 - percentile(r.xga, rates.map((x) => x.xga))
    hard = pos === 'GK' || pos === 'DEF' ? attack : pos === 'MID' || pos === 'STR' ? defence : (attack + defence) / 2
  } else {
    const n = Object.keys(league.teams).length || 20
    hard = (n - (league.teams[rivalId]?.rank ?? 10)) / (n - 1)
  }
  return Math.max(1, Math.min(5, Math.round(1 + 4 * hard + (home ? -0.4 : 0.4))))
}

/** (xG + xA) per 90 minutes, for players with enough minutes. */
export const threat = (p: LeaguePlayer, minMinutes = 270) =>
  p.xg && p.xg.minutes >= minMinutes ? ((p.xg.xG + p.xg.xA) / p.xg.minutes) * 90 : undefined
