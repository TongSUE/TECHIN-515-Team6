import { useState, useEffect } from 'react'

export default function ReadingProgress({ visible = true }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) return
    function onScroll() {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="fixed left-0 top-0 z-[60] h-0.5 bg-accent transition-[width] duration-100 ease-out dark:bg-accent-mint"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  )
}
