import {
  ArrowLeftRight,
  BatteryLow,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
} from 'lucide-react'

function LayerHeader({ label, sublabel, color = 'default' }) {
  const colors = {
    blue:  'bg-sky-50/90 border-sky-200/80 dark:bg-sky-950/40 dark:border-sky-500/30',
    teal:  'bg-teal-50/90 border-teal-200/80 dark:bg-teal-950/40 dark:border-teal-500/30',
    default: 'bg-slate-50/90 border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-600/60',
  }
  const textColors = {
    blue:  'text-sky-700 dark:text-sky-300',
    teal:  'text-teal-700 dark:text-teal-300',
    default: 'text-slate-600 dark:text-slate-300',
  }
  return (
    <div className={`mb-4 rounded-xl border px-4 py-2 text-center ${colors[color]}`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${textColors[color]}`}>{label}</p>
      {sublabel && (
        <p className="mt-0.5 text-[10px] text-ink-soft dark:text-slate-500">{sublabel}</p>
      )}
    </div>
  )
}

function StateNode({ icon: Icon, label, sublabel, color = 'default', className = '' }) {
  const colors = {
    sleep:    'border-slate-300/80 bg-slate-100/90 shadow-sm ring-1 ring-slate-300/50 dark:border-slate-500/60 dark:bg-slate-800/80 dark:ring-slate-500/40',
    awake:    'border-sky-300/80 bg-gradient-to-br from-sky-50 to-white shadow-lg ring-2 ring-sky-400/35 dark:border-sky-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-sky-500/30',
    idle:     'border-teal-300/80 bg-gradient-to-br from-teal-50/95 to-white shadow-lg ring-2 ring-teal-400/40 dark:border-teal-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-teal-500/35',
    spray:    'border-indigo-300/80 bg-gradient-to-br from-indigo-50/90 to-white shadow-lg ring-2 ring-indigo-400/35 dark:border-indigo-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-indigo-500/30',
    cooldown: 'border-amber-300/70 bg-gradient-to-br from-amber-50/90 to-white shadow-md ring-2 ring-amber-400/30 dark:border-amber-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-amber-500/25',
    default:  'border-slate-200/90 bg-white/90 shadow-md ring-1 ring-slate-200/60 dark:border-slate-600/80 dark:bg-slate-800/80',
  }
  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-center ${colors[color] ?? colors.default} ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-200">
        <Icon className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden />
      </span>
      <div>
        <p className="text-[13px] font-bold leading-tight text-ink dark:text-slate-100">{label}</p>
        {sublabel && (
          <p className="mt-0.5 text-[10px] leading-snug text-ink-soft dark:text-slate-400">{sublabel}</p>
        )}
      </div>
    </div>
  )
}

function HArrow({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-slate-500" aria-hidden>
      <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      {label && (
        <span className="text-center text-[9px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500 max-w-[5rem]">
          {label}
        </span>
      )}
    </div>
  )
}

function VArrow({ label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-0.5 text-slate-400 dark:text-slate-500" aria-hidden>
      {label && (
        <span className="max-w-[12rem] text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">
          {label}
        </span>
      )}
      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
    </div>
  )
}

export default function TwoLayerStateMachineDiagram() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="AuraSync two-layer state machine diagram"
    >
      <figcaption className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Architecture · State Machine
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          Two-layer state machine — System Mode × Spray State
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          Layer 1 (PIR-driven presence) gates power and polling rate. Layer 2 (spray control)
          shares one absolute cooldown across all trigger sources.
        </p>
      </figcaption>

      <div className="mx-auto max-w-2xl space-y-6">

        {/* ── Layer 1 ── */}
        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/40 p-5 dark:border-sky-500/25 dark:bg-sky-950/20">
          <LayerHeader
            label="Layer 1 · System Mode"
            sublabel="PIR-driven presence awareness — controls power profile"
            color="blue"
          />

          <div className="flex items-stretch justify-center gap-3">
            {/* SLEEP */}
            <StateNode
              icon={EyeOff}
              label="MODE_SLEEP"
              sublabel={<>BME680 every 30 s<br />Core 0 at 12 Hz<br />WiFi modem sleep</>}
              color="sleep"
              className="flex-1"
            />

            {/* Bidirectional arrows */}
            <div className="flex flex-col items-center justify-center gap-2 px-1">
              <div className="flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                <ArrowLeftRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="flex flex-col gap-1 text-center">
                <span className="rounded-full bg-sky-100/80 px-2 py-0.5 text-[9px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  PIR detected →
                </span>
                <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
                  ← 60 s no PIR
                </span>
              </div>
            </div>

            {/* AWAKE */}
            <StateNode
              icon={Eye}
              label="MODE_AWAKE"
              sublabel={<>BME680 every 3 s<br />Core 0 full rate<br />P3 trigger active</>}
              color="awake"
              className="flex-1"
            />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200/60 bg-white/70 px-3 py-2.5 dark:border-sky-500/20 dark:bg-slate-900/40">
            <BatteryLow className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2.25} aria-hidden />
            <p className="text-[11px] leading-snug text-ink-soft dark:text-slate-400">
              In SLEEP, voice recognition (Core 1, I2S) stays fully active — wake-word detection is
              unaffected by the power throttle.
            </p>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" aria-hidden />
          <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Layer 1 × Layer 2 interaction
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" aria-hidden />
        </div>

        {/* ── Layer 2 ── */}
        <div className="rounded-2xl border border-teal-200/70 bg-teal-50/30 p-5 dark:border-teal-500/25 dark:bg-teal-950/15">
          <LayerHeader
            label="Layer 2 · Spray State"
            sublabel="Shared absolute cooldown — all trigger sources respect the same timer"
            color="teal"
          />

          <div className="flex items-center justify-center gap-2">
            {/* IDLE */}
            <StateNode
              icon={RefreshCw}
              label="SPRAY_IDLE"
              sublabel="Waiting for P1/P2/P3 trigger"
              color="idle"
              className="flex-1 max-w-[10rem]"
            />

            <HArrow label="trigger fires" />

            {/* SPRAYING */}
            <StateNode
              icon={Droplets}
              label="SPRAY_SPRAYING"
              sublabel="Atomizer ON · 5 s"
              color="spray"
              className="flex-1 max-w-[10rem]"
            />

            <HArrow label="5 s / Stop" />

            {/* COOLDOWN */}
            <StateNode
              icon={Clock}
              label="SPRAY_COOLDOWN"
              sublabel="20 s test · 3 min prod"
              color="cooldown"
              className="flex-1 max-w-[10rem]"
            />
          </div>

          <div className="mt-3 flex justify-center">
            <VArrow label="elapsed" />
          </div>
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-4 py-2 dark:border-teal-500/30 dark:bg-teal-950/40">
              <Zap className="h-4 w-4 text-teal-700 dark:text-teal-300" strokeWidth={2.25} />
              <span className="text-[12px] font-semibold text-teal-800 dark:text-teal-200">
                → SPRAY_IDLE · ready
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-teal-200/60 bg-white/70 px-3 py-2.5 dark:border-teal-500/20 dark:bg-slate-900/40">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" strokeWidth={2.25} aria-hidden />
            <p className="text-[11px] leading-snug text-ink-soft dark:text-slate-400">
              Cooldown is absolute and shared. P1 (voice/app) can bypass it — P2 queues with
              <code className="mx-1 rounded bg-slate-100 px-1 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">p2Pending</code>
              and fires the moment it expires.
            </p>
          </div>
        </div>

      </div>
    </figure>
  )
}
