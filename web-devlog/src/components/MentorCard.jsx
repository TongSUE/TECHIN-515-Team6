import { ExternalLink } from 'lucide-react'
import tmoLogo from '../assets/tmo-logo-v4.svg'

export default function MentorCard() {
  return (
    <div className="not-prose my-6 flex flex-col items-start gap-4 rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-md ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60 dark:ring-slate-700/40 sm:flex-row sm:items-center sm:gap-6">
      {/* T-Mobile logo */}
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#E20074]/20 bg-[#E20074]/[0.07] p-2 dark:border-[#E20074]/30 dark:bg-[#E20074]/[0.12]"
        aria-hidden
      >
        <img
          src={tmoLogo}
          alt="T-Mobile logo"
          className="h-8 w-auto object-contain"
        />
      </div>

      {/* Name + title */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-bold text-ink dark:text-slate-50">
            Justin Ho
          </p>
          <span className="inline-flex items-center rounded-full border border-[#E20074]/30 bg-[#E20074]/10 px-2 py-0.5 text-[11px] font-semibold text-[#c4005e] dark:border-[#E20074]/40 dark:bg-[#E20074]/15 dark:text-[#ff6eb0]">
            T-Mobile
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100/80 px-2 py-0.5 text-[11px] font-medium text-ink-soft dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Mentor · Week 3
          </span>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft dark:text-slate-400">
          Senior System Design Engineer
        </p>
      </div>

      {/* External link icon */}
      <ExternalLink
        className="hidden h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600 sm:block"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  )
}
