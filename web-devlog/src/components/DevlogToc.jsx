import { useState, useEffect } from 'react'

function scrollToHeading(id) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onTocClick(e, id) {
  e.preventDefault()
  scrollToHeading(id)
}

export default function DevlogToc({ items }) {
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    if (!items.length) return

    const ids = items.map((item) => item.id)

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry (closest to top of viewport)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [items])

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
        {items.map(({ level, text, id }, i) => {
          const isActive = activeId === id
          return (
            <li key={`${id}-${i}`}>
              <a
                href={`#${id}`}
                onClick={(e) => onTocClick(e, id)}
                className={
                  level === 3
                    ? `block break-words border-l-2 py-1 pl-3 text-[13px] leading-snug transition ${
                        isActive
                          ? 'border-accent text-accent dark:border-accent-mint dark:text-accent-mint'
                          : 'border-transparent text-ink-soft hover:border-accent/50 hover:text-ink dark:hover:border-accent-mint/50 dark:hover:text-slate-100'
                      }`
                    : `block break-words border-l-2 py-1.5 pl-2 font-medium leading-snug transition ${
                        isActive
                          ? 'border-accent text-accent dark:border-accent-mint dark:text-accent-mint'
                          : 'border-transparent text-ink hover:border-accent/60 hover:text-accent dark:text-slate-100 dark:hover:border-accent-mint/60 dark:hover:text-accent-mint'
                      }`
                }
              >
                {text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
