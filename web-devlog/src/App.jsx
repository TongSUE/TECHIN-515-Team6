import { useEffect, useMemo, useState } from 'react'
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom'
import DevlogTimeline from './components/DevlogTimeline.jsx'
import Hero from './components/Hero.jsx'
import Nav from './components/Nav.jsx'
import Team from './components/Team.jsx'
import Vision from './components/Vision.jsx'
import DevlogWeekPage from './pages/DevlogWeekPage.jsx'
import { getDevlogWeeks, getGithubRepoUrl } from './utils/loadDevlog.js'

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

  return (
    <div className="min-h-svh">
      <Nav dark={dark} onToggleTheme={toggleTheme} />
      <Outlet />
      <footer className="border-t border-slate-200/80 bg-slate-50 py-10 text-center text-xs text-ink-soft dark:border-slate-800 dark:bg-slate-900/50">
        © {new Date().getFullYear()} AuraSync — student project devlog.
      </footer>
    </div>
  )
}

function HomePage() {
  const weeks = useMemo(() => getDevlogWeeks(), [])
  const githubUrl = useMemo(() => getGithubRepoUrl(), [])

  return (
    <main>
      <Hero githubUrl={githubUrl} />
      <Vision />
      <DevlogTimeline weeks={weeks} />
      <Team />
    </main>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/devlog/:week" element={<DevlogWeekPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
