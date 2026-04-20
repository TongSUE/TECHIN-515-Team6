import YAML from 'yaml'
import devlogData from '../data/devlog.json'

const mdModules = import.meta.glob('../content/devlog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

// Pre-build a set of week numbers that have a .zh.md file, for fallback logic
const zhPaths = new Set(
  Object.keys(mdModules).filter((p) => p.endsWith('.zh.md')),
)

function parseFrontmatter(raw) {
  const text = typeof raw === 'string' ? raw : ''
  if (!text.startsWith('---')) {
    return { data: {}, content: text.trim() }
  }
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') {
    return { data: {}, content: text.trim() }
  }
  const end = lines.findIndex((line, i) => i > 0 && line === '---')
  if (end === -1) {
    return { data: {}, content: text.trim() }
  }
  const fmBlock = lines.slice(1, end).join('\n')
  const content = lines.slice(end + 1).join('\n').trim()
  let data = {}
  try {
    data = YAML.parse(fmBlock) || {}
  } catch {
    data = {}
  }
  return { data, content }
}

function stripMdRoughly(s) {
  return s
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/`+/g, '')
    .trim()
}

function firstParagraphFromMarkdown(text) {
  const stripped = stripMdRoughly(text)
  const paras = stripped
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const first = paras[0] || stripped
  if (first.length > 280) return `${first.slice(0, 277)}…`
  return first
}

function buildCardSummary(data, bodyMarkdown) {
  const s = data.summary
  if (typeof s === 'string' && s.trim()) return s.trim()
  if (bodyMarkdown.trim()) return firstParagraphFromMarkdown(bodyMarkdown)
  return '[Summary placeholder]'
}

function normalizePlannedNext(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item, i) => {
    if (typeof item === 'string') {
      const label = item.trim() || 'Task'
      const id = label
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      return {
        id: id || `task-${i}`,
        label,
        description: undefined,
      }
    }
    if (item && typeof item === 'object') {
      const label = String(item.label ?? item.title ?? 'Task').trim()
      let id
      if (item.id != null && String(item.id).trim()) {
        id = String(item.id).trim()
      } else {
        id =
          label
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') || `task-${i}`
      }
      const description =
        typeof item.description === 'string' ? item.description.trim() : undefined
      return { id, label: label || 'Task', description }
    }
    return { id: `task-${i}`, label: 'Task', description: undefined }
  })
}

function normalizePriorProgress(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    // Support three states: true (done), false (not done), 'partial' (in-progress)
    if (v === 'partial' || v === 'in-progress') {
      out[String(k)] = 'partial'
    } else {
      out[String(k)] = Boolean(v)
    }
  }
  return out
}

function normalizeCredits(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') {
      const name = item.trim() || 'Contributor'
      return {
        name,
        initials: name.slice(0, 1).toUpperCase(),
        role: undefined,
      }
    }
    if (item && typeof item === 'object') {
      const name = String(item.name ?? item.id ?? 'Contributor').trim()
      const initialsRaw = item.initials ?? name.slice(0, 1)
      const initials = String(initialsRaw).toUpperCase().slice(0, 3)
      const role = item.role ?? item.tag ?? undefined
      const tags = Array.isArray(item.tags)
        ? item.tags.map((t) => String(t).trim()).filter(Boolean)
        : undefined
      return { name, initials, role, tags }
    }
    return { name: 'Contributor', initials: '?', role: undefined }
  })
}

function buildWeekEntry(data, content) {
  return {
    week: Number(data.week),
    date: data.date ?? undefined,
    title: data.title ?? 'Untitled week',
    status: data.status ?? 'Testing',
    summary: buildCardSummary(data, content),
    body: content,
    images: Array.isArray(data.images) ? data.images : [],
    credits: normalizeCredits(data.credits),
    plannedNext: normalizePlannedNext(data.planned_next),
    priorWeekProgress: normalizePriorProgress(data.prior_week_progress),
    showNextSteps: data.show_next_steps !== false,
  }
}

function weeksFromMarkdown(locale = 'en') {
  // Use a Map so zh entries can override en entries for the same week number
  const byWeek = new Map()
  for (const [path, raw] of Object.entries(mdModules)) {
    const isZh = path.endsWith('.zh.md')
    const { data, content } = parseFrontmatter(raw)
    const week = Number(data.week)
    if (!Number.isFinite(week)) continue

    if (locale === 'en') {
      // English mode: skip .zh.md files entirely
      if (isZh) continue
      byWeek.set(week, buildWeekEntry(data, content))
    } else {
      // Chinese mode: add English entry first (lower priority)
      if (!isZh) byWeek.set(week, buildWeekEntry(data, content))
      // Override with zh entry if it exists (higher priority)
      if (isZh) byWeek.set(week, buildWeekEntry(data, content))
    }
  }
  return Array.from(byWeek.values()).sort((a, b) => b.week - a.week)
}

function weeksFromJson() {
  const weeks = Array.isArray(devlogData.weeks) ? devlogData.weeks : []
  return weeks.map((entry) => {
    const week = Number(entry.week)
    const body = typeof entry.body === 'string' ? entry.body : ''
    const summaryField =
      typeof entry.summary === 'string' && entry.summary.trim()
        ? entry.summary.trim()
        : ''
    const summary = summaryField || firstParagraphFromMarkdown(body) || '[Summary placeholder]'
    return {
      week,
      date: entry.date,
      title: entry.title ?? 'Untitled week',
      status: entry.status ?? 'Testing',
      summary,
      body,
      images: Array.isArray(entry.images) ? entry.images : [],
      credits: normalizeCredits(entry.credits),
      plannedNext: normalizePlannedNext(entry.planned_next),
      priorWeekProgress: normalizePriorProgress(entry.prior_week_progress),
    }
  })
}

/**
 * Merge `src/content/devlog/*.md` with `src/data/devlog.json` → `weeks`.
 * If the same `week` exists in both, the Markdown file wins.
 * Pass `locale='zh'` to prefer .zh.md files (falling back to .md).
 */
export function getDevlogWeeks(locale = 'en') {
  const byWeek = new Map()
  for (const w of weeksFromJson()) {
    if (Number.isFinite(w.week)) byWeek.set(w.week, w)
  }
  for (const w of weeksFromMarkdown(locale)) {
    if (Number.isFinite(w.week)) byWeek.set(w.week, w)
  }
  return Array.from(byWeek.values()).sort((a, b) => b.week - a.week)
}

export function getDevlogWeekByNumber(weekParam, locale = 'en') {
  const n = Number(weekParam)
  if (!Number.isFinite(n)) return null
  return getDevlogWeeks(locale).find((w) => w.week === n) ?? null
}

export function getGithubRepoUrl() {
  return devlogData.githubRepo ?? '#'
}

/**
 * For week W (W > 1): tasks promised in week W-1 (`planned_next`), with `done`
 * merged from week W's `prior_week_progress` map (id -> boolean).
 */
export function getCarryoverTasksForWeek(weekNum, allWeeks) {
  if (!Number.isFinite(weekNum) || weekNum <= 1) return null
  const prev = allWeeks.find((w) => w.week === weekNum - 1)
  if (!prev?.plannedNext?.length) return null
  const current = allWeeks.find((w) => w.week === weekNum)
  const progress = current?.priorWeekProgress ?? {}
  return {
    fromWeek: prev.week,
    currentWeek: weekNum,
    tasks: prev.plannedNext.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      // done: true = completed, 'partial' = in-progress, false = not started
      done: progress[t.id] ?? false,
    })),
  }
}
