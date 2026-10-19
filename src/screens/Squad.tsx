import { useMemo, useState } from 'react'
import { PlayerRow } from '../components/PlayerRow'
import { Empty, Section, Segmented, ScoreRing } from '../components/ui'
import { bestLineup, marketInsights, squadMembers, summarize, teamValueOf, type SquadMember } from '../lib/analysis'
import { money, POS_ORDER, prettyDate, signedMoney } from '../lib/format'
import { useNav } from '../lib/nav'
import { latestRec, latestReport, latestSquad, useData } from '../lib/data'
import type { Pos } from '../types'

function Pitch({ formation, members, ids }: { formation: string; members: SquadMember[]; ids: string[] }) {
  const { openPlayer } = useNav()
  const byId = new Map(members.map((m) => [m.player.id, m]))
  const chosen = ids.map((id) => byId.get(id)).filter((m): m is SquadMember => !!m)
  const take = (p: Pos) => chosen.filter((m) => m.player.pos === p)
  const [d, m, s] = formation.split('-').map(Number)
  const rows: [Pos, number][] = [['GK', 1], ['DEF', d], ['MID', m], ['STR', s]]
  const coach = take('COA')[0]
  return (
    <div className="pitch">
      <div className="pitch-lines">
        <span className="box top" /><span className="box bottom" /><span className="circle" /><span className="half" />
      </div>
      {rows.map(([p, n]) => {
        const list = take(p).slice(0, n)
        return (
          <div className="pitch-row" key={p}>
            {list.map((x) => (
              <button key={x.player.id} className="token" onClick={() => openPlayer(x.player.id)}>
                <span className={`token-face pos-ring-${p} ${x.status !== 'available' && x.status !== 'unknown' ? `st-${x.status}` : ''}`}>
                  {x.average !== undefined ? x.average.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : x.points ?? '–'}
                </span>
                <span className="token-name">{x.player.name}</span>
                <span className="token-val">{money(x.value)}</span>
              </button>
            ))}
            {Array.from({ length: Math.max(0, n - list.length) }).map((_, i) => (
              <span key={i} className="token empty"><span className="token-face">?</span><span className="token-name">Vacío</span></span>
            ))}
          </div>
        )
      })}
      {coach && (
        <button className="pitch-coach" onClick={() => openPlayer(coach.player.id)}>
          <span className="muted">ENT</span> {coach.player.name}
        </button>
      )}
    </div>
  )
}

