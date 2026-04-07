import { motion } from 'framer-motion'

const steps = [
  {
    title: 'Sensing',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Project description placeholder — sensing path.]',
    tag: 'Input',
  },
  {
    title: 'Edge ML',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Project description placeholder — on-device inference.]',
    tag: 'Think',
  },
  {
    title: 'Actuation',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Project description placeholder — actuation path.]',
    tag: 'Output',
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
  return (
    <section
      id="vision"
      className="scroll-mt-24 border-b border-slate-200/70 bg-white px-6 py-20 dark:border-slate-800 dark:bg-slate-950 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          The Vision
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          [Architecture overview placeholder]
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          [Project description placeholder — high-level vision for sensing, edge
          ML, and actuation.]
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
              className="glass-panel relative flex flex-col rounded-2xl p-6"
            >
              <span className="mb-3 inline-flex w-fit rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent dark:bg-accent-mint/15 dark:text-accent-mint">
                {s.tag}
              </span>
              <h3 className="text-lg font-semibold text-ink dark:text-slate-100">
                {s.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                {s.body}
              </p>
              {i < steps.length - 1 && (
                <span
                  className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-300 dark:text-slate-600 md:block"
                  aria-hidden
                >
                  →
                </span>
              )}
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mt-10 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 p-6 dark:border-slate-600 dark:bg-slate-900/40"
        >
          <p className="text-sm font-semibold text-ink dark:text-slate-100">
            [Optional callout title placeholder]
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Additional
            architecture or process notes placeholder.]
          </p>
        </motion.div>
      </div>
    </section>
  )
}
