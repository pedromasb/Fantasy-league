import { describe, expect, it } from 'vitest'
import { detectKind, parseLineup, parseMarket } from './parse'

// Card-by-card read, as Lens returns for most market screenshots.
const MARKET_BLOCKS = `COA Luís Castro
LALIGA
Available
21:56:41
FSYP 13
Value 610,931
Price 610,931
Hire
DEF Cardoso
LALIGA
Available
21:56:41
FSYP O
Value 581,361
Price 581,361
Hire
STR Sadiq
LALIGA
Injured
21:56:41
FSYP 12
Value 1,359,974
Price 1,359,974
Hire
MID Larrubia
LALIGA
Available
21:56:41
1 bid
FSYP 29
Value 14,608,414
Price 14,608,414
Actions (1)
DEF El Hilali
LALIGA
FSYP 34
Value 17,740,475`

// Row-by-row read: left and right column of a card share a line.
const MARKET_ROWS = `COA Luís Castro FSYP 13
LALIGA Value 610,931
Available Price 610,931
21:56:41 Hire
MID Matteo Prati FSYP 13
LALIGA Value 1,338,261
Available Price 1,338,261
21:56:41 Hire
DEF Beitia FSYP 2
LALIGA Value 557,748
Injured Price 557,748`

// Column-wise read: all left column first, then all right column.
const MARKET_COLUMNS = `COA
Luís Castro
LALIGA
Available
21:56:41
DEF
Cardoso
LALIGA
Available
21:56:41
STR
Sadiq
LALIGA
Injured
21:56:41
FSYP
13
FSYP
0
FSYP
12
Value
610,931
Price
610,931
Value
581,361
Price
581,361
Value
1,359,974
Price
1,359,974`

const LINEUP = `23:38
5G
62
LALIGA Carpasin...
Line-up
Squad
Points
SIGNINGS
FIXTURE 9
TEAM VALUE
16/26
16/10 21.00h
215,612,863
4·4·2
Assign a captain
LALIGA
Unai Sim...
Mojica
C Koski
Sergio G...
Bartra
Ibañez
Unai Lop...
Bernard...
Saliba
Ferran J...
Cepeda
LALIGA
Coach
My leagues
Standing
Team
Market
Activity`

describe('parseMarket', () => {
  it('reads card-by-card text', () => {
    const cards = parseMarket(MARKET_BLOCKS)
    expect(cards.map((c) => c.name)).toEqual(['Luís Castro', 'Cardoso', 'Sadiq', 'Larrubia', 'El Hilali'])
    expect(cards[0]).toMatchObject({ pos: 'COA', points: 13, value: 610931, price: 610931, status: 'available' })
    expect(cards[1].points).toBe(0)
    expect(cards[2]).toMatchObject({ pos: 'STR', status: 'injured', value: 1359974 })
    expect(cards[3]).toMatchObject({ pos: 'MID', bids: 1, value: 14608414 })
    expect(cards[4]).toMatchObject({ value: 17740475, price: 17740475, status: 'unknown' })
  })

  it('reads row-by-row text', () => {
    const cards = parseMarket(MARKET_ROWS)
    expect(cards).toHaveLength(3)
    expect(cards[1]).toMatchObject({ name: 'Matteo Prati', pos: 'MID', points: 13, value: 1338261 })
    expect(cards[2]).toMatchObject({ name: 'Beitia', status: 'injured', points: 2 })
  })

  it('reads column-wise text', () => {
    const cards = parseMarket(MARKET_COLUMNS)
    expect(cards.map((c) => [c.name, c.points, c.value])).toEqual([
      ['Luís Castro', 13, 610931],
      ['Cardoso', 0, 581361],
      ['Sadiq', 12, 1359974],
    ])
    expect(cards[2].status).toBe('injured')
  })
})

describe('parseLineup', () => {
  it('reads formation, team value and players by row', () => {
    const l = parseLineup(LINEUP)
    expect(l.formation).toBe('4-4-2')
    expect(l.teamValue).toBe(215612863)
    expect(l.signings).toBe('16/26')
    expect(l.players.map((p) => p.name)).toEqual([
      'Unai Sim', 'Mojica', 'Koski', 'Sergio G', 'Bartra', 'Ibañez', 'Unai Lop', 'Bernard', 'Saliba', 'Ferran J', 'Cepeda',
    ])
    expect(l.players[0]).toMatchObject({ pos: 'GK', truncated: true })
    expect(l.players.slice(1, 5).every((p) => p.pos === 'DEF')).toBe(true)
    expect(l.players.slice(9).every((p) => p.pos === 'STR')).toBe(true)
  })

  it('splits a pitch row joined on one line', () => {
    const l = parseLineup('4·4·2\nUnai Sim...\nMojica C Koski Sergio G... Bartra')
    expect(l.players.map((p) => p.name)).toEqual(['Unai Sim', 'Mojica', 'Koski', 'Sergio G', 'Bartra'])
  })
})

describe('detectKind', () => {
  it('tells market from line-up', () => {
    expect(detectKind(MARKET_BLOCKS)).toBe('market')
    expect(detectKind(LINEUP)).toBe('lineup')
  })
})
