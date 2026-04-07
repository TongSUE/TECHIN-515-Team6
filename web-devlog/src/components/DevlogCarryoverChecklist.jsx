import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Circle, ListTodo } from 'lucide-react'

/**
 * Shows the previous week's planned_next tasks, merged with this week's prior_week_progress.
 */
export default function DevlogCarryoverChecklist({
  fromWeek,
  currentWeek,
  tasks,
  className = '',
}) {
  const reduce = useReducedMotion()
  if (!fromWeek || !tasks?.length) return null

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/70 p-4 shadow-sm ring-1 ring-violet-100/60 dark:border-violet-500/25 dark:from-violet-950/40 dark:via-slate-900/80 dark:to-fuchsia-950/30 dark:ring-violet-500/20 ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-400/15 blur-2xl dark:bg-fuchsia-500/10"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
          <ListTodo className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-800 dark:text-violet-200/90">
            From Week {fromWeek} plan
          </p>
          <p className="mt-1 text-xs text-ink-soft dark:text-slate-400">
            Tasks we committed to in Week {fromWeek}. Completion flags are read
            from Week {currentWeek ?? '…'} front matter (
            <code className="rounded bg-violet-100/80 px-1 py-px text-[10px] dark:bg-violet-900/50">
              prior_week_progress
            </code>
            ).
          </p>
          <ul className="mt-3 space-y-2">
            {tasks.map((t, i) => (
              <motion.li
                key={t.id}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="flex gap-2.5 rounded-lg border border-violet-100/60 bg-white/70 px-3 py-2 text-sm dark:border-violet-500/15 dark:bg-slate-900/40"
              >
                <span className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-300">
                  {t.done ? (
                    <CheckCircle2
                      className="h-4 w-4"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="h-4 w-4 opacity-55"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`font-medium text-ink dark:text-slate-100 ${t.done ? 'line-through opacity-70' : ''}`}
                  >
                    {t.label}
                  </span>
                  {t.description ? (
                    <span className="mt-0.5 block text-xs leading-snug text-ink-soft dark:text-slate-400">
                      {t.description}
                    </span>
                  ) : null}
                </span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] font-medium text-violet-700/80 dark:text-violet-300/70">
            {doneCount}/{tasks.length} done · Week {currentWeek ?? '?'} YAML
          </p>
        </div>
      </div>
    </motion.div>
  )
}
