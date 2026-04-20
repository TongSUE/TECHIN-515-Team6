import { useLocale } from '../context/LocaleContext.jsx'
import { strings } from '../i18n/strings.js'

function tagsForMember(c) {
  if (Array.isArray(c.tags) && c.tags.length > 0) return c.tags
  if (typeof c.role === 'string' && c.role.trim()) {
    return c.role
      .split(/[,;]\s*/)
      .map((t) => t.trim())
      .filter(Boolean)
  }
  return []
}

export default function DevlogCredits({ credits, size = 'md' }) {
  const { locale } = useLocale()
  const sc = strings[locale].credits

  if (!Array.isArray(credits) || credits.length === 0) return null

  const isSm = size === 'sm'
  const avatar = isSm ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm'
  const nameCls = isSm ? 'text-sm' : 'text-base'

  return (
    <div className="flex flex-col gap-2" aria-label={sc.label}>
      <span
        className={`font-medium uppercase tracking-wide text-ink-soft ${isSm ? 'text-[10px]' : 'text-[11px]'}`}
      >
        {sc.label}
      </span>
      <ul className="flex list-none flex-col gap-4 p-0">
        {credits.map((c, i) => {
          const tags = tagsForMember(c)
          return (
            <li
              key={`${c.name}-${i}`}
              className="flex items-start gap-3 sm:items-center sm:gap-4"
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/90 to-teal-400/90 font-bold text-white shadow-sm ${avatar}`}
                aria-hidden
              >
                {c.initials}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span
                  className={`shrink-0 font-semibold text-ink dark:text-slate-100 ${nameCls}`}
                >
                  {c.name}
                </span>
                {tags.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex max-w-full items-center rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-left text-[11px] font-medium leading-snug text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 sm:text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