export function Squad() {
  const state = useData()
  const [view, setView] = useState<'mine' | 'best'>('mine')
  const snap = latestSquad(state)
  const members = useMemo(() => squadMembers(state), [state])
  const reportLineup = latestReport(state)?.lineup
  const computed = useMemo(() => bestLineup(members), [members])
  const best = reportLineup ? { ...reportLineup, total: undefined } : computed
  const marketDate = Object.keys(state.markets).sort().pop()
  const market = useMemo(() => (marketDate ? marketInsights(state, marketDate) : []), [state, marketDate])

  if (!snap || !members.length)
    return (
      <div className="screen">
        <header className="top"><h1>Mi plantilla</h1></header>
        <Empty icon="👕" title="Sin plantilla" text="Pásame el pantallazo de tu alineación en el chat." />
      </div>
    )

  const owned = new Set(members.map((m) => m.player.id))
  const mineIds = snap.slots.filter((x) => x.starter).map((x) => x.playerId)
  const formation = view === 'best' && best ? best.formation : snap.formation ?? best?.formation ?? '4-4-2'
  const ids = view === 'best' && best ? best.ids : mineIds
  const teamValue = teamValueOf(state, snap)
  const bench = members.filter((m) => !ids.includes(m.player.id))

  const report = latestReport(state)
  const autoSell = members
    .filter((m) => m.player.pos !== 'COA')
    .map((m) => {
      let risk = 0
      const why: string[] = []
      if (m.status === 'injured') { risk += 3; why.push('lesionado') }
      if (m.status === 'suspended') { risk += 1; why.push('sancionado') }
      if ((m.trend ?? 0) < -0.01) { risk += 2; why.push('valor a la baja') }
      if (m.average !== undefined && m.average < 3) { risk += 1; why.push('media baja') }
      if (m.average !== undefined && m.value && m.value > 10e6 && m.average < 4) { risk += 1; why.push('caro para lo que puntúa') }
      if (m.recent && m.recent.slice(-3).every((n) => n === null || n <= 1)) { risk += 1; why.push('sin forma') }
      if (!ids.includes(m.player.id) && view === 'mine') { risk += 0.5; why.push('no es titular') }
      return { m, risk, why }
    })
    .filter((x) => x.risk >= 2)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 4)
  // My written verdicts take precedence over the heuristic once a report exists.
  const sell = report
    ? members.filter((m) => latestRec(state, m.player.id)?.verdict === 'vender').map((m) => ({ m, why: [] as string[] }))
    : autoSell

  const exposed = members
    .filter((m) => m.clause !== undefined && m.value && !m.clauseLockDays && m.clause <= m.value * 1.1 && m.value > 3e6)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const upgrades = report ? [] : POS_ORDER.flatMap((p) => {
    const mine = members.filter((m) => m.player.pos === p).sort((a, b) => (a.points ?? 0) - (b.points ?? 0))
    const weakest = mine[0]
    if (!weakest) return []
    const reach = (state.budget ?? Infinity) + (weakest.value ?? 0)
    const cand = market
      .filter((x) => x.player.pos === p && !owned.has(x.player.id) && x.status !== 'injured')
      .filter((x) => (x.points ?? 0) > (weakest.points ?? 0) && x.entry.price <= reach)
      .sort((a, b) => b.score - a.score)[0]
    return cand ? [{ out: weakest, in: cand }] : []
  })

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">Actualizada {prettyDate(snap.date)} · {members.length} jugadores</p>
          <h1>Mi plantilla</h1>
        </div>
        <div className="top-figure">
          <span>Valor</span>
          <b>{money(teamValue)}</b>
        </div>
      </header>

      <Segmented options={[{ value: 'mine', label: `Mi once${snap.formation ? ` · ${snap.formation}` : ''}` }, { value: 'best', label: `${reportLineup ? 'Recomendado' : 'Once ideal'}${best ? ` · ${best.formation}` : ''}` }]} value={view} onChange={setView} />
      <Pitch
        formation={formation}
        ids={ids}
        members={[
          ...members,
          ...ids.filter((id) => state.players[id] && !owned.has(id)).map((id) => ({ ...summarize(state, id), starter: false })),
        ]}
      />
      {view === 'best' && reportLineup?.note && <p className="footnote center">{reportLineup.note}</p>}
      {view === 'best' && !reportLineup && computed && <p className="footnote center">Elegido por puntos de temporada, sin lesionados ni sancionados. Total: <b>{Math.round(computed.total)} pts</b></p>}

      {upgrades.length > 0 && (
        <Section title="Mejoras posibles" sub="Cambia a tu peor jugador de cada línea por alguien del mercado">
          <div className="stack gap">
            {upgrades.map(({ out, in: inn }) => (
              <div key={out.player.id} className="swap card">
                <div className="swap-side out">
                  <span className="muted small">Sale</span>
                  <b>{out.player.name}</b>
                  <span className="small">{out.points ?? 0} pts · {money(out.value)}</span>
                </div>
                <span className="swap-arrow">→</span>
                <div className="swap-side in">
                  <span className="muted small">Entra</span>
                  <b>{inn.player.name}</b>
                  <span className="small">{inn.points ?? 0} pts · {money(inn.entry.price)}</span>
                </div>
                <ScoreRing score={inn.score} size={40} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {exposed.length > 0 && (
        <Section title="🔓 Cláusulas expuestas" sub="Cualquier rival puede llevárselos pagando casi su valor">
          <div className="list card">
            {exposed.map((m) => (
              <PlayerRow key={m.player.id} p={m} tags={[{ label: `Cláusula ${money(m.clause)}`, tone: 'warn' }]} />
            ))}
          </div>
        </Section>
      )}

      {sell.length > 0 && (
        <Section title="Candidatos a venta">
          <div className="list card">
            {sell.map(({ m, why }) => (
              <PlayerRow key={m.player.id} p={m} tags={why.map((w) => ({ label: w, tone: w === 'no es titular' ? 'info' : 'bad' }))} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Toda la plantilla" sub={state.budget !== undefined ? `Saldo: ${money(state.budget)}` : undefined}>
        <div className="list card">
          {[...members]
            .sort((a, b) => POS_ORDER.indexOf(a.player.pos) - POS_ORDER.indexOf(b.player.pos) || (b.points ?? 0) - (a.points ?? 0))
            .map((m) => (
              <PlayerRow
                key={m.player.id}
                p={m}
                tags={[
                  ...(bench.includes(m) ? [{ label: 'Suplente', tone: 'info' as const }] : []),
                  ...(m.gain !== undefined ? [{ label: `${signedMoney(m.gain)}`, tone: m.gain >= 0 ? ('good' as const) : ('bad' as const) }] : []),
                ]}
              />
            ))}
        </div>
      </Section>
      {members.some((m) => m.value === undefined) && (
        <p className="footnote">Algunos jugadores no tienen valor todavía: aparecerá cuando salgan en el mercado o si pegas el texto de la pestaña "Squad".</p>
      )}
    </div>
  )
}
