import { motion, useReducedMotion } from 'framer-motion'

function Blobs({ reduce }) {
  if (reduce) {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-600/25" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-teal-200/45 blur-3xl dark:bg-teal-500/20" />
      </div>
    )
  }
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-200/55 blur-3xl dark:bg-blue-600/30"
        animate={{ x: [0, 24, 0], y: [0, 18, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-16 top-32 h-64 w-64 rounded-full bg-teal-200/50 blur-3xl dark:bg-teal-500/25"
        animate={{ x: [0, -20, 0], y: [0, 28, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-600/22"
        animate={{ y: [0, -22, 0], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

export default function Hero({ githubUrl }) {
  const reduce = useReducedMotion()

  const scrollToDevlog = () => {
    document.getElementById('devlog')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-slate-50 to-white px-6 pb-24 pt-28 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:px-10 sm:pb-28 sm:pt-32"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-grid-soft bg-[length:48px_48px] opacity-40 dark:opacity-25"
        aria-hidden
      />
      <Blobs reduce={reduce} />

      <div className="relative mx-auto max-w-3xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint"
        >
          Hardware × ML Lab · Devlog
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-4xl font-semibold tracking-tight text-transparent dark:from-white dark:via-slate-100 dark:to-slate-400 sm:text-5xl sm:leading-tight"
        >
          AuraSync
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl"
        >
          <span className="text-ink dark:text-slate-200">
            [One-line pitch placeholder]
          </span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={scrollToDevlog}
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100"
          >
            Read Devlog
          </button>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-300/90 bg-white/80 px-6 py-3 text-sm font-medium text-ink shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-accent/35 hover:text-accent dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:border-accent-mint/40 dark:hover:text-accent-mint"
          >
            View GitHub Repo
          </a>
        </motion.div>
      </div>
    </section>
  )
}
