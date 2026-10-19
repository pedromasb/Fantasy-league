import { useData } from '../lib/data'
import { money, prettyDate, signedMoney } from '../lib/format'
import { useNav } from '../lib/nav'
import type { LedgerItem } from '../types'

const ICON: Record<LedgerItem['kind'], string> = { compra: '🛒', venta: '💰', clausula: '🛡️', expirado: '⌛' }

function describe(it: LedgerItem): string {
  switch (it.kind) {
    case 'compra':
      return `Compras a ${it.playerName}${it.counterpart ? ` (a ${it.counterpart})` : ''}`
    case 'venta':
      return `Vendes a ${it.playerName}${it.counterpart ? ` (a ${it.counterpart})` : ''}`
    case 'clausula':
      return `Subes la cláusula de ${it.playerName}: ${money(it.from)} → ${money(it.to)}`
    case 'expirado':
      return `${it.playerName} sale del mercado sin venderse`
  }
}

/** Operations from the game's Historical tab, newest first. */
export function Ledger() {
  const state = useData()
  const { openPlayer } = useNav()
  const items = [...(state.ledger ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  if (!items.length) return null
  const bought = items.filter((i) => i.kind === 'compra').reduce((a, i) => a + (i.amount ?? 0), 0)
  const sold = items.filter((i) => i.kind === 'venta').reduce((a, i) => a + (i.amount ?? 0), 0)
  return (
    <div className="card ledger">
      <div className="ledger-totals">
        <div><span>Compras</span><b className="neg">{money(bought)}</b></div>
        <div><span>Ventas</span><b className="pos">{money(sold)}</b></div>
        <div><span>Neto</span><b className={sold - bought >= 0 ? 'pos' : 'neg'}>{signedMoney(sold - bought)}</b></div>
      </div>
      {items.map((it, i) => (
        <button key={i} className="ledger-row" disabled={!it.playerId} onClick={() => it.playerId && openPlayer(it.playerId)}>
          <span className="ledger-icon">{ICON[it.kind]}</span>
          <span className="grow">
            <span className="ledger-text">{describe(it)}</span>
            <small className="muted">{prettyDate(it.date)}</small>
          </span>
          {it.amount !== undefined && (
            <b className={it.kind === 'venta' ? 'pos' : 'neg'}>{it.kind === 'venta' ? '+' : '−'}{money(it.amount)}</b>
          )}
        </button>
      ))}
    </div>
  )
}
