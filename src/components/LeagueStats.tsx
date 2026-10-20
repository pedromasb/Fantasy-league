import { difficulty, nextFixtures, type League, type LeaguePlayer } from '../lib/league'
import { money, num, pct } from '../lib/format'
import { AdvancedStats, MatchdayTable, SeasonChart, usePlayerDeep } from './SeasonCharts'

/** Points per matchday as small bars; empty slot = did not play. */
function WeekBars({ p, lastWeek }: { p: LeaguePlayer; lastWeek: number }) {
  const weeks = Array.from({ length: lastWeek }, (_, i) => i + 1)
  const vals = weeks.map((w) => p.weeks[String(w)])
  const max = Math.max(4, ...vals.map((v) => Math.abs(v ?? 0)))
  return (
    <div className="weekbars">
      {weeks.map((w, i) => {
        const v = vals[i]
        const h = v === null || v === undefined ? 0 : (Math.abs(v) / max) * 64
        const tone = v === null || v === undefined ? 'none' : v < 0 ? 'neg' : v >= 8 ? 'top' : v >= 5 ? 'good' : v >= 2 ? 'mid' : 'low'
        return (
          <div key={w} className="weekbar">
            <span className="wb-val">{v ?? '–'}</span>
            <span className={`wb-bar f-${tone}`} style={{ height: Math.max(h, v === null || v === undefined ? 0 : 3) }} />
            <span className="wb-week">{w}</span>
          </div>
        )
      })}
    </div>
  )
}

export function LeagueStats({ league, p }: { league: League; p: LeaguePlayer }) {
  const deep = usePlayerDeep(p.id)
  const fixtures = nextFixtures(league, p.teamId)
  const change = (d: number) => (p.value && p.valueAgo[d] ? p.value / p.valueAgo[d] - 1 : undefined)
  const team = league.teams[p.teamId]
  return (
    <>
      <div className="card pad">
        <div className="card-title">LaLiga Fantasy · temporada {league.season}</div>
        <div className="league-kpis">
          <div><b>{p.points ?? '—'}</b><span>puntos</span></div>
          <div><b>{num(p.average, 2)}</b><span>media</span></div>
          <div><b>{p.played ?? '—'}</b><span>jugados</span></div>
          <div><b>{p.rank ? `#${p.rank}` : '—'}</b><span>ranking</span></div>
          <div><b>{p.titularity !== undefined ? `${p.titularity}%` : '—'}</b><span>titularidad</span></div>
          <div><b>{p.last5.reduce<number>((a, x) => a + (x ?? 0), 0)}</b><span>últ. 5 jorn.</span></div>
        </div>
        {p.lastSeason && (
          <p className="small muted" style={{ marginTop: 8 }}>
            Temporada pasada: {p.lastSeason.points} pts · {num(p.lastSeason.average, 2)} de media en {p.lastSeason.played} partidos
          </p>
        )}
      </div>

      {p.xg && p.xg.minutes > 0 && <ExpectedCard xg={p.xg} />}

      {deep && deep.values.length > 1 ? (
        <div className="card pad">
          <div className="card-title">Valor y puntos · toda la temporada</div>
          <SeasonChart deep={deep} />
        </div>
      ) : (
        <div className="card pad">
          <div className="card-title">Puntos por jornada</div>
          <WeekBars p={p} lastWeek={league.lastWeek} />
        </div>
      )}

      <div className="card pad">
        <div className="card-title">Evolución del valor</div>
        <div className="value-steps">
          {[1, 3, 7, 14, 30].map((d) => {
            const c = change(d)
            return (
              <div key={d}>
                <span>{d === 1 ? '1 día' : `${d} días`}</span>
                <b className={c === undefined ? '' : c >= 0 ? 'pos' : 'neg'}>{pct(c)}</b>
                <small className="muted">{money(p.valueAgo[d])}</small>
              </div>
            )
          })}
        </div>
        {p.trendDays !== undefined && (
          <p className="small muted" style={{ marginTop: 8 }}>
            {p.trendDays > 0 ? `Lleva ${p.trendDays} días subiendo` : p.trendDays < 0 ? `Lleva ${-p.trendDays} días bajando` : 'Estable'}
          </p>
        )}
      </div>

      {deep && deep.weeks.length > 0 && (
        <div className="card pad">
          <div className="card-title">Jornada a jornada</div>
          <MatchdayTable deep={deep} />
        </div>
      )}

      {deep?.season && Object.keys(deep.season).length > 0 && (
        <div className="card pad">
          <div className="card-title">Estadísticas avanzadas · temporada</div>
          <AdvancedStats season={deep.season} />
        </div>
      )}

      {fixtures.length > 0 && (
        <div className="card pad">
          <div className="card-title">Próximos partidos · {p.team}{team ? ` (${team.rank}º)` : ''}</div>
          <div className="fixtures">
            {fixtures.map((f) => {
              const d = difficulty(league, f.rivalId, f.home_)
              return (
                <div key={f.id} className={`fixture diff-${d}`}>
                  <span className="fx-week">J{f.week}</span>
                  <b>{f.rival}</b>
                  <span className="fx-where">{f.home_ ? '🏠' : '✈️'}</span>
                  <small>{league.teams[f.rivalId]?.rank ?? '?'}º</small>
                </div>
              )
            })}
          </div>
          {p.next?.prob !== undefined && <p className="small muted" style={{ marginTop: 8 }}>Probabilidad de jugar la jornada {p.next.week}: <b>{p.next.prob}%</b></p>}
        </div>
      )}
    </>
  )
}

