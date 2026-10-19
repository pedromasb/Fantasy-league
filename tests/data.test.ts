import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AppState } from '../src/types'

// Guards the hand-edited data file against broken references.
const state = JSON.parse(readFileSync(new URL('../public/data/fantasy.json', import.meta.url), 'utf8')) as AppState
const ids = new Set(Object.keys(state.players))
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)

describe('public/data/fantasy.json', () => {
  it('has consistent player ids', () => {
    for (const [id, p] of Object.entries(state.players)) expect(p.id).toBe(id)
  })

  it('references only known players', () => {
    const refs = [
      ...Object.values(state.markets).flat().map((e) => e.playerId),
      ...Object.values(state.squads).flatMap((s) => s.slots.map((x) => x.playerId)),
      ...Object.values(state.reports).flatMap((r) => [
        ...Object.keys(r.players),
        ...r.sections.flatMap((s) => s.items.map((i) => i.playerId).filter((x): x is string => !!x)),
        ...(r.lineup?.ids ?? []),
      ]),
      ...Object.keys(state.purchases),
    ]
    expect(refs.filter((id) => !ids.has(id))).toEqual([])
  })

  it('uses ISO dates as keys', () => {
    for (const d of [...Object.keys(state.markets), ...Object.keys(state.squads), ...Object.keys(state.reports)]) expect(isDate(d)).toBe(true)
    for (const [d, s] of Object.entries(state.squads)) expect(s.date).toBe(d)
    for (const [d, r] of Object.entries(state.reports)) expect(r.date).toBe(d)
  })

  it('has positive market values', () => {
    for (const e of Object.values(state.markets).flat()) {
      expect(e.value).toBeGreaterThan(0)
      expect(e.price).toBeGreaterThan(0)
    }
  })
})
