import { ChevronDown, ChevronRight, Mic, Radio, Clock, CheckCircle2, XCircle } from 'lucide-react'

function StateNode({ icon: Icon, label, sublabel, color = 'default', className = '' }) {
  const colors = {
    idle:      'border-teal-300/80 bg-gradient-to-br from-teal-50/95 to-white shadow-lg ring-2 ring-teal-400/40 dark:border-teal-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-teal-500/35',
    listening: 'border-violet-300/80 bg-gradient-to-br from-violet-50/90 to-white shadow-lg ring-2 ring-violet-400/35 dark:border-violet-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-violet-500/30',
    default:   'border-slate-200/90 bg-white/90 shadow-md ring-1 ring-slate-200/60 dark:border-slate-600/80 dark:bg-slate-800/80',
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
        <span className="max-w-[16rem] text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">{label}</span>
      )}
      <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
    </div>
  )
}

export default function WakeWordStateMachineDiagram() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="Wake-word state machine diagram"
    >
      <figcaption className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          Voice Recognition
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          Wake-word state machine — ESP-SR MultiNet v7
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          Two-stage design: "Aura" gates a 7-second command window.
          Commands outside the window are silently discarded.
        </p>
      </figcaption>

      <div className="mx-auto flex max-w-sm flex-col items-center">
        {/* SYS_IDLE */}
        <StateNode
          icon={Mic}
          label="SYS_IDLE"
          sublabel="Waiting for wake word"
          color="idle"
          className="w-full"
        />

        <VArrow label='MultiNet detects "Aura"' />

        {/* SYS_LISTENING */}
        <StateNode
          icon={Radio}
          label="SYS_LISTENING"
          sublabel="7-second command window open"
          color="listening"
          className="w-full"
        />

        <VArrow />

        {/* Two outcome branches */}
        <div className="grid w-full grid-cols-2 gap-3">
          {/* Detected */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex w-full items-center gap-2 rounded-xl border border-teal-200/80 bg-teal-50/80 px-3 py-2.5 dark:border-teal-500/30 dark:bg-teal-950/30">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" strokeWidth={2.25} aria-hidden />
              <div>
                <p className="text-[11px] font-semibold text-teal-800 dark:text-teal-200">
                  "Spray" or "Stop"
                </p>
                <p className="text-[10px] text-teal-700/70 dark:text-teal-300/70">
                  detected → execute → SYS_IDLE
                </p>
              </div>
            </div>
          </div>
          {/* Timeout */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
              <Clock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" strokeWidth={2.25} aria-hidden />
              <div>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  7 s timeout
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  no command → SYS_IDLE
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* No-threshold note */}
        <div className="mt-6 flex w-full items-start gap-2.5 rounded-xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 dark:border-sky-500/25 dark:bg-sky-950/30">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2.25} aria-hidden />
          <div>
            <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-200">
              No confidence threshold
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-sky-700/80 dark:text-sky-300/70">
              MultiNet fires on <code className="rounded bg-sky-100 px-1 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">ESP_MN_STATE_DETECTED</code> — the model's
              internal beam search handles confidence internally. Commands are accepted or
              rejected, not filtered by a probability score.
            </p>
          </div>
        </div>
      </div>
    </figure>
  )
}