const per90 = (v: number, min: number) => (min > 0 ? (v / min) * 90 : 0)
const n2 = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** understat expected goals/assists against what actually happened. */
function ExpectedCard({ xg }: { xg: NonNullable<LeaguePlayer['xg']> }) {
  const gDiff = xg.goals - xg.xG
  const aDiff = xg.assists - xg.xA
  const read =
    gDiff + aDiff <= -1
      ? 'Genera más de lo que ha convertido: lo normal es que los goles y asistencias lleguen. Buena señal para comprar o mantener.'
      : gDiff + aDiff >= 1.5
        ? 'Está rindiendo por encima de lo que genera: puede bajar su producción. Ojo si su precio ya lo refleja.'
        : 'Su producción va acorde a las ocasiones que genera.'
  return (
    <div className="card pad">
      <div className="card-title">Goles y asistencias esperados · Understat</div>
      <div className="xg-compare">
        <div>
          <span>Goles</span>
          <b>{xg.goals} <small className="muted">/ {n2(xg.xG)} xG</small></b>
          <small className={gDiff >= 0 ? 'pos' : 'neg'}>{gDiff >= 0 ? '+' : ''}{n2(gDiff)}</small>
        </div>
        <div>
          <span>Asistencias</span>
          <b>{xg.assists} <small className="muted">/ {n2(xg.xA)} xA</small></b>
          <small className={aDiff >= 0 ? 'pos' : 'neg'}>{aDiff >= 0 ? '+' : ''}{n2(aDiff)}</small>
        </div>
      </div>
      <div className="league-kpis" style={{ marginTop: 8 }}>
        <div><b>{n2(per90(xg.xG, xg.minutes))}</b><span>xG / 90'</span></div>
        <div><b>{n2(per90(xg.xA, xg.minutes))}</b><span>xA / 90'</span></div>
        <div><b>{n2(xg.npxG)}</b><span>xG sin penaltis</span></div>
        <div><b>{n2(per90(xg.shots, xg.minutes))}</b><span>tiros / 90'</span></div>
        <div><b>{n2(per90(xg.keyPasses, xg.minutes))}</b><span>pases clave / 90'</span></div>
        <div><b>{n2(per90(xg.xGChain, xg.minutes))}</b><span>xGChain / 90'</span></div>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>{read} ({xg.minutes}' en {xg.games} partidos)</p>
    </div>
  )
}
