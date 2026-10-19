import type { ReactNode } from 'react'
import type { PlayerSummary, Tag } from '../lib/analysis'
import { money } from '../lib/format'
import { latestRec, useData } from '../lib/data'
import { useNav } from '../lib/nav'
import { VerdictBadge } from './Verdict'
import { Sparkline } from './Charts'
import { Avatar, Delta, Form, PosBadge, Tags } from './ui'

export function PlayerRow({ p, tags, right, sub, rank }: { p: PlayerSummary; tags?: Tag[]; right?: ReactNode; sub?: ReactNode; rank?: number }) {
  const { openPlayer } = useNav()
  const rec = latestRec(useData(), p.player.id)
  return (
    <button className="prow" onClick={() => openPlayer(p.player.id)}>
      {rank !== undefined && <span className={`rank r${rank}`}>{rank}</span>}
      <Avatar name={p.player.name} pos={p.player.pos} status={p.status} />
      <div className="prow-main">
        <div className="prow-name">
          <PosBadge pos={p.player.pos} />
          <span>{p.player.name}</span>
        </div>
        <div className="prow-sub">
          {sub ?? (
            <>
              <b>{money(p.value)}</b>
              <Delta value={p.changePct} small />
              <span className="muted">· {p.points ?? '—'} pts{p.average !== undefined ? ` · ${p.average.toLocaleString('es-ES')} med` : ''}</span>
            </>
          )}
        </div>
        {(rec || tags?.length) && (
          <div className="tags">
            {rec && <VerdictBadge verdict={rec.verdict} />}
            {tags && <Tags tags={tags} inline />}
          </div>
        )}
      </div>
      <div className="prow-right">
        {right ?? (p.recent ? <Form recent={p.recent} small /> : <Sparkline values={p.values.slice(-10)} />)}
      </div>
    </button>
  )
}
