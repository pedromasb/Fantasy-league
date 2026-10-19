import { useRef, useState } from 'react'
import { IconArrowLeft, IconTrash } from '../components/Icons'
import { Section } from '../components/ui'
import { money, prettyDate } from '../lib/format'
import { useNav } from '../lib/nav'
import { actions, today, useStore } from '../lib/store'
import { emptyState, type AppState } from '../types'

export function Settings() {
  const { state, update, replace } = useStore()
  const { go, toast } = useNav()
  const [budget, setBudget] = useState(state.budget?.toString() ?? '')
  const file = useRef<HTMLInputElement>(null)
  const markets = Object.keys(state.markets).sort().reverse()
  const squads = Object.keys(state.squads).sort().reverse()

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fantasy-asesor-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as AppState
      if (data.version !== 1 || !data.players) throw new Error('formato')
      replace({ ...emptyState(), ...data })
      toast('Copia restaurada')
    } catch {
      toast('Ese archivo no es una copia válida')
    }
  }

  return (
    <div className="screen">
      <header className="top">
        <button className="icon-btn" onClick={() => go('home')} aria-label="Volver"><IconArrowLeft /></button>
        <h1 className="grow">Ajustes</h1>
      </header>

      <Section title="Saldo disponible" sub="Lo ves en LaLiga Fantasy; se usa para filtrar fichajes asequibles">
        <div className="card pad row gap">
          <label className="field grow">
            <span>Saldo (€){state.budgetDate ? ` · actualizado ${prettyDate(state.budgetDate)}` : ''}</span>
            <input inputMode="numeric" placeholder="p. ej. 12.500.000 (o -300.000)" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <button
            className="btn primary"
            onClick={() => {
              const neg = budget.trim().startsWith('-')
              const n = Number(budget.replace(/\D/g, ''))
              update((s) => actions.setBudget(s, budget.trim() ? (neg ? -n : n) : undefined))
              toast(`Saldo: ${budget.trim() ? money(neg ? -n : n) : 'sin dato'}`)
            }}
          >
            Guardar
          </button>
        </div>
      </Section>

      <Section title="Tus datos" sub={`${Object.keys(state.players).length} jugadores · ${markets.length} mercados · ${squads.length} plantillas`}>
        <div className="card list">
          {markets.map((d) => (
            <div key={`m${d}`} className="data-row">
              <span className="src src-market">Mercado</span>
              <span className="grow">{prettyDate(d, true)}</span>
              <span className="muted small">{state.markets[d].length} jug.</span>
              <button className="icon-btn sm" aria-label="Borrar" onClick={() => confirm(`¿Borrar el mercado del ${prettyDate(d)}?`) && update((s) => actions.deleteMarket(s, d))}><IconTrash width={18} height={18} /></button>
            </div>
          ))}
          {squads.map((d) => (
            <div key={`s${d}`} className="data-row">
              <span className="src src-squad">Plantilla</span>
              <span className="grow">{prettyDate(d, true)}</span>
              <span className="muted small">{state.squads[d].slots.length} jug.</span>
              <button className="icon-btn sm" aria-label="Borrar" onClick={() => confirm(`¿Borrar la plantilla del ${prettyDate(d)}?`) && update((s) => actions.deleteSquad(s, d))}><IconTrash width={18} height={18} /></button>
            </div>
          ))}
          {!markets.length && !squads.length && <p className="muted pad">Todavía no hay nada guardado.</p>}
        </div>
      </Section>

      <Section title="Copia de seguridad" sub="Todo se guarda solo en este móvil. Exporta de vez en cuando por si acaso.">
        <div className="row gap">
          <button className="btn grow" onClick={exportData}>Exportar</button>
          <button className="btn grow" onClick={() => file.current?.click()}>Restaurar</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </div>
      </Section>

      <Section title="Instalar en el móvil">
        <div className="card pad">
          <p className="small">En Chrome, abre el menú <b>⋮</b> y pulsa <b>Añadir a pantalla de inicio → Instalar</b>. Se abrirá a pantalla completa como una app y funcionará sin conexión.</p>
        </div>
      </Section>

      <button
        className="btn ghost danger wide"
        onClick={() => {
          if (confirm('¿Borrar TODOS los datos? No se puede deshacer.')) {
            replace(emptyState())
            toast('Datos borrados')
          }
        }}
      >
        Borrar todos los datos
      </button>
    </div>
  )
}
