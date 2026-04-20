import GithubSlugger from 'github-slugger'

/**
 * Plain label for TOC display (minimal Markdown stripping).
 */
function headingLineToPlain(raw) {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)]\([^)]*\)/g, '$1')
    .replace(/\[(.+?)]\[[^\]]*]/g, '$1')
    .trim()
}

/**
 * Builds TOC entries from raw Markdown (## and ### only).
 * Uses the same slug algorithm as `rehype-slug` / GitHub (via `github-slugger`).
 */
export function extractTocFromMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return []
  const slugger = new GithubSlugger()
  const items = []
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    const m = /^(#{2,3})\s+(.+)$/.exec(trimmed)
    if (!m) continue
    const level = m[1].length
    const text = headingLineToPlain(m[2])
    if (!text) continue
    const id = slugger.slug(text)
    items.push({ level, text, id })
  }
  return items
}

/**
 * Extracts `## Executive Summary` through the line before the next `##` (h2).
 */
export function splitExecutiveSummary(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { main: '', executiveSummary: null }
  }
  const lines = markdown.split(/\r?\n/)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+.*Executive Summary\s*$/i.test(lines[i].trim())) {
      start = i
      break
    }
  }
  if (start === -1) {
    return { main: markdown.trim(), executiveSummary: null }
  }
  let end = lines.length
  for (let j = start + 1; j < lines.length; j++) {
    if (/^##\s+/.test(lines[j].trim())) {
      end = j
      break
    }
  }
  const executiveSummary = lines.slice(start, end).join('\n').trim()
  const main = [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim()
  return { main, executiveSummary }
}

/**
 * Splits "Next steps" into a dedicated card: matches `## …` or `### …` when the
 * title contains "next step(s)" (case-insensitive).
 */
/**
 * Extracts `## Pre-Flight Q&A` (or any h2 matching /pre-?flight|pre.?flight.*q.?a/i) section.
 * Returns the section and removes it from main body.
 */
export function splitNotesPanelBlock(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { main: markdown?.trim() ?? '', notesPanel: null, notesPanelTitle: null }
  }
  const lines = markdown.split(/\r?\n/)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!/^##\s+/.test(t)) continue
    if (/pre[-\s]?flight/i.test(t) || /^##\s+notes?\b/i.test(t) || /mentor/i.test(t)) { start = i; break }
  }
  if (start === -1) {
    return { main: markdown.trim(), notesPanel: null, notesPanelTitle: null }
  }
  const notesPanelTitle = lines[start].replace(/^##\s+/, '').trim()
  let end = lines.length
  for (let j = start + 1; j < lines.length; j++) {
    if (/^##\s+/.test(lines[j].trim())) { end = j; break }
  }
  const notesPanel = lines.slice(start, end).join('\n').trim()
  const main = [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim()
  return { main, notesPanel, notesPanelTitle }
}

/**
 * TOC for the week page: bookend anchors (Opening / Notes / Main / Closing) plus ##/### from each region.
 */
export function buildDevlogWeekToc({
  executiveBody = '',
  notesBody = '',
  notesPanelTitle = '',
  mainBody = '',
  nextStepsBody = '',
} = {}) {
  const items = []
  const exec = typeof executiveBody === 'string' && executiveBody.trim()
  const notes = typeof notesBody === 'string' && notesBody.trim()
  const main = typeof mainBody === 'string' && mainBody.trim()
  const next = typeof nextStepsBody === 'string' && nextStepsBody.trim()

  if (notes) {
    const tocLabel = notesPanelTitle
      ? `Notes · ${notesPanelTitle}`
      : 'Notes · Pre-Flight Q&A'
    items.push({
      level: 2,
      text: tocLabel,
      id: 'notes-panel',
    })
    for (const t of extractTocFromMarkdown(notes)) {
      if (/pre-?flight/i.test(t.text)) continue // skip the section heading itself
      if (/^notes?\b/i.test(t.text) || /^mentor\b/i.test(t.text)) continue // skip section heading itself
      items.push(t)
    }
  }

  if (exec) {
    items.push({
      level: 2,
      text: 'Opening · Executive summary',
      id: 'executive-summary-panel',
    })
    for (const t of extractTocFromMarkdown(exec)) {
      if (/^executive summary$/i.test(t.text)) continue
      items.push(t)
    }
  }

  if (main) {
    items.push({ level: 2, text: 'Main notes', id: 'week-main-body' })
    items.push(...extractTocFromMarkdown(main))
  }

  if (next) {
    items.push({
      level: 2,
      text: 'Closing · Next steps',
      id: 'next-steps-panel',
    })
  }

  return items
}

export function splitNextStepsBlock(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { main: '', nextSteps: null }
  }
  const lines = markdown.split(/\r?\n/)
  let splitAt = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!/^#{2,3}\s+/i.test(t)) continue
    if (!/next\s+steps?/i.test(t)) continue
    splitAt = i
    break
  }
  if (splitAt === -1) {
    return { main: markdown.trim(), nextSteps: null }
  }
  const main = lines.slice(0, splitAt).join('\n').trimEnd()
  const nextSteps = lines.slice(splitAt).join('\n').trim()
  return { main, nextSteps }
}
