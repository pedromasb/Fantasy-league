import type { ReactNode } from 'react'
import type { PlayerSummary, Tag } from '../lib/analysis'
import { money } from '../lib/format'
import { useNav } from '../lib/nav'
import { Sparkline } from './Charts'
import { Avatar, Delta, PosBadge, Tags } from './ui'

export function PlayerRow({ p, tags, right, sub, rank }: { p: PlayerSummary; tags?: Tag[]; right?: ReactNode; sub?: ReactNode; rank?: number }) {
  const { openPlayer } = useNav()
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
              <span className="muted">· {p.points ?? '—'} pts</span>
            </>
          )}
        </div>
        {tags && <Tags tags={tags} />}
      </div>
      <div className="prow-right">
        {right ?? <Sparkline values={p.values.slice(-10)} />}
      </div>
    </button>
  )
}
