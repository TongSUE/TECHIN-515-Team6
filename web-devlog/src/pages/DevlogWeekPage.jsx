import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DevlogCarryoverChecklist from '../components/DevlogCarryoverChecklist.jsx'
import DevlogCredits from '../components/DevlogCredits.jsx'
import DevlogMarkdownBody from '../components/DevlogMarkdownBody.jsx'
import DevlogToc from '../components/DevlogToc.jsx'
import MobileTocDrawer from '../components/MobileTocDrawer.jsx'
import ReadingProgress from '../components/ReadingProgress.jsx'
import {
  getCarryoverTasksForWeek,
  getDevlogWeekByNumber,
  getDevlogWeeks,
} from '../utils/loadDevlog.js'
import {
  buildDevlogWeekToc,
  splitExecutiveSummary,
  splitNextStepsBlock,
  splitNotesPanelBlock,
} from '../utils/devlogDocUtils.js'
import { resolveAssetUrl } from '../utils/resolveAssetUrl.js'

const statusStyles = {
  Blocking:
    'bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  Testing:
    'bg-blue-100 text-blue-900 ring-blue-200/80 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-500/30',
  'In Progress':
    'bg-blue-100 text-blue-900 ring-blue-200/80 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-500/30',
  Completed:
    'bg-teal-100 text-teal-900 ring-teal-200/80 dark:bg-teal-500/15 dark:text-teal-100 dark:ring-teal-500/30',
}

const defaultStatusClass =
  'bg-slate-100 text-slate-800 ring-slate-200/80 dark:bg-slate-700/40 dark:text-slate-100 dark:ring-slate-600/50'

function scrollToDevlogSection() {
  window.setTimeout(() => {
    document.getElementById('devlog')?.scrollIntoView({ behavior: 'smooth' })
  }, 80)
}

