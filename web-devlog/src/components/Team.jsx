import { motion } from 'framer-motion'

const people = [
  {
    name: 'Yutong',
    role: '[Role Placeholder]',
    bio: 'Lorem ipsum dolor sit amet. [Short bio placeholder.]',
  },
  {
    name: 'Lucia',
    role: '[Role Placeholder]',
    bio: 'Lorem ipsum dolor sit amet. [Short bio placeholder.]',
  },
]

export default function Team() {
  return (
    <section
      id="team"
      className="scroll-mt-24 bg-white px-6 py-20 dark:bg-slate-950 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          The Team
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          [Team section heading placeholder]
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {people.map((p, i) => (
            <motion.article
              key={p.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="glass-panel rounded-2xl p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/90 to-teal-400/90 text-lg font-bold text-white shadow-md">
                {p.name.slice(0, 1)}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-ink dark:text-slate-100">
                {p.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-accent dark:text-accent-mint">
                {p.role}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {p.bio}
              </p>
            </motion.article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-ink-soft">
          [Footer line placeholder]
        </p>
      </div>
    </section>
  )
}
