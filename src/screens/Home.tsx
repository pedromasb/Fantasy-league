import { useMemo } from 'react'
import { Donut, LineChart } from '../components/Charts'
import { IconChevron, IconSpark } from '../components/Icons'
import { PlayerRow } from '../components/PlayerRow'
import { Section, ScoreRing } from '../components/ui'
import { dailyAdvice, marketInsights, squadMembers, teamValueOf } from '../lib/analysis'
import { money, POS_LABEL, POS_ORDER, prettyDate, signedMoney } from '../lib/format'
import { useNav } from '../lib/nav'
import { latestReport, latestRec, latestSquad, today, useData } from '../lib/data'
import { VerdictBadge } from '../components/Verdict'

const POS_COLOR = { GK: 'var(--gk)', DEF: 'var(--def)', MID: 'var(--mid)', STR: 'var(--str)', COA: 'var(--coa)' }

export function Home() {
  const state = useData()
  const report = latestReport(state)
  const { go, openPlayer } = useNav()

  const members = useMemo(() => squadMembers(state), [state])
  const advice = useMemo(() => dailyAdvice(state), [state])
  const marketDate = Object.keys(state.markets).sort().pop()
  const market = useMemo(() => (marketDate ? marketInsights(state, marketDate) : []), [state, marketDate])
  const owned = new Set(members.map((m) => m.player.id))
  const best = market.find((m) => !owned.has(m.player.id))

  const teamSeries = useMemo(
    () =>
      Object.values(state.squads)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({ label: prettyDate(s.date), value: teamValueOf(state, s) }))
        .filter((x): x is { label: string; value: number } => x.value !== undefined),
    [state],
  )
  const snap = latestSquad(state)
  const teamValue = snap ? teamValueOf(state, snap) : undefined
  const prevValue = teamSeries.length > 1 ? teamSeries[teamSeries.length - 2].value : undefined
  const totalPoints = members.reduce((a, m) => a + (m.points ?? 0), 0)
  const gains = members.reduce((a, m) => a + (m.gain ?? 0), 0)
  const hasGains = members.some((m) => m.gain !== undefined)
  const posParts = POS_ORDER.map((p) => ({
    label: POS_LABEL[p],
    color: POS_COLOR[p],
    value: members.filter((m) => m.player.pos === p).reduce((a, m) => a + (m.value ?? 0), 0),
  })).filter((x) => x.value > 0)
  const posTotal = posParts.reduce((a, p) => a + p.value, 0)
  const empty = !Object.keys(state.markets).length && !Object.keys(state.squads).length

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">{prettyDate(today(), true)}</p>
          <h1>Tu asesor <span className="grad">Fantasy</span></h1>
        </div>
      </header>

      {empty ? (
        <div className="onboard card">
          <div className="onboard-glow" />
          <h2>Empecemos ⚽</h2>
          <p className="muted">Pásame en el chat los pantallazos del mercado y de tu plantilla. Yo actualizo los datos y escribo el informe del día aquí.</p>
        </div>
      ) : (
        <>
          <div className="hero card">
            <div className="hero-top">
              <div>
                <span className="eyebrow">Valor de equipo</span>
                <div className="hero-value">{money(teamValue)}</div>
                {prevValue !== undefined && teamValue !== undefined && (
                  <span className={`pill ${teamValue >= prevValue ? 'up' : 'down'}`}>
                    {signedMoney(teamValue - prevValue)} desde la última vez
                  </span>
                )}
              </div>
              {snap?.formation && <span className="formation-badge">{snap.formation}</span>}
            </div>
            <LineChart data={teamSeries} format={money} height={120} />
          </div>

          {report && (
            <button className="report-teaser card" onClick={() => go('report')}>
              <div className="spot-label"><IconSpark width={16} height={16} /> Informe del {prettyDate(report.date)}</div>
              <h3>{report.title}</h3>
              <p className="muted">{report.summary}</p>
              <span className="link">Leer informe completo →</span>
            </button>
          )}

          {(state.bids ?? []).length > 0 && (
            <div className="card pad bids">
              <div className="card-title">Tus pujas en curso</div>
              {(state.bids ?? []).map((b) => (
                <button key={b.playerId} className="bid-row" onClick={() => openPlayer(b.playerId)}>
                  <span className="grow"><b>{state.players[b.playerId]?.name}</b>{b.note && <small className="muted"> · {b.note}</small>}</span>
                  <b className="bid-amount">{money(b.amount)}</b>
                </button>
              ))}
            </div>
          )}

          <div className="kpis">
            <div className="kpi">
              <span>Saldo</span>
              <b className={state.budget !== undefined && state.budget < 0 ? 'neg' : ''}>{money(state.budget)}</b>
              <small>{state.budget === undefined ? 'pásamelo en el chat' : state.budgetDate ? `a ${prettyDate(state.budgetDate)}` : 'disponible'}</small>
            </div>
            <button className="kpi" onClick={() => go('squad')}>
              <span>Puntos plantilla</span>
              <b>{members.some((m) => m.points !== undefined) ? totalPoints : '—'}</b>
              <small>{members.length} jugadores</small>
            </button>
            <button className="kpi" onClick={() => go('market')}>
              <span>Mercado</span>
              <b>{market.length}</b>
              <small>{marketDate ? prettyDate(marketDate) : 'sin datos'}</small>
            </button>
            <div className="kpi">
              <span>Plusvalías</span>
              <b className={gains >= 0 ? 'pos' : 'neg'}>{hasGains ? signedMoney(gains) : '—'}</b>
              <small>{hasGains ? 'sobre precio de compra' : 'sin precios de compra'}</small>
            </div>
          </div>

          {best && (
            <button className="spotlight card" onClick={() => openPlayer(best.player.id)}>
              <div className="spot-label"><IconSpark width={16} height={16} /> Mejor nota del mercado</div>
              <div className="row gap between">
                <div>
                  <h3>{best.player.name}</h3>
                  <p className="muted">{POS_LABEL[best.player.pos]} · {money(best.entry.price)} · {best.points ?? 0} pts</p>
                </div>
                <div className="stack gap-s" style={{ alignItems: 'center' }}>
                  <ScoreRing score={best.score} size={56} />
                  {latestRec(state, best.player.id) && <VerdictBadge verdict={latestRec(state, best.player.id)!.verdict} />}
                </div>
              </div>
            </button>
          )}

          <Section title="Alertas automáticas" sub="Calculadas a partir de los datos">
            <div className="advice-list">
              {advice.length === 0 && <p className="muted">Sin alertas. ¡Buen trabajo, míster!</p>}
              {advice.map((a, i) => (
                <button key={i} className={`advice tone-${a.tone}`} onClick={() => a.playerId && openPlayer(a.playerId)} disabled={!a.playerId}>
                  <span className="advice-icon">{a.icon}</span>
                  <span className="advice-body">
                    <b>{a.title}</b>
                    <span>{a.text}</span>
                  </span>
                  {a.playerId && <IconChevron width={18} height={18} className="muted" />}
                </button>
              ))}
            </div>
          </Section>

          {posParts.length > 0 && (
            <Section title="Reparto del valor" sub="Dónde está invertido tu dinero">
              <div className="card pad donut-wrap">
                <Donut parts={posParts} />
                <ul className="legend">
                  {posParts.map((p) => (
                    <li key={p.label}>
                      <i style={{ background: p.color }} />
                      <span>{p.label}</span>
                      <b>{money(p.value)}</b>
                      <small className="muted">{Math.round((p.value / posTotal) * 100)}%</small>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          {members.length > 0 && (
            <Section title="Tus estrellas" action={<button className="link" onClick={() => go('squad')}>Ver plantilla</button>}>
              <div className="list card">
                {[...members].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 3).map((m) => (
                  <PlayerRow key={m.player.id} p={m} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
