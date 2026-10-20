import { useEffect } from 'react'
import { useLeague } from '../lib/league'
import { money, POS_NAME } from '../lib/format'
import { IconClose } from './Icons'
import { LeagueStats } from './LeagueStats'
import { Avatar, Delta, PosBadge, StatusPill } from './ui'

/** Sheet for a league player I do not track in my own data. */
export function LeagueSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const league = useLeague()
  const p = league?.players.find((x) => x.id === id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!league || !p) return null
  const day = p.value && p.valueAgo['1'] ? p.value / p.valueAgo['1'] - 1 : undefined
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={p.name}>
        <div className="sheet-grip" />
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        <div className="sheet-hero">
          <Avatar name={p.name} pos={p.pos} size={68} status={p.status} />
          <div>
            <h2>{p.name}</h2>
            {p.fullName && p.fullName !== p.name && <p className="muted small">{p.fullName}</p>}
            <div className="row gap-s wrap hero-tags">
              <PosBadge pos={p.pos} />
              <span className="muted small">{POS_NAME[p.pos]} · {p.team}</span>
              {p.status && <StatusPill status={p.status} />}
            </div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat"><span>Valor</span><b>{money(p.value)}</b><Delta value={day} small /></div>
          <div className="stat"><span>Próximo rival</span><b>{p.next ? p.next.rival : '—'}</b><small className="muted">{p.next ? `J${p.next.week} · ${p.next.home ? 'en casa' : 'fuera'}` : ''}</small></div>
        </div>
        <LeagueStats league={league} p={p} />
        <p className="footnote">No está en tu plantilla ni lo he analizado todavía. Si te interesa, pregúntame por él en el chat.</p>
      </div>
    </div>
  )
}
