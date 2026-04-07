/**
 * Resolves public asset paths for Vite `base` (e.g. GitHub Pages subfolder).
 */
export function resolveAssetUrl(src) {
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  const base = import.meta.env.BASE_URL || '/'
  const path = src.startsWith('/') ? src.slice(1) : src
  return `${base}${path}`
}
