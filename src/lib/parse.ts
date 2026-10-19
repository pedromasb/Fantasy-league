import type { Pos, Status } from '../types'

/**
 * Parsers for text copied from LaLiga Fantasy screenshots (Pixel "Copy text"
 * / Google Lens). Lens may read a card row by row or column by column, so the
 * market parser tolerates both orders.
 */

export interface ParsedCard {
  name: string
  pos: Pos
  value?: number
  price?: number
  points?: number
  status: Status
  bids: number
}

export interface ParsedLineup {
  formation?: string
  teamValue?: number
  signings?: string
  /** Starters in on-screen order: GK, DEF row, MID row, STR row. */
  players: { name: string; pos: Pos; truncated: boolean }[]
  coach?: { name: string; truncated: boolean }
}

export type TextKind = 'market' | 'lineup' | 'cards'

const POS_TAGS: Record<string, Pos> = {
  COA: 'COA', ENT: 'COA', DT: 'COA',
  GK: 'GK', GKP: 'GK', POR: 'GK', PT: 'GK',
  DEF: 'DEF', DF: 'DEF',
  MID: 'MID', MED: 'MID', MC: 'MID',
  STR: 'STR', DEL: 'STR', FWD: 'STR',
}

const STATUS_WORDS: [RegExp, Status][] = [
  [/\b(available|disponible)\b/i, 'available'],
  [/\b(injured|lesionado|lesi[oó]n)\b/i, 'injured'],
  [/\b(doubtful|duda|dudoso)\b/i, 'doubtful'],
  [/\b(suspended|sancionado|unavailable|no disponible)\b/i, 'suspended'],
]

const POS_LINE = new RegExp(`^(${Object.keys(POS_TAGS).join('|')})\\b[\\s:.-]*(.*)$`)

export function toNumber(raw: string): number {
  const digits = raw.replace(/[Oo]/g, '0').replace(/[^\d-]/g, '')
  return digits ? Number(digits) : NaN
}

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function detectKind(text: string): TextKind {
  if (/\b(hire|fichar|price|precio|\d+\s*bids?|pujas?)\b/i.test(text)) return 'market'
  if (/(signings|fichajes|team value|valor de equipo|line-?up|alineaci[oó]n)/i.test(text)) return 'lineup'
  if (/\b\d\s*[·.-]\s*\d\s*[·.-]\s*\d\b/.test(text)) return 'lineup'
  return 'cards'
}

type Field = 'points' | 'value' | 'price' | 'status'
interface Ev {
  kind: 'pos' | Field | 'bids'
  pos?: Pos
  name?: string
  num?: number
  status?: Status
}

const NUM = '([0-9][0-9.,\\s]*[0-9]|[0-9Oo]+)'
const FIELD_RES: [Field, RegExp][] = [
  ['points', new RegExp(`(?:FSYP|PTS|Puntos|Points)\\s*:?\\s*(-?[0-9Oo]+)\\b`, 'gi')],
  ['value', new RegExp(`(?:Value|Valor)\\s*:?\\s*${NUM}`, 'gi')],
  ['price', new RegExp(`(?:Price|Precio)\\s*:?\\s*${NUM}`, 'gi')],
]
type NumField = Exclude<Field, 'status'>
const LABEL_ONLY: [NumField, RegExp][] = [
  ['points', /^(FSYP|PTS|Puntos|Points)$/i],
  ['value', /^(Value|Valor)$/i],
  ['price', /^(Price|Precio)$/i],
]

