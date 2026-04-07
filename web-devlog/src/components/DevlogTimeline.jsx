import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import DevlogCredits from './DevlogCredits.jsx'

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

  return (
    <section
      id="devlog"
      className="scroll-mt-24 border-b border-slate-200/70 bg-slate-50/80 px-6 py-20 dark:border-slate-800 dark:bg-slate-900/40 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Weekly Devlog
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          [Devlog timeline heading placeholder]
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Cards show a short summary only. Open a week to read the full Markdown
          report (tables, quotes, and figures). Primary source:{' '}
          <code className="rounded-md bg-white/90 px-1.5 py-0.5 text-sm text-ink shadow-sm dark:bg-slate-800 dark:text-slate-200">
            src/content/devlog/*.md
          </code>
          ; fallback:{' '}
          <code className="rounded-md bg-white/90 px-1.5 py-0.5 text-sm text-ink shadow-sm dark:bg-slate-800 dark:text-slate-200">
            src/data/devlog.json
          </code>
          .
        </p>

        <ol className="relative mt-14 space-y-10 border-l border-slate-200 pl-8 dark:border-slate-700">
          {weeks.map((w, index) => {
            const status = w.status
            const statusClass =
              status && status in statusStyles
                ? statusStyles[status]
                : defaultStatusClass

            return (
              <motion.li
                key={w.week}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: index * 0.04 }}
                className="relative"
              >
                <span
                  className="absolute -left-[39px] top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-accent shadow-sm dark:border-slate-900 dark:bg-accent-mint"
                  aria-hidden
                />
                <article
                  className="glass-panel group rounded-2xl p-6 transition duration-300 will-change-transform hover:-translate-y-1 hover:shadow-glass-lg dark:hover:shadow-[0_24px_64px_rgb(0_0_0/0.35)]"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-900/5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:bg-white/10 dark:text-slate-300">
                      Week {w.week}
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

                  {w.credits?.length ? (
                    <div className="mt-4">
                      <DevlogCredits credits={w.credits} size="sm" />
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <Link
                      to={`/devlog/${w.week}`}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100"
                    >
                      Open full entry
                      <span aria-hidden className="text-xs opacity-80">
                        →
                      </span>
                    </Link>
                  </div>
                </article>
              </motion.li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
