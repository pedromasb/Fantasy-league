import { useId } from 'react'

export function Sparkline({ values, width = 84, height = 28, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const id = useId()
  if (values.length < 2) return <svg width={width} height={height} className="spark" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)])
  const up = values[values.length - 1] >= values[0]
  const stroke = color ?? (up ? 'var(--pos)' : 'var(--neg)')
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} className="spark" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={stroke} />
    </svg>
  )
}

export function LineChart({
  data,
  format,
  height = 160,
  color = 'var(--accent)',
}: {
  data: { label: string; value: number }[]
  format: (n: number) => string
  height?: number
  color?: string
}) {
  const id = useId()
  const W = 340
  const H = height
  const padT = 18
  const padB = 22
  if (data.length === 0) return <div className="chart-empty">Sin datos todavía</div>
  if (data.length === 1)
    return (
      <div className="chart-empty">
        <strong>{format(data[0].value)}</strong>
        <span>Necesitas al menos dos días para ver la evolución</span>
      </div>
    )
  const vals = data.map((d) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || Math.abs(max) * 0.1 || 1
  const x = (i: number) => 8 + (i / (data.length - 1)) * (W - 16)
  const y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB)
  const d = data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = data[data.length - 1]
  const maxI = vals.indexOf(max)
  const minI = vals.indexOf(min)
  const labelIdx = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="linechart">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} className="grid" />
      ))}
      <path d={`${d} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`} fill={`url(#${id})`} />
      <path d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {max !== min && (
        <>
          <text x={clampX(x(maxI))} y={y(max) - 6} className="chart-label" textAnchor="middle">{format(max)}</text>
          {minI !== data.length - 1 && <text x={clampX(x(minI))} y={y(min) - 8} className="chart-label dim" textAnchor="middle">{format(min)}</text>}
        </>
      )}
      <circle cx={x(data.length - 1)} cy={y(last.value)} r="4.5" fill={color} className="chart-dot" />
      {labelIdx.map((i) => (
        <text key={i} x={clampX(x(i))} y={H - 5} className="chart-axis" textAnchor="middle">{data[i].label}</text>
      ))}
    </svg>
  )
}

const clampX = (v: number) => Math.min(310, Math.max(30, v))

export function Donut({ parts, size = 120 }: { parts: { value: number; color: string; label: string }[]; size?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const offsets = parts.map((_, i) => parts.slice(0, i).reduce((a, p) => a + (p.value / total) * c, 0))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="12" fill="none" />
      {parts.map((p, i) => {
        const len = (p.value / total) * c
        return (
          <circle
            key={p.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={p.color}
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${Math.max(len - 3, 0)} ${c}`}
            strokeDashoffset={-offsets[i]}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
      })}
    </svg>
  )
}
