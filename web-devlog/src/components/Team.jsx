import { motion } from 'framer-motion'
import { useLocale } from '../context/LocaleContext.jsx'
import { strings } from '../i18n/strings.js'

const GithubIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-4 w-4"
    aria-hidden
  >
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

const GITHUB = ['https://github.com/TongSUE', 'https://github.com/xtshen777']
const INITIALS = ['Y', 'L']
const NAMES = ['Yutong Luo', 'Lucia Shen']

export default function Team() {
  const { locale } = useLocale()
  const st = strings[locale].team
  const people = st.people.map((p, i) => ({
    ...p,
    name: NAMES[i],
    initials: INITIALS[i],
    github: GITHUB[i],
  }))

  return (
    <section
      id="team"
      className="scroll-mt-24 bg-white px-6 py-20 dark:bg-slate-950 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          {st.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          {st.heading}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
          {st.intro}
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {people.map((p, i) => (
            <motion.article
              key={p.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="glass-panel flex flex-col rounded-2xl p-8"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/90 to-teal-400/90 text-lg font-bold text-white shadow-md">
                  {p.initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-ink dark:text-slate-100">
                      {p.name}
                    </h3>
                    <a
                      href={p.github}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${p.name} on GitHub`}
                      className="text-ink-soft transition hover:text-ink dark:text-slate-400 dark:hover:text-slate-100"
                    >
                      <GithubIcon />
                    </a>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-accent dark:text-accent-mint">
                    {p.role}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {p.bio}
              </p>

              <div className="mt-5 space-y-3">
                {p.weeks.map((w) => (
                  <div key={w.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft dark:text-slate-400">
                      {w.label}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {w.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm text-ink-soft"
                        >
                          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50 dark:bg-accent-mint/50" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-ink-soft">
          MSTI Hardware–Software Lab II · Team 6 · AuraSync
        </p>
      </div>
    </section>
  )
}
