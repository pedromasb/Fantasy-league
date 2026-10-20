import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { IconHome, IconMarket, IconShirt, IconSpark, IconTrophy } from './components/Icons'
import { LeagueSheet } from './components/LeagueSheet'
import { PlayerSheet } from './components/PlayerSheet'
import { DataContext, loadData } from './lib/data'
import { prettyDate } from './lib/format'
import { LeagueContext, loadLeague, type League } from './lib/league'
import { NavContext, type Nav, type Tab } from './lib/nav'
import { Home } from './screens/Home'
import { Market } from './screens/Market'
import { Report } from './screens/Report'
import { Squad } from './screens/Squad'
import { Top } from './screens/Top'
import type { AppState } from './types'

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [player, setPlayer] = useState<string | null>(null)
  const [leaguePlayer, setLeaguePlayer] = useState<number | null>(null)
  const [league, setLeague] = useState<League | null>(null)

  useEffect(() => {
    loadData().then(setState).catch(() => setError(true))
    // League-wide data is optional: the app works without it.
    loadLeague().then(setLeague)
  }, [])

  const nav: Nav = useMemo(
    () => ({
      tab,
      go: (t) => {
        setTab(t)
        window.scrollTo({ top: 0 })
      },
      openPlayer: setPlayer,
      openLeague: setLeaguePlayer,
    }),
    [tab],
  )

  if (error)
    return (
      <div className="splash">
        <p className="muted">No se pudieron cargar los datos. Revisa la conexión y recarga.</p>
      </div>
    )
  if (!state) return <div className="splash"><span className="splash-ball">⚽</span></div>

  const tabButton = (t: Tab, label: string, icon: ReactNode) => (
    <button className={`tab ${tab === t ? 'on' : ''}`} onClick={() => nav.go(t)}>
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <DataContext.Provider value={state}>
      <LeagueContext.Provider value={league}>
      <NavContext.Provider value={nav}>
        <div className="bg-glow" />
        <main key={tab} className="view">
          {tab === 'home' && <Home />}
          {tab === 'report' && <Report />}
          {tab === 'market' && <Market />}
          {tab === 'squad' && <Squad />}
          {tab === 'top' && <Top />}
          <p className="updated">Datos actualizados el {prettyDate(state.updated.slice(0, 10), true)}</p>
        </main>

        <nav className="tabbar">
          {tabButton('home', 'Inicio', <IconHome />)}
          {tabButton('market', 'Mercado', <IconMarket />)}
          <button className={`fab ${tab === 'report' ? 'on' : ''}`} onClick={() => nav.go('report')} aria-label="Informe">
            <IconSpark width={26} height={26} />
          </button>
          {tabButton('squad', 'Plantilla', <IconShirt />)}
          {tabButton('top', 'Top', <IconTrophy />)}
        </nav>

        {player && <PlayerSheet key={player} id={player} onClose={() => setPlayer(null)} />}
        {leaguePlayer !== null && <LeagueSheet key={leaguePlayer} id={leaguePlayer} onClose={() => setLeaguePlayer(null)} />}
      </NavContext.Provider>
      </LeagueContext.Provider>
    </DataContext.Provider>
  )
}
