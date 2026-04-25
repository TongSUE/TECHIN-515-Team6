import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mic,
  Moon,
  Smartphone,
  Wind,
  XCircle,
  Zap,
} from 'lucide-react'

function Badge({ children, color = 'default' }) {
  const colors = {
    green:  'bg-teal-100/80 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    red:    'bg-rose-100/80 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    amber:  'bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    default:'bg-slate-100/80 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[color]}`}>
      {children}
    </span>
  )
}

function PropertyRow({ icon: Icon, label, value, ok }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100/80 bg-slate-50/80 px-2.5 py-1.5 dark:border-slate-700/60 dark:bg-slate-800/60">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" strokeWidth={2} aria-hidden />
        <span className="text-[11px] font-medium text-ink-soft dark:text-slate-400">{label}</span>
      </div>
      {ok === true  && <Badge color="green"><CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />Yes</Badge>}
      {ok === false && <Badge color="red"><XCircle className="h-2.5 w-2.5" strokeWidth={2.5} />No</Badge>}
      {ok === 'queue' && <Badge color="amber"><Clock className="h-2.5 w-2.5" strokeWidth={2.5} />Queued</Badge>}
    </div>
  )
}

function PriorityCard({ rank, accentColor, icon: Icon, title, triggers, properties, outcome, outcomeColor }) {
  const borders = {
    teal:   'border-teal-200/80 dark:border-teal-500/30',
    amber:  'border-amber-200/80 dark:border-amber-500/30',
    sky:    'border-sky-200/80 dark:border-sky-500/30',
  }
  const headerBgs = {
    teal:   'bg-gradient-to-r from-teal-500 to-teal-400',
    amber:  'bg-gradient-to-r from-amber-500 to-amber-400',
    sky:    'bg-gradient-to-r from-sky-500 to-sky-400',
  }
  const outcomeBorders = {
    green:  'border-teal-200/80 bg-teal-50/80 text-teal-800 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-200',
    amber:  'border-amber-200/80 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200',
    red:    'border-rose-200/80 bg-rose-50/80 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200',
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border shadow-md ${borders[accentColor]}`}>
      {/* Header bar */}
      <div className={`${headerBgs[accentColor]} px-4 py-2.5 text-white`}>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black tracking-widest">
            {rank}
          </span>
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          <span className="text-[13px] font-bold">{title}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 bg-white/90 p-4 dark:bg-slate-800/80">
        {/* Triggers */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-slate-500">
            Trigger conditions
          </p>
          <ul className="space-y-1">
            {triggers.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-ink dark:text-slate-300">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Properties */}
        <div className="space-y-1.5">
          {properties.map((p, i) => (
            <PropertyRow key={i} icon={p.icon} label={p.label} ok={p.ok} />
          ))}
        </div>

        {/* Outcome */}
        <div className={`mt-auto rounded-xl border px-3 py-2 text-center text-[11px] font-semibold ${outcomeBorders[outcomeColor]}`}>
          {outcome}
        </div>
      </div>
    </div>
  )
}

export default function TriggerPriorityDiagram() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="Trigger priority diagram"
    >
      <figcaption className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Architecture · Trigger Model
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          Four-priority trigger hierarchy
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          Higher priority sources can override lower ones, bypass the cooldown, and fire
          regardless of system sleep mode. Lower priorities respect the shared cooldown timer.
        </p>
      </figcaption>

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <PriorityCard
          rank="P1"
          accentColor="teal"
          icon={Mic}
          title="Voice / App"
          triggers={[
            '"Aura" + "Spray" (ESP-SR wake word)',
            'Firebase /commands/action (app write)',
          ]}
          properties={[
            { icon: Moon,         label: 'Works in SLEEP',   ok: true },
            { icon: Clock,        label: 'Bypass cooldown',  ok: true },
            { icon: Zap,          label: 'Wakes system',     ok: true },
          ]}
          outcome="→ Spray immediately"
          outcomeColor="green"
        />

        <PriorityCard
          rank="P2"
          accentColor="amber"
          icon={Wind}
          title="Extreme Odour"
          triggers={[
            'BME680 gas resistance < 10 kΩ',
            'Fires regardless of presence',
          ]}
          properties={[
            { icon: Moon,         label: 'Works in SLEEP',   ok: true },
            { icon: Clock,        label: 'Bypass cooldown',  ok: 'queue' },
            { icon: Zap,          label: 'Wakes system',     ok: true },
          ]}
          outcome="→ Spray (or queue if in CD)"
          outcomeColor="amber"
        />

        <PriorityCard
          rank="P3"
          accentColor="sky"
          icon={AlertTriangle}
          title="PIR + VOC Peak"
          triggers={[
            'PIR HIGH within last 5 s',
            'VOC inflection: 3 rising + 1 recovering sample',
          ]}
          properties={[
            { icon: Moon,         label: 'Works in SLEEP',   ok: false },
            { icon: Clock,        label: 'Bypass cooldown',  ok: false },
            { icon: Smartphone,   label: 'AWAKE + IDLE only', ok: true },
          ]}
          outcome="→ Spray (if AWAKE + IDLE)"
          outcomeColor="green"
        />
      </div>

      {/* Legend */}
      <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-soft dark:text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" strokeWidth={2.5} />
          Permitted / active
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-soft dark:text-slate-400">
          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
          Deferred until cooldown expires
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-soft dark:text-slate-400">
          <XCircle className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" strokeWidth={2.5} />
          Blocked / not applicable
        </div>
      </div>
    </figure>
  )
}