/** Turn copied text into an ordered stream of field events. */
function tokenize(lines: string[]): Ev[] {
  const evs: Ev[] = []
  let pendingLabel: NumField | null = null
  let pendingName = false

  for (const line of lines) {
    if (pendingLabel && /^-?[0-9Oo][0-9Oo.,\s]*$/.test(line)) {
      evs.push({ kind: pendingLabel, num: toNumber(line) })
      pendingLabel = null
      continue
    }
    pendingLabel = null

    const label = LABEL_ONLY.find(([, re]) => re.test(line))
    if (label) {
      pendingLabel = label[0]
      continue
    }

    let rest = line
    const posMatch = line.match(POS_LINE)
    if (posMatch) {
      const name = extractName(posMatch[2])
      evs.push({ kind: 'pos', pos: POS_TAGS[posMatch[1]], name })
      pendingName = !name
      rest = posMatch[2].slice(name.length)
    } else if (pendingName) {
      const name = extractName(line)
      if (name) {
        evs[evs.length - 1].name = name
        pendingName = false
        rest = line.slice(name.length)
      }
    }

    // Fields can share a line in row-wise reads ("LALIGA Value 610,931").
    const found: { idx: number; ev: Ev }[] = []
    for (const [field, re] of FIELD_RES) {
      for (const m of rest.matchAll(re)) found.push({ idx: m.index ?? 0, ev: { kind: field, num: toNumber(m[1]) } })
    }
    for (const [re, status] of STATUS_WORDS) {
      const m = rest.match(re)
      if (m) found.push({ idx: m.index ?? 0, ev: { kind: 'status', status } })
    }
    const bids = rest.match(/(\d+)\s*(?:bids?|pujas?)\b/i) ?? rest.match(/(?:Actions|Acciones)\s*\((\d+)\)/i)
    if (bids) found.push({ idx: bids.index ?? 0, ev: { kind: 'bids', num: Number(bids[1]) } })
    found.sort((a, b) => a.idx - b.idx).forEach((f) => evs.push(f.ev))

    const trailingLabel = LABEL_ONLY.find(([f]) => new RegExp(`(?:^|\\s)${labelWord(f)}$`, 'i').test(rest))
    if (trailingLabel) pendingLabel = trailingLabel[0]
  }
  return evs
}

function labelWord(f: NumField): string {
  return { points: '(FSYP|PTS)', value: '(Value|Valor)', price: '(Price|Precio)' }[f]
}

/** Leading run of name-like words, stopping at UI words or numbers. */
function extractName(s: string): string {
  const stop = /^(FSYP|PTS|Value|Valor|Price|Precio|LALIGA|Available|Injured|Doubtful|Suspended|Hire|Fichar|\d)/i
  const words: string[] = []
  for (const w of s.split(' ')) {
    if (!w || stop.test(w)) break
    words.push(w)
  }
  return words.join(' ').replace(/[|•·]+$/, '').trim()
}

export function parseMarket(text: string): ParsedCard[] {
  const evs = tokenize(cleanLines(text))
  const cards: ParsedCard[] = evs
    .filter((e) => e.kind === 'pos')
    .map((e) => ({ name: e.name ?? '', pos: e.pos!, status: 'unknown', bids: 0 }))
  if (!cards.length) return []

  // Block mode: each field belongs to the last card opened before it.
  // Used when cards were read top-to-bottom; otherwise pair the n-th
  // occurrence of each field with the n-th card (column-wise reads).
  const fieldsOutsideBlock = countOutOfBlock(evs)
  const fieldTotal = evs.filter((e) => e.kind !== 'pos' && e.kind !== 'bids').length
  const blockMode = fieldTotal === 0 || fieldsOutsideBlock / fieldTotal < 0.15

  if (blockMode) {
    let cur = -1
    for (const e of evs) {
      if (e.kind === 'pos') cur++
      else if (cur >= 0) assign(cards[cur], e, true)
    }
  } else {
    const counters: Record<string, number> = {}
    let cur = -1
    for (const e of evs) {
      if (e.kind === 'pos') { cur++; continue }
      if (e.kind === 'bids') { if (cur >= 0) cards[cur].bids = e.num ?? 0; continue }
      const i = counters[e.kind] ?? 0
      if (i < cards.length) assign(cards[i], e, false)
      counters[e.kind] = i + 1
    }
  }

  for (const c of cards) {
    if (c.price === undefined && c.value !== undefined) c.price = c.value
    if (c.value === undefined && c.price !== undefined) c.value = c.price
  }
  return cards.filter((c) => c.name)
}

function assign(card: ParsedCard, e: Ev, keepFirst: boolean) {
  switch (e.kind) {
    case 'points':
      if (!keepFirst || card.points === undefined) card.points = e.num
      break
    case 'value':
      if (!keepFirst || card.value === undefined) card.value = e.num
      break
    case 'price':
      if (!keepFirst || card.price === undefined) card.price = e.num
      break
    case 'status':
      if (!keepFirst || card.status === 'unknown') card.status = e.status!
      break
    case 'bids':
      card.bids = e.num ?? 0
  }
}

/** Fields that appear before the first card or twice inside one card. */
function countOutOfBlock(evs: Ev[]): number {
  let bad = 0
  let seen = new Set<string>()
  let opened = false
  for (const e of evs) {
    if (e.kind === 'pos') { opened = true; seen = new Set(); continue }
    if (e.kind === 'bids') continue
    if (!opened || seen.has(e.kind)) bad++
    seen.add(e.kind)
  }
  return bad
}

