import { motion, useReducedMotion } from 'framer-motion'
import { Activity, BrainCircuit, Droplets } from 'lucide-react'

const steps = [
  {
    title: 'Sensing',
    body:
      'BME680 supplies VOC and climate gradients; the I2S mic adds acoustic features. We prioritize trends over absolute values so each room can establish its own baseline.',
    tag: 'Input',
    Icon: Activity,
  },
  {
    title: 'Edge ML',
    body:
      'On the XIAO ESP32-S3, a ~30s sliding window fuses modalities for a lightweight classifier. Actuation only fires on high confidence, with rules to suppress false alarms (e.g., hairspray + dryer).',
    tag: 'Think',
    Icon: BrainCircuit,
  },
  {
    title: 'Actuation',
    body:
      'After spray, a VOC spike forces Cooldown—voice and button requests are rejected until the air clears, preventing scent overload. We are evaluating ultrasonic atomizers for finer misting.',
    tag: 'Output',
    Icon: Droplets,
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function Vision() {
  const reduce = useReducedMotion()

  return (
    <section
      id="vision"
      className="scroll-mt-24 border-b border-slate-200/70 bg-white px-6 py-20 dark:border-slate-800 dark:bg-slate-950 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          <span className="inline-block h-px w-6 bg-accent/50 dark:bg-accent-mint/50" aria-hidden />
          The vision
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          Sense, infer, actuate — one closed loop
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          AuraSync turns bathroom-scale context (odor, shower steam, grooming noise)
          into actionable signals: inference stays on-device, and chemical feedback
          keeps spraying within safe bounds. Week-by-week detail lives in the devlog
          below.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.article
              key={s.title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              whileHover={
                reduce
                  ? undefined
                  : { y: -6, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }
              }
              className="glass-panel group relative flex flex-col overflow-hidden rounded-2xl p-6 transition-shadow duration-300 hover:shadow-glass-lg dark:hover:shadow-[0_20px_48px_rgb(0_0_0/0.35)]"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-teal-400 to-accent-mint opacity-80 transition-opacity duration-300 group-hover:opacity-100 dark:from-sky-400 dark:via-teal-300 dark:to-violet-400"
                aria-hidden
              />
              <div className="mb-3 mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-105 dark:bg-accent-mint/15 dark:text-accent-mint">
                <s.Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </div>
              <span className="mb-3 inline-flex w-fit rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent transition-colors group-hover:bg-accent/15 dark:bg-accent-mint/15 dark:text-accent-mint dark:group-hover:bg-accent-mint/25">
                {s.tag}
              </span>
              <h3 className="text-lg font-semibold text-ink transition-colors group-hover:text-accent dark:text-slate-100 dark:group-hover:text-accent-mint">
                {s.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                {s.body}
              </p>
              {i < steps.length - 1 && (
                <motion.span
                  className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-lg text-slate-300 dark:text-slate-600 md:block"
                  aria-hidden
                  animate={
                    reduce
                      ? undefined
                      : { x: [0, 5, 0] }
                  }
                  transition={
                    reduce
                      ? undefined
                      : {
                          duration: 2.4,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.2,
                        }
                  }
                >
                  →
                </motion.span>
              )}
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          whileHover={
            reduce
              ? undefined
              : { scale: 1.01, transition: { duration: 0.2 } }
          }
          className="relative mt-10 overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-slate-50/95 to-white p-6 shadow-sm ring-1 ring-slate-200/60 dark:border-accent-mint/25 dark:from-slate-900/80 dark:to-slate-950 dark:ring-slate-700/50"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl dark:bg-accent-mint/15"
            aria-hidden
          />
          <p className="relative text-sm font-semibold text-ink dark:text-slate-100">
            Why a chemical feedback loop?
          </p>
          <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Timed dispensers cannot tell when the air is already saturated. After a
            spray we watch for a VOC spike and enter Cooldown until readings return
            to baseline — a hardware-friendly interlock that matches our Week 1
            functional architecture diagram.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
