import { useState } from 'react'
import { IconChevron } from '../components/Icons'
import { Avatar, Chips, Empty, PosBadge, Section } from '../components/ui'
import { VerdictBadge } from '../components/Verdict'
import { latestSquad, useData } from '../lib/data'
import { money, prettyDate } from '../lib/format'
import { useNav } from '../lib/nav'
import type { PlayerRec } from '../types'

export function Report() {
  const state = useData()
  const { openPlayer } = useNav()
  const dates = Object.keys(state.reports).sort().reverse()
  const [date, setDate] = useState(dates[0] ?? '')
  const current = dates.includes(date) ? date : dates[0]
  const report = current ? state.reports[current] : undefined

  if (!report)
    return (
      <div className="screen">
        <header className="top"><h1>Informe</h1></header>
        <Empty icon="📝" title="Aún no hay informes" text="Pásame en el chat el pantallazo del mercado y escribiré aquí el informe del día." />
      </div>
    )

  const owned = new Set(latestSquad(state)?.slots.map((x) => x.playerId))
  const recs = Object.entries(report.players).filter(([id]) => state.players[id])
  const marketIds = new Set((state.markets[current] ?? []).map((e) => e.playerId))
  const squadRecs = recs.filter(([id]) => owned.has(id))
  const marketRecs = recs.filter(([id]) => !owned.has(id) && marketIds.has(id))
  const otherRecs = recs.filter(([id]) => !owned.has(id) && !marketIds.has(id))
  const order: Record<string, number> = { fichar: 0, pujar: 1, vender: 2, alinear: 3, vigilar: 4, mantener: 5, banquillo: 6, evitar: 7 }
  const byVerdict = (a: [string, PlayerRec], b: [string, PlayerRec]) => order[a[1].verdict] - order[b[1].verdict]

  const RecRow = ({ id, r }: { id: string; r: PlayerRec }) => {
    const p = state.players[id]
    const entry = state.markets[current]?.find((e) => e.playerId === id)
    return (
      <button className="rec-row" onClick={() => openPlayer(id)}>
        <Avatar name={p.name} pos={p.pos} size={40} />
        <div className="grow">
          <div className="row gap-s between">
            <div className="prow-name"><PosBadge pos={p.pos} /><span>{p.name}</span></div>
            <VerdictBadge verdict={r.verdict} />
          </div>
          <p className="rec-text">{r.text}</p>
          <div className="row gap-s wrap">
            {entry && <span className="muted small">Precio {money(entry.price)} · {entry.points} pts</span>}
            {r.maxBid !== undefined && <span className="tag tone-good">Máx. {money(r.maxBid)}</span>}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">Informe del {prettyDate(current, true)}</p>
          <h1>{report.title}</h1>
        </div>
      </header>
      {dates.length > 1 && <Chips options={dates.slice(0, 14).map((d) => ({ value: d, label: prettyDate(d) }))} value={current} onChange={setDate} />}

      <div className="summary card">
        <div className="summary-glow" />
        <span className="eyebrow">Resumen</span>
        <p>{report.summary}</p>
      </div>

      {report.sections.map((sec) => (
        <Section key={sec.title} title={`${sec.icon} ${sec.title}`}>
          <div className="card report-list">
            {sec.items.map((it, i) => (
              <button key={i} className="report-item" disabled={!it.playerId} onClick={() => it.playerId && openPlayer(it.playerId)}>
                <span className="bullet" />
                <span className="grow">{it.text}</span>
                {it.playerId && <IconChevron width={16} height={16} className="muted" />}
              </button>
            ))}
          </div>
        </Section>
      ))}

      {marketRecs.length > 0 && (
        <Section title="🛒 Jugador a jugador: mercado" sub="Toca uno para ver sus estadísticas">
          <div className="card list">{[...marketRecs].sort(byVerdict).map(([id, r]) => <RecRow key={id} id={id} r={r} />)}</div>
        </Section>
      )}
      {squadRecs.length > 0 && (
        <Section title="👕 Jugador a jugador: tu plantilla">
          <div className="card list">{[...squadRecs].sort(byVerdict).map(([id, r]) => <RecRow key={id} id={id} r={r} />)}</div>
        </Section>
      )}
      {otherRecs.length > 0 && (
        <Section title="👀 Otros jugadores">
          <div className="card list">{[...otherRecs].sort(byVerdict).map(([id, r]) => <RecRow key={id} id={id} r={r} />)}</div>
        </Section>
      )}
      <p className="footnote">Estadísticas sacadas de búsquedas web (LaLiga, FotMob, Comuniate, prensa…). Cuando las fuentes no coinciden lo indico en la ficha del jugador.</p>
    </div>
  )
}
