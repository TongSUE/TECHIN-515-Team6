import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HashRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import DevlogTimeline from './components/DevlogTimeline.jsx'
import Hero from './components/Hero.jsx'
import HomeCursorAura from './components/HomeCursorAura.jsx'
import Nav from './components/Nav.jsx'
import Team from './components/Team.jsx'
import Vision from './components/Vision.jsx'
import DevlogWeekPage from './pages/DevlogWeekPage.jsx'
import { getDevlogWeeks, getGithubRepoUrl } from './utils/loadDevlog.js'
import { LocaleProvider, useLocale } from './context/LocaleContext.jsx'
import { strings } from './i18n/strings.js'

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('aurasync-theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    localStorage.setItem('aurasync-theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark((d) => !d)]
}

function AppShell() {
  const [dark, toggleTheme] = useDarkMode()
  const location = useLocation()
  const { locale } = useLocale()
  const s = strings[locale]

  return (
    <div className="min-h-svh">
      <Nav dark={dark} onToggleTheme={toggleTheme} />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <footer className="border-t border-slate-200/80 bg-slate-50 py-10 text-center text-xs text-ink-soft dark:border-slate-800 dark:bg-slate-900/50">
        {s.footer(new Date().getFullYear())}
      </footer>
    </div>
  )
}

function HomePage() {
  const { locale } = useLocale()
  const weeks = useMemo(() => getDevlogWeeks(locale), [locale])
  const githubUrl = useMemo(() => getGithubRepoUrl(), [])

  return (
    <main>
      <HomeCursorAura>
        <Hero githubUrl={githubUrl} />
      </HomeCursorAura>
      <Vision />
      <DevlogTimeline weeks={weeks} />
      <Team />
    </main>
  )
}

export default function App() {
  return (
    <LocaleProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/devlog/:week" element={<DevlogWeekPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </LocaleProvider>
  )
}
