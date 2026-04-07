import { useEffect, useId, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const sections = [
  { id: 'vision', label: 'Vision' },
  { id: 'devlog', label: 'Devlog' },
  { id: 'team', label: 'Team' },
]

export default function Nav({ dark, onToggleTheme }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const goSection = (id) => (e) => {
    e.preventDefault()
    setMenuOpen(false)
    const scroll = () =>
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    if (pathname !== '/') {
      navigate('/')
      window.setTimeout(scroll, 100)
    } else {
      scroll()
    }
  }

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-white/50 bg-white/70 shadow-glass backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/65">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link
            to="/"
            className="inline-flex min-w-0 shrink items-center gap-2 text-sm font-semibold tracking-tight text-ink transition hover:text-accent dark:text-slate-100"
          >
            <Sparkles
              className="h-4 w-4 text-accent dark:text-accent-mint"
              strokeWidth={2.25}
              aria-hidden
            />
            AuraSync
          </Link>
          <nav
            className="hidden items-center gap-1 sm:flex"
            aria-label="On-page sections"
          >
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={goSection(s.id)}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-soft transition hover:bg-white/80 hover:text-ink dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
              >
                {s.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-ink shadow-sm transition hover:border-accent/40 hover:text-accent sm:hidden dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-accent-mint/50 dark:hover:text-accent-mint"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="sr-only">
                {menuOpen ? 'Close menu' : 'Open menu'}
              </span>
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                {menuOpen ? (
                  <>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </>
                )}
              </svg>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-accent/40 hover:text-accent dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-accent-mint/50 dark:hover:text-accent-mint"
              aria-pressed={dark}
            >
              {dark ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
        <nav
          id={menuId}
          className={`border-t border-slate-200/70 px-2 py-2 dark:border-slate-700/80 sm:hidden ${menuOpen ? '' : 'hidden'}`}
          aria-label="On-page sections"
        >
          <ul className="flex flex-col gap-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={goSection(s.id)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-ink-soft transition hover:bg-white/90 hover:text-ink dark:hover:bg-slate-800/90 dark:hover:text-slate-100"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </motion.header>
  )
}
