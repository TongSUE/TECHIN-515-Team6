import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Soft pointer-following glow (home hero only). Respects prefers-reduced-motion.
 */
export default function HomeCursorAura({ children }) {
  const reduce = useReducedMotion()
  const wrapRef = useRef(null)
  const [pos, setPos] = useState({ x: 50, y: 40 })

  useEffect(() => {
    if (reduce) return
    const el = wrapRef.current
    if (!el) return

    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      setPos({
        x: Math.min(100, Math.max(0, x)),
        y: Math.min(100, Math.max(0, y)),
      })
    }

    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [reduce])

  return (
    <div ref={wrapRef} className="relative">
      {!reduce ? (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-none opacity-90"
          aria-hidden
        >
          <div
            className="absolute inset-[-20%] transition-[opacity] duration-500"
            style={{
              background: `radial-gradient(42% 38% at ${pos.x}% ${pos.y}%, rgb(59 130 246 / 0.14), transparent 72%), radial-gradient(36% 32% at ${100 - pos.x * 0.6}% ${100 - pos.y * 0.5}%, rgb(45 212 191 / 0.1), transparent 70%)`,
            }}
          />
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  )
}
