import { Activity, Brain, Clock, Droplets, Zap } from 'lucide-react'
import { ChevronDown, ChevronRight } from 'lucide-react'

function StateNode({ icon: Icon, label, sublabel, color = 'default', className = '' }) {
  const colors = {
    default:  'border-slate-200/90 bg-white/90 shadow-md ring-1 ring-slate-200/60 dark:border-slate-600/80 dark:bg-slate-800/80 dark:ring-slate-600/50',
    idle:     'border-teal-300/80 bg-gradient-to-br from-teal-50/95 to-white shadow-lg ring-2 ring-teal-400/40 dark:border-teal-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-teal-500/35',
    ml:       'border-sky-300/80 bg-gradient-to-br from-sky-50 to-white shadow-lg ring-2 ring-sky-400/35 dark:border-sky-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-sky-500/30',
    actuate:  'border-violet-300/80 bg-gradient-to-br from-violet-50/90 to-white shadow-lg ring-2 ring-violet-400/35 dark:border-violet-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-violet-500/30',
    cooldown: 'border-amber-300/70 bg-gradient-to-br from-amber-50/90 to-white shadow-md ring-2 ring-amber-400/30 dark:border-amber-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-amber-500/25',
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

function Arrow({ label, horizontal = false }) {
  if (horizontal) {
    return (
      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500" aria-hidden>
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">{label}</span>
        )}
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-0.5 py-1 text-slate-400 dark:text-slate-500" aria-hidden>
      {label && (
        <span className="max-w-[14rem] text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">{label}</span>
      )}
      <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
    </div>
  )
}

function Pill({ children, color = 'default' }) {
  const colors = {
    default: 'border-slate-200/80 bg-white/80 text-ink-soft dark:border-slate-600 dark:bg-slate-800/80',
    green:   'border-teal-200/80 bg-teal-50/80 text-teal-800 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-200',
    red:     'border-rose-200/80 bg-rose-50/80 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${colors[color] ?? colors.default}`}>
      {children}
    </span>
  )
}

export default function StateMachineDiagram() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="AuraSync firmware state machine diagram"
    >
      <figcaption className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Firmware
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          State machine — IDLE → ML_PROCESSING → ACTUATION → COOLDOWN
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          Non-blocking: all timing via millis() deltas, no delay() in the main loop.
        </p>
      </figcaption>

      <div className="mx-auto flex max-w-xl flex-col items-center">
        {/* IDLE */}
        <StateNode
          icon={Activity}
          label="IDLE"
          sublabel="Sensors streaming · waiting for trigger"
          color="idle"
          className="w-full max-w-xs"
        />

        <Arrow label="slope threshold crossed" />

        {/* ML_PROCESSING */}
        <StateNode
          icon={Brain}
          label="ML_PROCESSING"
          sublabel="Feature aggregation · sensor-based ML inference"
          color="ml"
          className="w-full max-w-xs"
        />

        {/* ML branch */}
        <div className="my-3 grid w-full max-w-lg grid-cols-2 gap-3 text-center">
          <div className="flex flex-col items-center gap-2">
            <Arrow />
            <Pill color="green">confidence ≥ 70 %</Pill>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Arrow />
            <Pill color="red">confidence &lt; 70 %</Pill>
          </div>
        </div>

        <div className="grid w-full max-w-lg grid-cols-2 gap-3">
          {/* ACTUATION */}
          <StateNode
            icon={Droplets}
            label="ACTUATION"
            sublabel="Pump ON · 2 s"
            color="actuate"
          />
          {/* back to IDLE */}
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/60 p-4 text-center dark:border-slate-600 dark:bg-slate-900/40">
            <Activity className="h-5 w-5 text-slate-400 dark:text-slate-500" strokeWidth={2} />
            <p className="text-[11px] font-medium text-ink-soft dark:text-slate-400">→ back to IDLE</p>
          </div>
        </div>

        <Arrow label="2 s elapsed" />

        {/* COOLDOWN */}
        <StateNode
          icon={Clock}
          label="COOLDOWN"
          sublabel="VOC lockout · 60 s · no re-spray"
          color="cooldown"
          className="w-full max-w-xs"
        />

        <Arrow label="60 s elapsed" />

        {/* Back to IDLE indicator */}
        <div className="flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-4 py-2 dark:border-teal-500/30 dark:bg-teal-950/40">
          <Zap className="h-4 w-4 text-teal-700 dark:text-teal-300" strokeWidth={2.25} />
          <span className="text-[12px] font-semibold text-teal-800 dark:text-teal-200">→ IDLE · ready for next trigger</span>
        </div>
      </div>
    </figure>
  )
}
