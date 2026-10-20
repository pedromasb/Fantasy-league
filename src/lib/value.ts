import { latestRec, latestSquad } from './data'
import { matchLeague, type League, type LeaguePlayer } from './league'
import type { AppState, Player } from '../types'

export interface ValueAlert {
  player: Player
  lp: LeaguePlayer
  owned: boolean
  kind: 'up' | 'down'
  /** Relative change over 1, 3 and 7 days. */
  d1?: number
  d3?: number
  d7?: number
  text: string
}

const change = (p: LeaguePlayer, d: number) => (p.value && p.valueAgo[d] ? p.value / p.valueAgo[d] - 1 : undefined)
const pctText = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`

/**
 * Market and squad players whose value is moving: rising streaks are speculation chances,
 * falling streaks in my squad are a cue to sell before losing more.
 */
export function valueAlerts(state: AppState, league: League | null): ValueAlert[] {
  if (!league) return []
  const owned = new Set(latestSquad(state)?.slots.map((x) => x.playerId))
  const marketDate = Object.keys(state.markets).sort().pop()
  const ids = new Set([...owned, ...(marketDate ? state.markets[marketDate].map((e) => e.playerId) : [])])
  const out: ValueAlert[] = []
  for (const id of ids) {
    const player = state.players[id]
    const lp = matchLeague(league, player)
    if (!player || !lp || player.pos === 'COA') continue
    const [d1, d3, d7] = [change(lp, 1), change(lp, 3), change(lp, 7)]
    const streak = lp.trendDays ?? 0
    const mine = owned.has(id)
    const verdict = mine ? latestRec(state, id)?.verdict : undefined
    const selling = verdict === 'vender'
    const keeping = verdict === 'mantener' || verdict === 'alinear'
    // Ignore slow drifts of cheap players: at least +3% in a week, or a sharp drop.
    if ((d7 ?? 0) >= 0.03 && (streak >= 3 || (d7 ?? 0) >= 0.05)) {
      const days = streak > 0 ? `lleva ${streak} días subiendo` : 'sube en la semana'
      out.push({
        player, lp, owned: mine, kind: 'up', d1, d3, d7,
        text: selling
          ? `${days} (${pctText(d7 ?? 0)} en 7 días). Si lo vas a vender, este es buen momento: vende al alza.`
          : mine
          ? `${days} (${pctText(d7 ?? 0)} en 7 días). Aguanta mientras siga subiendo.`
          : `${days} (${pctText(d7 ?? 0)} en 7 días). Candidato para especular si el precio no pasa mucho de su valor.`,
      })
    } else if ((d3 ?? 0) <= -0.03 || (streak <= -3 && (d7 ?? 0) <= -0.03)) {
      const days = streak < 0 ? `lleva ${-streak} días bajando` : 'cae en los últimos días'
      out.push({
        player, lp, owned: mine, kind: 'down', d1, d3, d7,
        text: keeping
          ? `${days} (${pctText(d7 ?? d3 ?? 0)} en ${d7 !== undefined ? 7 : 3} días). Lo mantienes según el plan; vigilo si la caída sigue.`
          : mine
          ? `${days} (${pctText(d7 ?? d3 ?? 0)} en ${d7 !== undefined ? 7 : 3} días). Si no lo vas a alinear, véndelo antes de que pierda más.`
          : `${days} (${pctText(d7 ?? d3 ?? 0)} en ${d7 !== undefined ? 7 : 3} días). Si te interesa, espera: saldrá más barato.`,
      })
    }
  }
  const strength = (a: ValueAlert) => Math.abs(a.d7 ?? a.d3 ?? 0) + Math.abs(a.lp.trendDays ?? 0) * 0.01
  out.sort((a, b) => Number(b.owned) - Number(a.owned) || strength(b) - strength(a))
  // Market players that are falling are only a hint: keep the five sharpest.
  let marketDown = 0
  return out.filter((a) => a.owned || a.kind === 'up' || ++marketDown <= 5)
}