export default function DevlogWeekPage() {
  const { week } = useParams()
  const entry = getDevlogWeekByNumber(week)
  const carry = useMemo(() => {
    const n = Number(week)
    if (!Number.isFinite(n)) return null
    return getCarryoverTasksForWeek(n, getDevlogWeeks())
  }, [week])

  const { prevWeek, nextWeek } = useMemo(() => {
    const all = getDevlogWeeks()
    const n = entry?.week
    return {
      prevWeek: all.find((w) => w.week === n - 1) ?? null,
      nextWeek: all.find((w) => w.week === n + 1) ?? null,
    }
  }, [entry])

  const { tocItems, executiveBody, notesBody, notesPanelTitle, mainBody, nextStepsBody } = useMemo(() => {
    const body = entry?.body?.trim() ? entry.body : ''
    if (!body) {
      return {
        tocItems: [],
        executiveBody: null,
        notesBody: null,
        notesPanelTitle: null,
        mainBody: '',
        nextStepsBody: null,
      }
    }
    const { main: afterExec, executiveSummary } = splitExecutiveSummary(body)
    const { main: afterNotes, notesPanel, notesPanelTitle: panelTitle } = splitNotesPanelBlock(afterExec)
    const { main, nextSteps } = splitNextStepsBlock(afterNotes)
    const showNext = entry?.showNextSteps !== false
    return {
      tocItems: buildDevlogWeekToc({
        executiveBody: executiveSummary,
        notesBody: notesPanel,
        notesPanelTitle: panelTitle,
        mainBody: main,
        nextStepsBody: showNext ? nextSteps : null,
      }),
      executiveBody: executiveSummary,
      notesBody: notesPanel,
      notesPanelTitle: panelTitle,
      mainBody: main,
      nextStepsBody: showNext ? nextSteps : null,
    }
  }, [entry])

  if (!entry) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-28 sm:px-10">
        <p className="text-sm font-semibold text-accent dark:text-accent-mint">
          Devlog
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-slate-50">
          Week not found
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          There is no entry for week {week}. Return to the timeline and pick
          another card.
        </p>
        <Link
          to="/"
          onClick={scrollToDevlogSection}
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Back to timeline
        </Link>
      </div>
    )
  }

  const [tocDrawerOpen, setTocDrawerOpen] = useState(false)

  const status = entry.status
  const statusClass =
    status && status in statusStyles ? statusStyles[status] : defaultStatusClass
  const hasBody = typeof entry.body === 'string' && entry.body.trim().length > 0
  const hasMain = mainBody.trim().length > 0
  const hasExecutive = Boolean(executiveBody?.trim())
  const hasNotes = Boolean(notesBody?.trim())
  const notesPanelLabel = notesPanelTitle ?? 'Pre-Flight Q\u0026A'

  return (
    <div className="border-b border-slate-200/70 bg-slate-50/80 px-6 py-24 dark:border-slate-800 dark:bg-slate-900/40 sm:px-10">
      <ReadingProgress visible={hasBody} />
      <article className="mx-auto max-w-[72rem]">
        <Link
          to="/"
          onClick={scrollToDevlogSection}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent transition hover:text-accent/80 dark:text-accent-mint dark:hover:text-accent-mint/85"
        >
          ← Back to timeline
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-900/5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:bg-white/10 dark:text-slate-300">
            Week {entry.week}
            {entry.date ? ` · ${entry.date}` : ''}
          </span>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusClass}`}
          >
            {status || 'Testing'}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink dark:text-slate-50 sm:text-4xl">
          {entry.title}
        </h1>

        <p className="mt-4 max-w-[52rem] text-base leading-relaxed text-ink-soft sm:text-lg">
          {entry.summary}
        </p>

        {carry ? (
          <div className="mt-6 max-w-[52rem]">
            <DevlogCarryoverChecklist
              fromWeek={carry.fromWeek}
              currentWeek={carry.currentWeek}
              tasks={carry.tasks}
            />
          </div>
        ) : null}

        {entry.credits?.length ? (
          <div className="mt-6 max-w-[52rem]">
            <DevlogCredits credits={entry.credits} />
          </div>
        ) : null}

        {hasBody ? (
          <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] xl:gap-12">
            <aside className="mb-8 min-w-0 lg:sticky lg:top-28 lg:mb-0">
              <DevlogToc items={tocItems} />
            </aside>

            <div className="min-w-0 space-y-8">
              {hasNotes ? (
                <section
                  id="notes-panel"
                  aria-label="Pre-Flight Q&A"
                  className="scroll-mt-28 rounded-2xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-50/95 via-white to-yellow-50/90 p-6 shadow-glass-lg dark:border-amber-500/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 sm:p-8"
                >
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
                    Notes · {notesPanelLabel}
                  </p>
                  <DevlogMarkdownBody markdown={notesBody} />
                </section>
              ) : null}

              {hasExecutive ? (
                <section
                  id="executive-summary-panel"
                  aria-label="Executive summary"
                  className="scroll-mt-28 rounded-2xl border-2 border-sky-400/50 bg-gradient-to-br from-sky-50/95 via-white to-indigo-50/80 p-6 shadow-glass-lg dark:border-sky-500/35 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 sm:p-8"
                >
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-800 dark:text-sky-300">
                    Opening · Executive summary
                  </p>
                  <DevlogMarkdownBody markdown={executiveBody} />
                </section>
              ) : null}

              {hasMain ? (
                <div
                  className="glass-panel rounded-2xl p-6 sm:p-10"
                  id="week-main-body"
                >
                  <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft dark:text-slate-400">
                    Main notes
                  </p>
                  <DevlogMarkdownBody markdown={mainBody} />
                </div>
              ) : null}

              {nextStepsBody ? (
                <section
                  id="next-steps-panel"
                  aria-label="Next steps"
                  className="scroll-mt-28 rounded-2xl border-2 border-teal-400/55 bg-gradient-to-br from-teal-50/95 via-white to-sky-50/90 p-6 shadow-glass-lg dark:border-teal-500/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 sm:p-8"
                >
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-accent-mint">
                    Closing · Next steps
                  </p>
                  <DevlogMarkdownBody
                    markdown={nextStepsBody}
                    variant="nextSteps"
                  />
                </section>
              ) : null}

              {Array.isArray(entry.images) && entry.images.length > 0 ? (
                <div className="glass-panel rounded-2xl p-6 sm:p-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                    Figures
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {entry.images.map((img, i) => (
                      <figure
                        key={`${entry.week}-fig-${i}`}
                        className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700 dark:bg-slate-900/50"
                      >
                        <img
                          src={resolveAssetUrl(img.src)}
                          alt={
                            img.caption || `Week ${entry.week} figure ${i + 1}`
                          }
                          className="aspect-[16/10] w-full object-cover"
                          loading="lazy"
                        />
                        {img.caption ? (
                          <figcaption className="border-t border-slate-200/70 px-3 py-2 text-xs text-ink-soft dark:border-slate-700">
                            {img.caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="glass-panel mt-10 rounded-2xl p-6 sm:p-10">
            <p className="text-sm leading-relaxed text-ink-soft">
              No full Markdown body is defined for this week yet. Add content
              below the front matter in the weekly{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                .md
              </code>{' '}
              file, or set a{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                body
              </code>{' '}
              field in{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                devlog.json
              </code>
              .
            </p>
          </div>
        )}
        {(prevWeek || nextWeek) && (
          <nav
            aria-label="Week navigation"
            className="mt-14 flex items-stretch justify-between gap-4"
          >
            {prevWeek ? (
              <Link
                to={`/devlog/${prevWeek.week}`}
                className="glass-panel flex min-w-0 flex-1 flex-col gap-1 rounded-2xl px-5 py-4 transition hover:border-accent/40 dark:hover:border-accent-mint/40"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft dark:text-slate-400">
                  ← Previous
                </span>
                <span className="truncate text-sm font-medium text-ink dark:text-slate-100">
                  Week {prevWeek.week} · {prevWeek.title}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            {nextWeek ? (
              <Link
                to={`/devlog/${nextWeek.week}`}
                className="glass-panel flex min-w-0 flex-1 flex-col items-end gap-1 rounded-2xl px-5 py-4 text-right transition hover:border-accent/40 dark:hover:border-accent-mint/40"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft dark:text-slate-400">
                  Next →
                </span>
                <span className="truncate text-sm font-medium text-ink dark:text-slate-100">
                  Week {nextWeek.week} · {nextWeek.title}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </nav>
        )}
      </article>

      {/* Mobile TOC floating button — hidden on lg+ where sidebar is visible */}
      {hasBody && tocItems.length > 0 && (
        <button
          onClick={() => setTocDrawerOpen(true)}
          aria-label="Open table of contents"
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 lg:hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <MobileTocDrawer
        items={tocItems}
        open={tocDrawerOpen}
        onClose={() => setTocDrawerOpen(false)}
      />
    </div>
  )
}
