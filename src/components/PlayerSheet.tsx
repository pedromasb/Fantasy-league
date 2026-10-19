import { useEffect, useMemo } from 'react'
import { history, summarize } from '../lib/analysis'
import { latestRec, latestSquad, useData } from '../lib/data'
import { money, num, POS_NAME, prettyDate, signedMoney } from '../lib/format'
import type { SeasonStats } from '../types'
import { LineChart } from './Charts'
import { IconClose } from './Icons'
import { Avatar, Delta, Form, PosBadge, StatusPill } from './ui'
import { VerdictBadge } from './Verdict'

const STAT_FIELDS: [keyof SeasonStats, string][] = [
  ['apps', 'Partidos'],
  ['starts', 'Titular'],
  ['minutes', 'Minutos'],
  ['goals', 'Goles'],
  ['assists', 'Asist.'],
  ['shots', 'Tiros'],
  ['yellow', 'Amarillas'],
  ['red', 'Rojas'],
]

function StatsTable({ s }: { s: SeasonStats }) {
  const cells = STAT_FIELDS.filter(([k]) => s[k] !== undefined)
  const perMatch = s.minutes && s.apps ? Math.round(s.minutes / s.apps) : undefined
  const ga = (s.goals ?? 0) + (s.assists ?? 0)
  return (
    <div className="season">
      <div className="season-head">
        <b>{s.season}</b>
        {perMatch !== undefined && <span className="muted small">{perMatch}' por partido</span>}
        {s.minutes && ga > 0 ? <span className="muted small">· G+A cada {Math.round(s.minutes / ga)}'</span> : null}
      </div>
      <div className="season-grid">
        {cells.map(([k, label]) => (
          <div key={k}>
            <b>{s[k] as number}</b>
            <span>{label}</span>
          </div>
        ))}
        {Object.entries(s.extra ?? {}).map(([k, v]) => (
          <div key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlayerSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useData()
  const player = state.players[id]
  const sum = useMemo(() => (player ? summarize(state, id) : undefined), [state, id, player])
  const h = useMemo(() => history(state, id), [state, id])
  const rec = latestRec(state, id)
  const owned = latestSquad(state)?.slots.some((x) => x.playerId === id) ?? false

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!player || !sum) return null
  const purchase = state.purchases[id]
  const gain = purchase !== undefined && sum.value !== undefined ? sum.value - purchase : undefined
  const valueData = h.filter((o) => o.value).map((o) => ({ label: prettyDate(o.date), value: o.value! }))
  const pointsData = h.filter((o) => o.points !== undefined).map((o) => ({ label: prettyDate(o.date), value: o.points! }))
  const falling = valueData.length > 1 && valueData[valueData.length - 1].value < valueData[0].value

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={player.name}>
        <div className="sheet-grip" />
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Cerrar"><IconClose /></button>

        <div className="sheet-hero">
          <Avatar name={player.name} pos={player.pos} size={68} status={sum.status} />
          <div>
            <h2>{player.name}</h2>
            {player.fullName && player.fullName !== player.name && <p className="muted small">{player.fullName}</p>}
            <div className="row gap-s wrap hero-tags">
              <PosBadge pos={player.pos} />
              <span className="muted small">{POS_NAME[player.pos]}{player.team ? ` · ${player.team}` : ''}</span>
              <StatusPill status={sum.status} />
              {owned && <span className="tag tone-info">En tu plantilla</span>}
            </div>
          </div>
        </div>

        {rec && (
          <div className="rec card">
            <div className="row between">
              <span className="eyebrow">Mi recomendación · {prettyDate(rec.date)}</span>
              <VerdictBadge verdict={rec.verdict} big />
            </div>
            <p>{rec.text}</p>
            <div className="row gap-s wrap">
              {rec.maxBid !== undefined && <span className="tag tone-good">Puja máxima: {money(rec.maxBid)}</span>}
              {rec.confidence && <span className="tag tone-info">Confianza {rec.confidence}</span>}
            </div>
          </div>
        )}

        <div className="stat-grid">
          <div className="stat"><span>Valor</span><b>{money(sum.value)}</b><Delta value={sum.changePct} small /></div>
          <div className="stat"><span>Puntos Fantasy</span><b>{sum.points ?? '—'}</b><small className="muted">temporada</small></div>
          <div className="stat"><span>Media</span><b>{num(sum.average, 2)}</b><small className="muted">pts por jornada</small></div>
          <div className="stat"><span>Pts / M€</span><b>{num(sum.ppm)}</b><small className="muted">rentabilidad</small></div>
        </div>

        {sum.recent && (
          <div className="card pad row between">
            <div className="stack">
              <span className="card-title" style={{ margin: 0 }}>Últimas jornadas</span>
              <span className="muted small">de más antigua a más reciente</span>
            </div>
            <Form recent={sum.recent} />
          </div>
        )}

        {sum.clause !== undefined && (
          <div className={`card pad clause ${!sum.clauseLockDays && sum.value && sum.clause <= sum.value * 1.1 ? 'exposed' : ''}`}>
            <div className="row between">
              <span className="card-title" style={{ margin: 0 }}>Cláusula</span>
              <b>{money(sum.clause)}</b>
            </div>
            <p className="small muted">
              {sum.clauseLockDays
                ? `Blindado: nadie puede pagarla durante ${sum.clauseLockDays} días más.`
                : sum.value && sum.clause <= sum.value * 1.1
                  ? 'Su cláusula es casi igual a su valor: cualquier rival puede llevárselo pagándola. Súbela cuando tengas saldo.'
                  : sum.value
                    ? `Un ${Math.round((sum.clause / sum.value - 1) * 100)}% por encima de su valor.`
                    : ''}
            </p>
          </div>
        )}

        {player.stats && player.stats.length > 0 && (
          <div className="card pad">
            <div className="card-title">Estadísticas{player.statsUpdated ? ` · ${prettyDate(player.statsUpdated)}` : ''}</div>
            <div className="stack gap">
              {player.stats.map((s) => <StatsTable key={s.season} s={s} />)}
            </div>
          </div>
        )}

        {player.news && player.news.length > 0 && (
          <div className="card pad">
            <div className="card-title">Noticias y estado</div>
            <div className="news">
              {[...player.news].sort((a, b) => b.date.localeCompare(a.date)).map((n, i) => (
                <div key={i} className={`news-item tone-line-${n.tone ?? 'info'}`}>
                  <span className="muted small">{prettyDate(n.date)}</span>
                  <p>{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card pad">
          <div className="card-title">Evolución del valor</div>
          <LineChart data={valueData} format={money} color={falling ? 'var(--neg)' : 'var(--pos)'} />
          {gain !== undefined && (
            <p className={`gain ${gain >= 0 ? 'up' : 'down'}`}>
              Compra {money(purchase)} → {gain >= 0 ? 'ganancia' : 'pérdida'} <b>{signedMoney(gain)}</b>
            </p>
          )}
        </div>

        {new Set(pointsData.map((p) => p.value)).size > 1 && (
          <div className="card pad">
            <div className="card-title">Puntos Fantasy</div>
            <LineChart data={pointsData} format={(n) => `${n} pts`} color="var(--accent-2)" height={130} />
          </div>
        )}

        {h.length > 0 && (
          <div className="card pad">
            <div className="card-title">Historial</div>
            <div className="hist">
              {[...h].reverse().slice(0, 14).map((o) => (
                <div key={o.date} className="hist-row">
                  <span className="muted">{prettyDate(o.date)}</span>
                  <span className={`src src-${o.source}`}>{o.source === 'market' ? 'Mercado' : 'Plantilla'}</span>
                  <b>{money(o.value)}</b>
                  <span className="muted">{o.points ?? '—'} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {player.sources && player.sources.length > 0 && (
          <div className="sources">
            <span className="muted small">Fuentes:</span>
            {player.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
