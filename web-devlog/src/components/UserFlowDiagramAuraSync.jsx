import {
  ArrowDown,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cpu,
  Droplets,
  Lock,
  Mic,
  Plug,
  Radio,
  RefreshCw,
  Settings2,
  Sparkles,
  Wifi,
} from 'lucide-react'

function FlowNode({
  icon: Icon,
  title,
  subtitle,
  variant = 'default',
  className = '',
}) {
  const variants = {
    default:
      'border-slate-200/90 bg-white/90 shadow-md ring-1 ring-slate-200/60 dark:border-slate-600/80 dark:bg-slate-800/80 dark:ring-slate-600/50',
    accent:
      'border-sky-300/80 bg-gradient-to-br from-sky-50 to-white shadow-lg ring-2 ring-sky-400/35 dark:border-sky-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-sky-500/30',
    emphasis:
      'border-teal-300/80 bg-gradient-to-br from-teal-50/95 to-white shadow-lg ring-2 ring-teal-400/40 dark:border-teal-500/40 dark:from-slate-800 dark:to-slate-900 dark:ring-teal-500/35',
    muted:
      'border-slate-200/70 bg-slate-50/90 dark:border-slate-600/60 dark:bg-slate-900/60',
    cloud:
      'border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white ring-2 ring-violet-300/30 dark:border-violet-500/35 dark:from-slate-800 dark:to-slate-900 dark:ring-violet-500/25',
  }

  return (
    <div
      className={`flex min-w-[8.5rem] flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-center ${variants[variant] ?? variants.default} ${className}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-200">
        <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold leading-tight text-ink dark:text-slate-100">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-[11px] leading-snug text-ink-soft dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function VArrow({ label }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 py-1 text-slate-400 dark:text-slate-500"
      aria-hidden
    >
      {label ? (
        <span className="max-w-[12rem] text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft dark:text-slate-500">
          {label}
        </span>
      ) : null}
      <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
    </div>
  )
}

function HArrow() {
  return (
    <ChevronRight
      className="h-5 w-5 shrink-0 self-center text-slate-400 dark:text-slate-500"
      strokeWidth={2.5}
      aria-hidden
    />
  )
}

export default function UserFlowDiagramAuraSync() {
  return (
    <figure
      className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/80 p-6 shadow-glass dark:border-slate-600/70 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/90 sm:p-8"
      aria-label="AuraSync user flow diagram"
    >
      <figcaption className="mb-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent dark:text-accent-mint">
          User flow
        </span>
        <p className="mt-2 text-sm font-medium text-ink dark:text-slate-200">
          Medium-fidelity journey map
        </p>
        <p className="mx-auto mt-1 max-w-xl text-xs text-ink-soft dark:text-slate-400">
          Onboarding → baseline → idle loop with ML and manual paths → actuation →
          chemical cooldown → cloud telemetry.
        </p>
      </figcaption>

      <div className="mx-auto flex max-w-4xl flex-col items-center">
        {/* Phase 1 · Onboarding */}
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
          <FlowNode
            icon={Droplets}
            title="Reservoir"
            subtitle="Fill tank"
            variant="muted"
            className="min-w-[7rem] flex-1 sm:flex-none"
          />
          <HArrow />
          <FlowNode
            icon={Plug}
            title="Power on"
            subtitle="Device boot"
            variant="muted"
            className="min-w-[7rem] flex-1 sm:flex-none"
          />
          <HArrow />
          <FlowNode
            icon={Wifi}
            title="Provisioning"
            subtitle="Blynk / WiFi"
            variant="muted"
            className="min-w-[7rem] flex-1 sm:flex-none"
          />
        </div>

        <VArrow label="Onboarding" />

        <FlowNode
          icon={Settings2}
          title="Setup & baseline"
          subtitle="Cloud dashboard · env baseline · → Idle"
          variant="accent"
          className="w-full max-w-md"
        />

        <VArrow label="WiFi OK" />

        <FlowNode
          icon={Sparkles}
          title="Idle"
          subtitle="Sensors stream · 30s ML window · ready for triggers"
          variant="emphasis"
          className="w-full max-w-lg"
        />

        <VArrow label="Parallel triggers" />

        {/* ML vs Manual */}
        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <div className="flex flex-col items-center gap-2">
            <FlowNode
              icon={Cpu}
              title="Edge ML path"
              subtitle="BME680 + I2S · sliding window · intent"
              className="w-full"
            />
            <VArrow />
            <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-ink-soft dark:border-slate-600 dark:bg-slate-800/80">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              High confidence → spray
            </div>
          </div>

          <div className="hidden items-center justify-center md:flex">
            <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              or
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <FlowNode
              icon={Mic}
              title="Voice / button"
              subtitle='"Aura, fresh" · physical key'
              className="w-full"
            />
            <VArrow />
            <div className="flex flex-col gap-1 text-center text-[11px] text-ink-soft dark:text-slate-400">
              <span className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2 py-1 font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
                Idle → execute spray
              </span>
              <span className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-2 py-1 font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
                Cooldown → reject (LED/audio)
              </span>
            </div>
          </div>
        </div>

        <div className="py-2 md:hidden">
          <span className="mx-auto block w-fit rounded-full bg-slate-200/80 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            or
          </span>
        </div>

        <VArrow label="Converge" />

        <FlowNode
          icon={Droplets}
          title="Actuation"
          subtitle="Pump ~2s · VOC spike detected"
          variant="accent"
          className="w-full max-w-xs"
        />

        <VArrow label="Chemical feedback" />

        <FlowNode
          icon={Lock}
          title="Cooldown"
          subtitle="Block voice/button until VOC baseline"
          variant="default"
          className="w-full max-w-xs"
        />

        <div className="relative mt-2 flex w-full max-w-lg flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] font-medium text-ink-soft dark:text-slate-400">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              VOC baseline
            </div>
            <ArrowDown className="h-6 w-6 text-slate-400 dark:text-slate-500" aria-hidden />
            <span className="text-[10px] text-ink-soft dark:text-slate-500">
              back to Idle
            </span>
          </div>
          <div className="hidden h-px w-12 bg-slate-200 dark:bg-slate-600 sm:block" aria-hidden />
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] font-medium text-ink-soft dark:text-slate-400">
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
              Telemetry
            </div>
            <ArrowDown className="h-6 w-6 text-slate-400 dark:text-slate-500" aria-hidden />
          </div>
        </div>

        <FlowNode
          icon={Cloud}
          title="Cloud"
          subtitle="Usage · air quality · refill when low"
          variant="cloud"
          className="mt-2 w-full max-w-md"
        />
      </div>
    </figure>
  )
}
