import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, Code2, FileText } from 'lucide-react'
import { useLocale } from '../context/LocaleContext.jsx'
import { strings } from '../i18n/strings.js'

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

const pillContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.18 },
  },
}

const pillItem = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function Hero({ githubUrl }) {
  const reduce = useReducedMotion()
  const { locale } = useLocale()
  const s = strings[locale].hero

  const scrollToDevlog = () => {
    document.getElementById('devlog')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToVision = () => {
    document.getElementById('vision')?.scrollIntoView({ behavior: 'smooth' })
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
          {s.eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className={`text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-tight ${
            reduce
              ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-slate-400'
              : 'title-gradient-animated animate-gradient-flow bg-clip-text text-transparent'
          }`}
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
            {s.taglineStrong}{' '}
            <span className="font-medium text-ink dark:text-slate-100">
              {s.taglineEmphasis}
            </span>{' '}
            {s.taglineTail}
          </span>
        </motion.p>

        <motion.ul
          variants={pillContainer}
          initial="hidden"
          animate="show"
          className="mx-auto mt-6 flex max-w-lg list-none flex-wrap justify-center gap-2 text-xs font-medium text-ink-soft"
          aria-label={s.pillsAriaLabel}
        >
          {s.pills.map((label) => (
            <motion.li key={label} variants={pillItem}>
              <span
                className={`inline-block rounded-full border border-slate-200/90 bg-white/70 px-3 py-1 text-ink/85 shadow-sm backdrop-blur transition-[transform,box-shadow] will-change-transform dark:border-slate-600/80 dark:bg-slate-800/50 dark:text-slate-200 ${
                  reduce
                    ? ''
                    : 'hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md dark:hover:border-accent-mint/35'
                }`}
              >
                {label}
              </span>
            </motion.li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.button
            type="button"
            onClick={scrollToDevlog}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            whileHover={reduce ? undefined : { y: -2 }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/15 outline-none ring-offset-2 transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-accent dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100 dark:focus-visible:ring-accent-mint dark:ring-offset-slate-900"
          >
            <FileText className="h-4 w-4 opacity-90" strokeWidth={2.25} aria-hidden />
            {s.readDevlog}
          </motion.button>
          <motion.a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            whileTap={reduce ? undefined : { scale: 0.97 }}
            whileHover={reduce ? undefined : { y: -2 }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white/80 px-6 py-3 text-sm font-medium text-ink shadow-sm backdrop-blur outline-none ring-offset-2 transition-colors hover:border-accent/35 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:border-accent-mint/40 dark:hover:text-accent-mint dark:ring-offset-slate-900 dark:focus-visible:ring-accent-mint"
          >
            <Code2 className="h-4 w-4 opacity-90" strokeWidth={2.25} aria-hidden />
            {s.viewGithub}
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-14 flex flex-col items-center gap-1"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
            {s.explore}
          </span>
          <button
            type="button"
            onClick={scrollToVision}
            className="group flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-ink-soft outline-none transition hover:text-accent focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-accent-mint dark:focus-visible:ring-accent-mint"
            aria-label={s.scrollToVision}
          >
            <span className="text-xs">{s.howItWorks}</span>
            <motion.span
              aria-hidden
              className="inline-block"
              animate={
                reduce
                  ? undefined
                  : { y: [0, 6, 0] }
              }
              transition={
                reduce
                  ? undefined
                  : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              <ArrowDown className="h-5 w-5 opacity-70 transition group-hover:opacity-100" strokeWidth={2.25} />
            </motion.span>
          </button>
        </motion.div>
      </div>
    </section>
  )
}
