import type { Verdict } from '../types'

const LABEL: Record<Verdict, string> = {
  fichar: 'Fichar',
  pujar: 'Pujar',
  vigilar: 'Vigilar',
  evitar: 'Evitar',
  mantener: 'Mantener',
  vender: 'Vender',
  alinear: 'Alinear',
  banquillo: 'Banquillo',
}

const TONE: Record<Verdict, string> = {
  fichar: 'good',
  pujar: 'good',
  alinear: 'good',
  mantener: 'info',
  vigilar: 'warn',
  banquillo: 'warn',
  evitar: 'bad',
  vender: 'bad',
}

export function VerdictBadge({ verdict, big }: { verdict: Verdict; big?: boolean }) {
  return <span className={`verdict tone-${TONE[verdict]} ${big ? 'big' : ''}`}>{LABEL[verdict]}</span>
}
