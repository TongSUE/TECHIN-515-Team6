import YAML from 'yaml'
import devlogData from '../data/devlog.json'

const mdModules = import.meta.glob('../content/devlog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

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

function weeksFromMarkdown() {
  const rows = []
  for (const path of Object.keys(mdModules)) {
    const raw = mdModules[path]
    const { data, content } = parseFrontmatter(raw)
    const week = Number(data.week)
    if (!Number.isFinite(week)) continue
    rows.push({
      week,
      date: data.date ?? undefined,
      title: data.title ?? 'Untitled week',
      status: data.status ?? 'Testing',
      summary: buildCardSummary(data, content),
      body: content,
      images: Array.isArray(data.images) ? data.images : [],
      credits: normalizeCredits(data.credits),
    })
  }
  return rows.sort((a, b) => b.week - a.week)
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
    }
  })
}

/**
 * Merge `src/content/devlog/*.md` with `src/data/devlog.json` → `weeks`.
 * If the same `week` exists in both, the Markdown file wins.
 */
export function getDevlogWeeks() {
  const byWeek = new Map()
  for (const w of weeksFromJson()) {
    if (Number.isFinite(w.week)) byWeek.set(w.week, w)
  }
  for (const w of weeksFromMarkdown()) {
    if (Number.isFinite(w.week)) byWeek.set(w.week, w)
  }
  return Array.from(byWeek.values()).sort((a, b) => b.week - a.week)
}

export function getDevlogWeekByNumber(weekParam) {
  const n = Number(weekParam)
  if (!Number.isFinite(n)) return null
  return getDevlogWeeks().find((w) => w.week === n) ?? null
}

export function getGithubRepoUrl() {
  return devlogData.githubRepo ?? '#'
}
