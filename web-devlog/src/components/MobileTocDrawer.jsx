import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function scrollToHeading(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function MobileTocDrawer({ items, open, onClose }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="toc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="toc-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-slate-200/80 bg-white/95 px-4 pb-8 pt-4 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft dark:text-slate-400">
                On this page
              </p>
              <button
                onClick={onClose}
                aria-label="Close table of contents"
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {items.map(({ level, text, id }, i) => (
                <li key={`${id}-${i}`}>
                  <button
                    onClick={() => { scrollToHeading(id); onClose() }}
                    className={
                      level === 3
                        ? 'block w-full break-words py-1.5 pl-4 text-left text-[13px] leading-snug text-ink-soft transition hover:text-ink dark:hover:text-slate-100'
                        : 'block w-full break-words py-1.5 pl-1 text-left font-medium leading-snug text-ink transition hover:text-accent dark:text-slate-100 dark:hover:text-accent-mint'
                    }
                  >
                    {text}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
