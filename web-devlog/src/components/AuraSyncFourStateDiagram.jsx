import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplets,
  Radio,
  SkipForward,
  XCircle,
  Zap,
} from 'lucide-react'

function StateNode({ icon: Icon, label, sublabel, color = 'default', className = '' }) {
  const colors = {
    idle:     'border-teal-300/80 bg-gradient-to-br from-teal-50/95 to-white shadow-lg ring-2 ring-teal-400/40 dark:border-teal-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-teal-500/35',
    listen:   'border-violet-300/80 bg-gradient-to-br from-violet-50/90 to-white shadow-lg ring-2 ring-violet-400/35 dark:border-violet-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-violet-500/30',
    actuate:  'border-indigo-300/80 bg-gradient-to-br from-indigo-50/90 to-white shadow-lg ring-2 ring-indigo-400/35 dark:border-indigo-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-indigo-500/30',
    cooldown: 'border-amber-300/70 bg-gradient-to-br from-amber-50/90 to-white shadow-md ring-2 ring-amber-400/30 dark:border-amber-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-amber-500/25',
    default:  'border-slate-200/90 bg-white/90 shadow-md ring-1 ring-slate-200/60 dark:border-slate-600/80 dark:bg-slate-800/80',
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

function VArrow({ label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1 text-slate-400 dark:text-slate-500" aria-hidden>
      {label && (
        <span className="max-w-[16rem] text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">
          {label}
        </span>
      )}
      <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
    </div>
  )
}

function OutcomePill({ icon: Icon, children, color = 'default' }) {
  const colors = {
    green:  'border-teal-200/80 bg-teal-50/80 text-teal-800 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-200',
    red:    'border-rose-200/80 bg-rose-50/80 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200',
    amber:  'border-amber-200/80 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200',
    default:'border-slate-200/80 bg-white/80 text-ink-soft dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${colors[color]}`}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  )
}

export default function AuraSyncFourStateDiagram() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="AuraSync four-state machine diagram"
    >
      <figcaption className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Firmware · State Machine
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          AuraSync v3 — four-state machine
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          PIR and voice share one state machine. "Stop" is the only command that can cancel an
          active spray mid-cycle; PIR can skip the LISTENING window entirely.
        </p>
      </figcaption>

      <div className="mx-auto flex max-w-lg flex-col items-center">

        {/* IDLE */}
        <StateNode
          icon={Activity}
          label="IDLE"
          sublabel="Sensors polling · waiting for any trigger"
          color="idle"
          className="w-full"
        />

        {/* Two exits from IDLE */}
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1">
            <VArrow label='"Aura" recognised' />
            <OutcomePill color="default">→ LISTENING</OutcomePill>
          </div>
          <div className="flex flex-col items-center gap-1">
            <VArrow label="PIR held ≥ 3 s" />
            <OutcomePill icon={SkipForward} color="amber">skip → ACTUATION</OutcomePill>
          </div>
        </div>

        <div className="mt-3 w-full">
          <VArrow />
        </div>

        {/* LISTENING */}
        <StateNode
          icon={Radio}
          label="LISTENING"
          sublabel="7-second command window · voice or PIR accepted"
          color="listen"
          className="w-full"
        />

        {/* Exits from LISTENING */}
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1">
            <VArrow label='"Spray" or PIR ≥ 3 s' />
            <OutcomePill icon={CheckCircle2} color="green">→ ACTUATION</OutcomePill>
          </div>
          <div className="flex flex-col items-center gap-1">
            <VArrow label='"Stop" or 7 s timeout' />
            <OutcomePill icon={XCircle} color="red">→ IDLE (cancel)</OutcomePill>
          </div>
        </div>

        <div className="mt-3 w-full">
          <VArrow />
        </div>

        {/* ACTUATION */}
        <StateNode
          icon={Droplets}
          label="ACTUATION"
          sublabel="Atomizer ON · 5 s · trigger + duration logged to Firebase"
          color="actuate"
          className="w-full"
        />

        {/* Exits from ACTUATION */}
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1">
            <VArrow label="5 s elapsed" />
            <OutcomePill color="default">→ COOLDOWN</OutcomePill>
          </div>
          <div className="flex flex-col items-center gap-1">
            <VArrow label='"Stop" recognised' />
            <OutcomePill icon={XCircle} color="amber">early cancel → COOLDOWN</OutcomePill>
          </div>
        </div>

        <div className="mt-3 w-full">
          <VArrow />
        </div>

        {/* COOLDOWN */}
        <StateNode
          icon={Clock}
          label="COOLDOWN"
          sublabel="20 s (TEST_MODE) · 3 min (production) · spray locked out"
          color="cooldown"
          className="w-full"
        />

        <VArrow label="timer elapsed" />

        {/* Back to IDLE */}
        <div className="flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-4 py-2 dark:border-teal-500/30 dark:bg-teal-950/40">
          <Zap className="h-4 w-4 text-teal-700 dark:text-teal-300" strokeWidth={2.25} />
          <span className="text-[12px] font-semibold text-teal-800 dark:text-teal-200">
            → IDLE · ready for next trigger
          </span>
        </div>

      </div>
    </figure>
  )
}
