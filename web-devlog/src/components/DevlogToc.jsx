function scrollToHeading(id) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onTocClick(e, id) {
  e.preventDefault()
  scrollToHeading(id)
}

export default function DevlogToc({ items }) {
  if (!items.length) return null

  return (
    <nav
      className="w-full min-w-0 max-w-none rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/70"
      aria-label="On this page"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft dark:text-slate-400">
        On this page
      </p>
      <ul className="mt-3 max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto pr-1 text-sm">
        {items.map(({ level, text, id }, i) => (
          <li key={`${id}-${i}`}>
            <a
              href={`#${id}`}
              onClick={(e) => onTocClick(e, id)}
              className={
                level === 3
                  ? 'block break-words border-l-2 border-transparent py-1 pl-3 text-[13px] leading-snug text-ink-soft transition hover:border-accent/50 hover:text-ink dark:hover:border-accent-mint/50 dark:hover:text-slate-100'
                  : 'block break-words border-l-2 border-transparent py-1.5 pl-2 font-medium leading-snug text-ink transition hover:border-accent/60 hover:text-accent dark:text-slate-100 dark:hover:border-accent-mint/60 dark:hover:text-accent-mint'
              }
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
