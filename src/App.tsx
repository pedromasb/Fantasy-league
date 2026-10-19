import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconHome, IconMarket, IconPlus, IconShirt, IconTrophy } from './components/Icons'
import { PlayerSheet } from './components/PlayerSheet'
import { NavContext, type Nav, type Tab } from './lib/nav'
import { loadState, persistState, StoreContext, type Store } from './lib/store'
import { Home } from './screens/Home'
import { Import } from './screens/Import'
import { Market } from './screens/Market'
import { Settings } from './screens/Settings'
import { Squad } from './screens/Squad'
import { Top } from './screens/Top'
import { emptyState, type AppState } from './types'

/** Text shared from Lens via the PWA share target (?text=...). */
function takeSharedText(): string | undefined {
  const params = new URLSearchParams(location.search)
  const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
  if (shared) history.replaceState(null, '', location.pathname)
  return shared || undefined
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const sharedText = useRef(takeSharedText())
  const [tab, setTab] = useState<Tab>(sharedText.current ? 'import' : 'home')
  const [player, setPlayer] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    loadState().then(setState).catch(() => setState(emptyState()))
  }, [])

  const store: Store | null = useMemo(
    () =>
      state && {
        state,
        update: (fn) =>
          setState((s) => {
            const next = fn(s!)
            persistState(next)
            return next
          }),
        replace: (s) => {
          persistState(s)
          setState(s)
        },
      },
    [state],
  )

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600)
  }, [])

  const nav: Nav = useMemo(
    () => ({
      tab,
      go: (t) => {
        setTab(t)
        window.scrollTo({ top: 0 })
      },
      openPlayer: setPlayer,
      toast,
    }),
    [tab, toast],
  )

  if (!store) return <div className="splash"><span className="splash-ball">⚽</span></div>

  return (
    <StoreContext.Provider value={store}>
      <NavContext.Provider value={nav}>
        <div className="bg-glow" />
        <main key={tab} className="view">
          {tab === 'home' && <Home />}
          {tab === 'market' && <Market />}
          {tab === 'import' && <Import initialText={sharedText.current} />}
          {tab === 'squad' && <Squad />}
          {tab === 'top' && <Top />}
          {tab === 'settings' && <Settings />}
        </main>

        <nav className="tabbar">
          <TabButton t="home" label="Inicio" icon={<IconHome />} />
          <TabButton t="market" label="Mercado" icon={<IconMarket />} />
          <button className={`fab ${tab === 'import' ? 'on' : ''}`} onClick={() => nav.go('import')} aria-label="Importar">
            <IconPlus width={28} height={28} />
          </button>
          <TabButton t="squad" label="Plantilla" icon={<IconShirt />} />
          <TabButton t="top" label="Top" icon={<IconTrophy />} />
        </nav>

        {player && <PlayerSheet key={player} id={player} onClose={() => setPlayer(null)} />}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </NavContext.Provider>
    </StoreContext.Provider>
  )

  function TabButton({ t, label, icon }: { t: Tab; label: string; icon: React.ReactNode }) {
    return (
      <button className={`tab ${tab === t ? 'on' : ''}`} onClick={() => nav.go(t)}>
        {icon}
        <span>{label}</span>
      </button>
    )
  }
}
