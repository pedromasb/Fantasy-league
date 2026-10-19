import type { Pos, Status } from '../types'

export function money(n?: number): string {
  if (n === undefined || Number.isNaN(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2 })} M€`
  if (a >= 1e3) return `${Math.round(n / 1e3).toLocaleString('es-ES')} K€`
  return `${n.toLocaleString('es-ES')} €`
}

export const fullMoney = (n?: number) => (n === undefined ? '—' : `${n.toLocaleString('es-ES')} €`)

export function signedMoney(n?: number): string {
  if (n === undefined) return '—'
  return `${n > 0 ? '+' : ''}${money(n)}`
}

export function pct(n?: number, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${(n * 100).toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
}

export const num = (n?: number, digits = 1) =>
  n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('es-ES', { maximumFractionDigits: digits })

export const POS_LABEL: Record<Pos, string> = { GK: 'POR', DEF: 'DEF', MID: 'MED', STR: 'DEL', COA: 'ENT' }
export const POS_NAME: Record<Pos, string> = {
  GK: 'Portero',
  DEF: 'Defensa',
  MID: 'Centrocampista',
  STR: 'Delantero',
  COA: 'Entrenador',
}
export const POS_ORDER: Pos[] = ['GK', 'DEF', 'MID', 'STR', 'COA']

export const STATUS_LABEL: Record<Status, string> = {
  available: 'Disponible',
  injured: 'Lesionado',
  doubtful: 'Duda',
  suspended: 'Sancionado',
  unknown: 'Sin dato',
}

export function prettyDate(d: string, long = false): string {
  const [y, m, day] = d.split('-').map(Number)
  const date = new Date(y, m - 1, day)
  return date.toLocaleDateString('es-ES', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' })
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L} ]/gu, '').split(' ').filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
