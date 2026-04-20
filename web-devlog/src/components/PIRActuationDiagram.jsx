import { ChevronDown } from 'lucide-react'
import { Eye, EyeOff, Droplets, Clock, RefreshCw, AlertTriangle } from 'lucide-react'

function StepNode({ icon: Icon, label, sublabel, color = 'default', className = '' }) {
  const colors = {
    default:  'border-slate-200/90 bg-white/90 shadow-md ring-1 ring-slate-200/60 dark:border-slate-600/80 dark:bg-slate-800/80',
    detect:   'border-sky-300/80 bg-gradient-to-br from-sky-50 to-white shadow-lg ring-2 ring-sky-400/35 dark:border-sky-500/40 dark:from-slate-800 dark:to-slate-900',
    spray:    'border-violet-300/80 bg-gradient-to-br from-violet-50/90 to-white shadow-lg ring-2 ring-violet-400/35 dark:border-violet-500/40 dark:from-slate-800 dark:to-slate-900',
    cooldown: 'border-amber-300/70 bg-gradient-to-br from-amber-50/90 to-white shadow-md ring-2 ring-amber-400/30 dark:border-amber-500/40 dark:from-slate-800 dark:to-slate-900',
    resume:   'border-teal-300/80 bg-gradient-to-br from-teal-50/95 to-white shadow-lg ring-2 ring-teal-400/40 dark:border-teal-500/40 dark:from-slate-800 dark:to-slate-900',
    grace:    'border-rose-200/70 bg-gradient-to-br from-rose-50/80 to-white shadow-sm ring-1 ring-rose-300/30 dark:border-rose-500/35 dark:from-slate-800 dark:to-slate-900',
  }
  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl border px-5 py-3.5 text-center ${colors[color] ?? colors.default} ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-200">
        <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </span>
      <div>
        <p className="text-sm font-bold leading-tight text-ink dark:text-slate-100">{label}</p>
        {sublabel && (
          <p className="mt-0.5 text-[11px] leading-snug text-ink-soft dark:text-slate-400">{sublabel}</p>
        )}
      </div>
    </div>
  )
}

function Arrow({ label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1 text-slate-400 dark:text-slate-500" aria-hidden>
      {label && (
        <span className="max-w-[14rem] text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">{label}</span>
      )}
      <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
    </div>
  )
}

export default function PIRActuationDiagram() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="PIR-triggered atomizer actuation logic diagram"
    >
      <figcaption className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Actuation logic
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          HC-SR501 PIR → 2N2222 transistor → ultrasonic atomizer
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          Presence must be held for 3 s to filter false triggers; 1.5 s grace period for PIR glitches.
        </p>
      </figcaption>

      <div className="mx-auto flex max-w-lg flex-col items-center gap-0">

        {/* Presence detected */}
        <StepNode
          icon={Eye}
          label="Presence detected"
          sublabel="HC-SR501 PIR OUT → HIGH (jumper H = repeat trigger)"
          color="detect"
          className="w-full max-w-sm"
        />

        <Arrow label="continuous ≥ 3 s" />

        {/* Spray ON */}
        <StepNode
          icon={Droplets}
          label="Spray ON"
          sublabel="GPIO5 HIGH → 2N2222 → atomizer powered · 5 s"
          color="spray"
          className="w-full max-w-sm"
        />

        <Arrow label="5 s elapsed" />

        {/* Cooldown */}
        <StepNode
          icon={Clock}
          label="Cooldown"
          sublabel="Spray OFF · 3 s pause before next cycle"
          color="cooldown"
          className="w-full max-w-sm"
        />

        <Arrow label="3 s elapsed" />

        {/* Resume */}
        <StepNode
          icon={RefreshCw}
          label="Resume detection"
          sublabel="PIR polling restarts · ready for next trigger"
          color="resume"
          className="w-full max-w-sm"
        />

        {/* Grace-period side note */}
        <div className="mt-8 flex w-full max-w-sm items-start gap-3 rounded-xl border border-rose-200/70 bg-rose-50/80 p-4 text-left dark:border-rose-500/30 dark:bg-rose-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" strokeWidth={2.25} aria-hidden />
          <div>
            <p className="text-[12px] font-semibold text-rose-800 dark:text-rose-200">
              Presence lost mid-window
            </p>
            <p className="mt-1 text-[11px] leading-snug text-rose-700/80 dark:text-rose-300/70">
              3 s countdown resets. A 1.5 s grace period tolerates brief PIR LOW glitches so a single momentary dip doesn't cancel the timer.
            </p>
          </div>
        </div>

        {/* PIR jumper note */}
        <div className="mt-3 flex w-full max-w-sm items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 p-4 text-left dark:border-amber-500/30 dark:bg-amber-950/30">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2.25} aria-hidden />
          <div>
            <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
              Jumper must be set to H (repeat trigger)
            </p>
            <p className="mt-1 text-[11px] leading-snug text-amber-700/80 dark:text-amber-300/70">
              In L (single-trigger) mode the HC-SR501 drops LOW after ~1 s regardless of presence, resetting the countdown permanently.
            </p>
          </div>
        </div>

      </div>
    </figure>
  )
}
