import { describe, expect, it } from 'vitest'
import { emptyState } from '../types'
import { actions, latestSquad, type ReviewRow } from './store'

const row = (name: string, pos: ReviewRow['pos'], extra: Partial<ReviewRow> = {}): ReviewRow => ({ name, pos, status: 'unknown', bids: 0, ...extra })

describe('saveSquad', () => {
  it('keeps Squad-tab values when the line-up is pasted the same day', () => {
    let s = actions.saveSquad(emptyState(), '2026-10-19', [row('Unai Simón', 'GK', { value: 18e6, points: 41 }), row('Raíz', 'MID', { value: 1e6 })], 'cards')
    s = actions.saveSquad(s, '2026-10-19', [row('Unai Sim', 'GK', { truncated: true, starter: true })], 'lineup', { formation: '4-4-2', teamValue: 2e8 })
    const snap = latestSquad(s)!
    expect(snap.slots).toEqual([
      { playerId: 'unai-simon', starter: true, value: 18e6, points: 41 },
      { playerId: 'raiz', starter: false, value: 1e6 },
    ])
    expect(snap).toMatchObject({ formation: '4-4-2', teamValue: 2e8 })
  })

  it('carries bench players to a later line-up without stale values', () => {
    let s = actions.saveSquad(emptyState(), '2026-10-18', [row('Raíz', 'MID', { value: 1e6 }), row('Bartra', 'DEF', { value: 3e6, starter: true })], 'cards')
    s = actions.saveSquad(s, '2026-10-19', [row('Bartra', 'DEF', { starter: true })], 'lineup', { formation: '4-4-2' })
    expect(latestSquad(s)!.slots).toEqual([
      { playerId: 'bartra', starter: true },
      { playerId: 'raiz', starter: false },
    ])
  })
})
