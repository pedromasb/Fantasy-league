import { useEffect, useMemo, useState } from 'react'
import { history, summarize } from '../lib/analysis'
import { money, num, POS_NAME, POS_ORDER, POS_LABEL, prettyDate, signedMoney } from '../lib/format'
import { actions, latestSquad, useStore } from '../lib/store'
import { useNav } from '../lib/nav'
import type { Pos } from '../types'
import { LineChart } from './Charts'
import { IconClose } from './Icons'
import { Avatar, Delta, PosBadge, StatusPill } from './ui'

export function PlayerSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update } = useStore()
  const { toast } = useNav()
  const player = state.players[id]
  const sum = useMemo(() => (player ? summarize(state, id) : undefined), [state, id, player])
  const h = useMemo(() => history(state, id), [state, id])
  const owned = latestSquad(state)?.slots.some((x) => x.playerId === id) ?? false
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(player?.name ?? '')
  const [team, setTeam] = useState(player?.team ?? '')
  const [pos, setPos] = useState<Pos>(player?.pos ?? 'MID')
  const [merge, setMerge] = useState('')
  const [buy, setBuy] = useState(state.purchases[id]?.toString() ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!player || !sum) return null
  const purchase = state.purchases[id]
  const gain = purchase !== undefined && sum.value !== undefined ? sum.value - purchase : undefined
  const others = Object.values(state.players)
    .filter((p) => p.id !== id && p.pos === player.pos)
    .sort((a, b) => a.name.localeCompare(b.name))
  const valueData = h.filter((o) => o.value).map((o) => ({ label: prettyDate(o.date), value: o.value! }))
  const pointsData = h.filter((o) => o.points !== undefined).map((o) => ({ label: prettyDate(o.date), value: o.points! }))
  const maxV = Math.max(...sum.values, 0)
  const minV = Math.min(...sum.values)

  const save = () => {
    update((s) => actions.updatePlayer(s, id, { name: name.trim() || player.name, team: team.trim() || undefined, pos }))
    setEditing(false)
    toast('Jugador actualizado')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={player.name}>
        <div className="sheet-grip" />
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Cerrar"><IconClose /></button>

        <div className={`sheet-hero hero-${player.pos}`}>
          <Avatar name={player.name} pos={player.pos} size={68} status={sum.status} />
          <div>
            <h2>{player.name}</h2>
            <div className="row gap-s wrap">
              <PosBadge pos={player.pos} />
              <span className="muted small">{POS_NAME[player.pos]}{player.team ? ` · ${player.team}` : ''}</span>
              <StatusPill status={sum.status} />
              {owned && <span className="tag tone-info">En tu plantilla</span>}
            </div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat"><span>Valor</span><b>{money(sum.value)}</b><Delta value={sum.changePct} small /></div>
          <div className="stat"><span>Puntos</span><b>{sum.points ?? '—'}</b><small className="muted">temporada</small></div>
          <div className="stat"><span>Pts / M€</span><b>{num(sum.ppm)}</b><small className="muted">rentabilidad</small></div>
          <div className="stat"><span>Tendencia</span><b><Delta value={sum.trend} /></b><small className="muted">media diaria</small></div>
        </div>

        <div className="card pad">
          <div className="card-title">Evolución del valor</div>
          <LineChart data={valueData} format={money} color={valueData.length > 1 && valueData[valueData.length - 1].value < valueData[0].value ? 'var(--neg)' : 'var(--pos)'} />
          {sum.values.length > 1 && (
            <div className="mini-stats">
              <span>Máx <b>{money(maxV)}</b></span>
              <span>Mín <b>{money(minV)}</b></span>
              <span>Días vistos <b>{h.length}</b></span>
            </div>
          )}
        </div>

        {new Set(pointsData.map((p) => p.value)).size > 1 && (
          <div className="card pad">
            <div className="card-title">Puntos de temporada</div>
            <LineChart data={pointsData} format={(n) => `${n} pts`} color="var(--accent-2)" height={130} />
          </div>
        )}

        <div className="card pad">
          <div className="card-title">Mi inversión</div>
          <div className="row gap">
            <label className="field grow">
              <span>Precio de compra</span>
              <input inputMode="numeric" placeholder="p. ej. 1.200.000" value={buy} onChange={(e) => setBuy(e.target.value)} />
            </label>
            <button
              className="btn"
              onClick={() => {
                const n = Number(buy.replace(/\D/g, ''))
                update((s) => actions.setPurchase(s, id, buy.trim() ? n : undefined))
                toast('Precio de compra guardado')
              }}
            >
              Guardar
            </button>
          </div>
          {gain !== undefined && (
            <p className={`gain ${gain >= 0 ? 'up' : 'down'}`}>
              {gain >= 0 ? 'Ganancia' : 'Pérdida'} latente: <b>{signedMoney(gain)}</b> ({((gain / purchase!) * 100).toFixed(1)}%)
            </p>
          )}
          <button
            className={`btn wide ${owned ? 'ghost danger' : 'primary'}`}
            onClick={() => {
              update((s) =>
                actions.editSquad(s, (slots) =>
                  owned ? slots.filter((x) => x.playerId !== id) : [...slots, { playerId: id, starter: false }],
                ),
              )
              toast(owned ? 'Quitado de tu plantilla' : 'Añadido a tu plantilla')
            }}
          >
            {owned ? 'Quitar de mi plantilla' : 'Añadir a mi plantilla'}
          </button>
        </div>

        {h.length > 0 && (
          <div className="card pad">
            <div className="card-title">Historial</div>
            <div className="hist">
              {[...h].reverse().slice(0, 14).map((o) => (
                <div key={o.date} className="hist-row">
                  <span className="muted">{prettyDate(o.date)}</span>
                  <span className={`src src-${o.source}`}>{o.source === 'market' ? 'Mercado' : 'Plantilla'}</span>
                  <b>{money(o.value)}</b>
                  <span className="muted">{o.points ?? '—'} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card pad">
          <button className="link" onClick={() => setEditing((e) => !e)}>{editing ? 'Cerrar edición' : 'Editar datos del jugador'}</button>
          {editing && (
            <div className="stack gap">
              <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="field"><span>Equipo</span><input placeholder="p. ej. Valencia" value={team} onChange={(e) => setTeam(e.target.value)} /></label>
              <label className="field">
                <span>Posición</span>
                <select value={pos} onChange={(e) => setPos(e.target.value as Pos)}>
                  {POS_ORDER.map((p) => <option key={p} value={p}>{POS_LABEL[p]} · {POS_NAME[p]}</option>)}
                </select>
              </label>
              <button className="btn primary" onClick={save}>Guardar cambios</button>
              {others.length > 0 && (
                <>
                  <p className="muted small">¿Es el mismo jugador que otro (p. ej. nombre cortado en la alineación)? Fusiónalo para unir su historial.</p>
                  <div className="row gap">
                    <select className="grow" value={merge} onChange={(e) => setMerge(e.target.value)}>
                      <option value="">Elegir jugador…</option>
                      {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button
                      className="btn"
                      disabled={!merge}
                      onClick={() => {
                        update((s) => actions.mergePlayer(s, id, merge))
                        toast('Jugadores fusionados')
                        onClose()
                      }}
                    >
                      Fusionar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
