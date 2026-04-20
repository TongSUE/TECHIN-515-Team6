import { Sparkles } from 'lucide-react'

export default function SpecialThanksCard() {
  return (
    <div className="not-prose my-6 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-50/90 to-yellow-50/70 px-5 py-4 shadow-sm dark:border-amber-500/30 dark:from-amber-950/30 dark:to-yellow-950/20">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
        <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <p className="text-[13.5px] leading-relaxed text-amber-900/90 dark:text-amber-200/85">
        <span className="font-semibold">Special thanks</span> to Justin Ho for his time and
        thoughtful guidance on product strategy and connected-device architecture.
      </p>
    </div>
  )
}
