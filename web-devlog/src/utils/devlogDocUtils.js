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
    if (/^##\s+Executive Summary\s*$/i.test(lines[i].trim())) {
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
