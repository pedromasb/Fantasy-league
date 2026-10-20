import { useData } from '../lib/data'
import { useNav } from '../lib/nav'
import type { Analysis } from '../types'

/** One decision with its data table, arguments and conclusion. */
export function AnalysisCard({ a }: { a: Analysis }) {
  const state = useData()
  const { openPlayer } = useNav()
  return (
    <article className="card analysis">
      <header>
        <span className="analysis-icon">{a.icon}</span>
        <div>
          <h3>{a.title}</h3>
          {a.question && <p className="muted small">{a.question}</p>}
        </div>
      </header>
      {a.table && (
        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>{a.table.head.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {a.table.rows.map((r, i) => (
                <tr key={i} className={a.table!.pick === i ? 'pick' : ''}>
                  {r.map((c, j) => <td key={j}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {a.points.length > 0 && (
        <ul className="apoints">
          {a.points.map((pt, i) => <li key={i}>{pt}</li>)}
        </ul>
      )}
      <p className="aconclusion">{a.conclusion}</p>
      {a.playerIds && a.playerIds.length > 0 && (
        <div className="row gap-s wrap">
          {a.playerIds.filter((id) => state.players[id]).map((id) => (
            <button key={id} className="chip" onClick={() => openPlayer(id)}>{state.players[id].name} ›</button>
          ))}
        </div>
      )}
    </article>
  )
}
