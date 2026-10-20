import { useMemo } from 'react'
import { useData } from '../lib/data'
import { money, pct } from '../lib/format'
import { useLeague } from '../lib/league'
import { useNav } from '../lib/nav'
import { valueAlerts, type ValueAlert } from '../lib/value'
import { IconChevron } from './Icons'
import { PosBadge, Section } from './ui'

function Row({ a }: { a: ValueAlert }) {
  const { openPlayer } = useNav()
  return (
    <button className={`valert tone-${a.kind}`} onClick={() => openPlayer(a.player.id)}>
      <span className="valert-icon">{a.kind === 'up' ? '📈' : '📉'}</span>
      <span className="grow">
        <span className="prow-name"><PosBadge pos={a.player.pos} /><b>{a.player.name}</b>{a.owned && <span className="tag tone-info">tuyo</span>}</span>
        <span className="small muted">{a.text}</span>
        <span className="valert-steps">
          <span>{money(a.lp.value)}</span>
          {([['1d', a.d1], ['3d', a.d3], ['7d', a.d7]] as const).map(([l, v]) => (
            <span key={l} className={v === undefined ? 'muted' : v >= 0 ? 'pos' : 'neg'}>{l} {pct(v)}</span>
          ))}
        </span>
      </span>
      <IconChevron width={16} height={16} className="muted" />
    </button>
  )
}

/** Players in my squad or today's market whose value is on a streak. */
export function ValueAlerts() {
  const state = useData()
  const league = useLeague()
  const alerts = useMemo(() => valueAlerts(state, league), [state, league])
  if (!league) return null
  const up = alerts.filter((a) => a.kind === 'up')
  const down = alerts.filter((a) => a.kind === 'down')
  return (
    <Section title="💹 Alertas de valor" sub="Tu plantilla y el mercado de hoy">
      <div className="card pad stack gap-s">
        {alerts.length === 0 && <p className="muted small">Ningún jugador tuyo ni del mercado tiene una racha clara de subida o bajada.</p>}
        {up.length > 0 && <div className="card-title">Subiendo · para especular o aguantar</div>}
        {up.map((a) => <Row key={a.player.id} a={a} />)}
        {down.length > 0 && <div className="card-title" style={{ marginTop: up.length ? 8 : 0 }}>Bajando · vende a tiempo o espera para comprar</div>}
        {down.map((a) => <Row key={a.player.id} a={a} />)}
        <p className="small muted">Subiendo: al menos +3% en 7 días con 3 días seguidos al alza (o +5% en la semana). Bajando: −3% en 3 días, o 3 días seguidos a la baja con −3% en la semana.</p>
      </div>
    </Section>
  )
}
