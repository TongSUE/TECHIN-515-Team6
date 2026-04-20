import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import DevlogCarryoverChecklist from './DevlogCarryoverChecklist.jsx'
import DevlogCredits from './DevlogCredits.jsx'
import { getCarryoverTasksForWeek } from '../utils/loadDevlog.js'
import { useLocale } from '../context/LocaleContext.jsx'
import { strings } from '../i18n/strings.js'

const statusStyles = {
  Blocking:
    'bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  Testing:
    'bg-blue-100 text-blue-900 ring-blue-200/80 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-500/30',
  'In Progress':
    'bg-blue-100 text-blue-900 ring-blue-200/80 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-500/30',
  Completed:
    'bg-teal-100 text-teal-900 ring-teal-200/80 dark:bg-teal-500/15 dark:text-teal-100 dark:ring-teal-500/30',
}

const defaultStatusClass =
  'bg-slate-100 text-slate-800 ring-slate-200/80 dark:bg-slate-700/40 dark:text-slate-100 dark:ring-slate-600/50'

export default function DevlogTimeline({ weeks }) {
  const reduce = useReducedMotion()
  const { locale } = useLocale()
  const st = strings[locale].timeline
  const sw = strings[locale].week

  const FILTERS = [
    { key: 'All', label: st.filterAll },
    { key: 'In Progress', label: st.filterInProgress },
    { key: 'Completed', label: st.filterCompleted },
  ]
  const [filter, setFilter] = useState('All')

  const filteredWeeks =
    filter === 'All' ? weeks : weeks.filter((w) => w.status === filter)

  return (
    <section
      id="devlog"
      className="scroll-mt-24 border-b border-slate-200/70 bg-slate-50/80 px-6 py-20 dark:border-slate-800 dark:bg-slate-900/40 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          {st.eyebrow}
        </p>
        <h2 className="mt-3 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent dark:bg-accent-mint/15 dark:text-accent-mint">
            <BookOpen className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <span>{st.heading}</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          {st.intro}
        </p>

        {/* Filter pills */}
        <div className="mt-10 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? 'rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'rounded-full border border-slate-200/80 bg-white/80 px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700'
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <ol className="relative mt-10 space-y-10 border-l border-slate-200 pl-8 dark:border-slate-700">
          <AnimatePresence initial={false}>
          {filteredWeeks.map((w, index) => {
            const status = w.status
            const statusClass =
              status && status in statusStyles
                ? statusStyles[status]
                : defaultStatusClass
            const carry = getCarryoverTasksForWeek(w.week, weeks)

            return (
              <motion.li
                key={w.week}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? {} : { opacity: 0, y: -10 }}
                transition={{ duration: 0.32, delay: index * 0.04 }}
                className="group/tl relative"
              >
                <span
                  className="absolute -left-[39px] top-2 flex h-5 w-5 items-center justify-center"
                  aria-hidden
                >
                  <span className="absolute inset-0 rounded-full bg-accent/45 opacity-0 transition duration-500 group-hover/tl:scale-[1.85] group-hover/tl:opacity-100 group-hover/tl:animate-ping dark:bg-accent-mint/40 dark:group-hover/tl:animate-none dark:group-hover/tl:scale-150 dark:group-hover/tl:opacity-80" />
                  <span className="relative z-[1] h-5 w-5 rounded-full border-2 border-white bg-accent shadow-sm ring-2 ring-accent/20 transition group-hover/tl:ring-accent/50 dark:border-slate-900 dark:bg-accent-mint dark:ring-accent-mint/25 dark:group-hover/tl:ring-accent-mint/50" />
                </span>
                <article
                  className="glass-panel rounded-2xl p-6 transition duration-300 will-change-transform group-hover/tl:-translate-y-1 group-hover/tl:shadow-glass-lg dark:group-hover/tl:shadow-[0_24px_64px_rgb(0_0_0/0.35)]"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-900/5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:bg-white/10 dark:text-slate-300">
                      {sw.weekLabel(w.week)}
                      {w.date ? ` · ${w.date}` : ''}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusClass}`}
                    >
                      {status || 'Testing'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-ink dark:text-slate-100">
                    <Link
                      to={`/devlog/${w.week}`}
                      className="transition hover:text-accent dark:hover:text-accent-mint"
                    >
                      {w.title}
                    </Link>
                  </h3>

                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
                    {w.summary}
                  </p>

                  {carry ? (
                    <div className="mt-4">
                      <DevlogCarryoverChecklist
                        fromWeek={carry.fromWeek}
                        currentWeek={carry.currentWeek}
                        tasks={carry.tasks}
                      />
                    </div>
                  ) : null}

                  {w.credits?.length ? (
                    <div className="mt-4">
                      <DevlogCredits credits={w.credits} size="sm" />
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <Link
                      to={`/devlog/${w.week}`}
                      className="group/btn inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100"
                    >
                      {st.openEntry}
                      <span
                        aria-hidden
                        className="text-xs opacity-80 transition group-hover/btn:translate-x-0.5 group-hover/btn:opacity-100"
                      >
                        →
                      </span>
                    </Link>
                  </div>
                </article>
              </motion.li>
            )
          })}
          </AnimatePresence>
        </ol>
      </div>
    </section>
  )
}
