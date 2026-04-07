import { motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const sections = [
  { id: 'vision', label: 'Vision' },
  { id: 'devlog', label: 'Devlog' },
  { id: 'team', label: 'Team' },
]

export default function Nav({ dark, onToggleTheme }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const goSection = (id) => (e) => {
    e.preventDefault()
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
      <div className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-2xl border border-white/50 bg-white/70 px-4 py-2.5 shadow-glass backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/65">
        <Link
          to="/"
          className="text-sm font-semibold tracking-tight text-ink transition hover:text-accent dark:text-slate-100"
        >
          AuraSync
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Section">
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
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-accent/40 hover:text-accent dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-accent-mint/50 dark:hover:text-accent-mint"
          aria-pressed={dark}
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </motion.header>
  )
}