const LINEUP_NOISE = new RegExp(
  '^(' + [
    'line-?up', 'squad', 'points', 'puntos', 'plantilla', 'alineaci[oó]n', 'signings', 'fichajes', 'fixture', 'jornada',
    'team value', 'valor de equipo', 'assign a captain', 'asignar capit[aá]n', 'laliga.*', 'mahou.*', 'my leagues', 'mis ligas',
    'standing', 'clasificaci[oó]n', 'team', 'equipo', 'market', 'mercado', 'activity', 'actividad', 'coach', 'entrenador',
    'lineup', 'lin.?', 'hazte cliente', 'caixabank', 'abre tu.*', 'y elige.*', 'ea sports', 'sports',
  ].join('|') + ')$',
  'i',
)

function nameLike(line: string): boolean {
  if (LINEUP_NOISE.test(line)) return false
  if (!/\p{L}{2,}/u.test(line)) return false
  if (/\d{2,}/.test(line)) return false
  if (line.length > 28) return false
  if (line.split(' ').length > 4) return false
  return true
}

function cleanLineupName(raw: string): { name: string; truncated: boolean } {
  let s = raw.replace(/^[Cc©]\s+(?=\p{Lu})/u, '') // captain badge read as "C"
  s = s.replace(/[✓✔]/g, '').trim()
  const truncated = /(\.\.\.|…)$/.test(s)
  s = s.replace(/(\.\.\.|…)$/, '').trim()
  return { name: s, truncated }
}

export function parseLineup(text: string): ParsedLineup {
  const lines = cleanLines(text)
  const out: ParsedLineup = { players: [] }

  const flat = lines.join('\n')
  const tv = flat.match(/(?:team value|valor de equipo)[^\d]*([\d.,]{5,})/i) ?? flat.match(/([\d]{1,3}(?:[.,]\d{3}){2,})/)
  if (tv) out.teamValue = toNumber(tv[1])
  const sg = flat.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?!\s*\/)/)
  if (sg && /signings|fichajes/i.test(flat)) out.signings = `${sg[1]}/${sg[2]}`

  let start = 0
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/\b([3-5])\s*[·.\-•]\s*([2-5])\s*[·.\-•]\s*([1-3])\b/)
    if (f) {
      out.formation = `${f[1]}-${f[2]}-${f[3]}`
      start = i + 1
      break
    }
  }

  const rows = out.formation ? out.formation.split('-').map(Number) : [4, 4, 2]
  const shape: Pos[] = ['GK', ...Array(rows[0]).fill('DEF'), ...Array(rows[1]).fill('MID'), ...Array(rows[2]).fill('STR')]

  let coachNext = false
  for (const line of lines.slice(start)) {
    if (/^(coach|entrenador)$/i.test(line)) { coachNext = true; continue }
    if (LINEUP_NOISE.test(line)) continue
    // Lens sometimes joins a whole pitch row on one line ("Mojica Koski Sergio G... Bartra").
    const parts = splitRow(line)
    for (const part of parts) {
      if (!nameLike(part)) continue
      const n = cleanLineupName(part)
      if (!n.name) continue
      if (coachNext && !out.coach) { out.coach = n; continue }
      if (out.players.length < shape.length) out.players.push({ ...n, pos: shape[out.players.length] })
      else if (!out.coach && coachNext) out.coach = n
    }
  }
  return out
}

function splitRow(line: string): string[] {
  if (line.split(' ').length <= 2 && !/(\.\.\.|…)\s+\S/.test(line)) return [line]
  // Split after an ellipsis, then keep two-word names only if both words are capitalised.
  return line.split(/(?<=\.\.\.|…)\s+/).flatMap((chunk) => {
    const words = chunk.split(' ')
    if (words.length <= 2) return [chunk]
    return words.reduce<string[]>((acc, w) => {
      if (acc.length && /(\.\.\.|…)$/.test(w) && !/(\.\.\.|…)$/.test(acc[acc.length - 1])) acc[acc.length - 1] += ' ' + w
      else acc.push(w)
      return acc
    }, [])
  })
}

/** Squad tab lists cards like the market but without a price. */
export function parseCards(text: string): ParsedCard[] {
  return parseMarket(text)
}
