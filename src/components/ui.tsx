import type { ReactNode } from 'react'
import type { Pos, Status } from '../types'
import type { Tag } from '../lib/analysis'
import { initials, pct, POS_LABEL, STATUS_LABEL } from '../lib/format'

export function PosBadge({ pos }: { pos: Pos }) {
  return <span className={`pos pos-${pos}`}>{POS_LABEL[pos]}</span>
}

export function Avatar({ name, pos, size = 44, status }: { name: string; pos: Pos; size?: number; status?: Status }) {
  return (
    <span className={`avatar pos-ring-${pos}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
      {status && status !== 'available' && status !== 'unknown' && <span className={`avatar-flag st-${status}`} />}
    </span>
  )
}

export function StatusPill({ status }: { status: Status }) {
  if (status === 'unknown') return null
  return <span className={`status st-${status}`}>{STATUS_LABEL[status]}</span>
}

export function Delta({ value, small }: { value?: number; small?: boolean }) {
  if (value === undefined || !Number.isFinite(value)) return <span className={`delta flat ${small ? 'sm' : ''}`}>—</span>
  const cls = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat'
  return (
    <span className={`delta ${cls} ${small ? 'sm' : ''}`}>
      {cls === 'up' ? '▲' : cls === 'down' ? '▼' : '•'} {pct(Math.abs(value)).replace('+', '')}
    </span>
  )
}

export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const tone = score >= 75 ? 'var(--pos)' : score >= 50 ? 'var(--accent-2)' : score >= 30 ? 'var(--warn)' : 'var(--neg)'
  return (
    <span className="score" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="4" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <b style={{ color: tone }}>{score}</b>
    </span>
  )
}

export function Tags({ tags, max = 3 }: { tags: Tag[]; max?: number }) {
  if (!tags.length) return null
  return (
    <div className="tags">
      {tags.slice(0, max).map((t) => (
        <span key={t.label} className={`tag tone-${t.tone}`}>{t.label}</span>
      ))}
    </div>
  )
}

export function Section({ title, action, children, sub }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="muted small">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty card">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {action}
    </div>
  )
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`chip ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const i = options.findIndex((o) => o.value === value)
  return (
    <div className="segmented" style={{ ['--n' as string]: options.length, ['--i' as string]: i }}>
      <span className="seg-thumb" />
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
