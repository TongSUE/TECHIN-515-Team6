import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages (subfolder) deployment:
 * 1. In the repo Settings → Pages, point the site to the `web-devlog/dist` output
 *    (or publish the `dist` folder via gh-pages).
 * 2. If the site URL is `https://<user>.github.io/<repo>/web-devlog/`, set `base`
 *    to `/<repo>/web-devlog/`.
 *
 * Recommended: create `web-devlog/.env.production` with:
 *   VITE_BASE_PATH=/your-repo-name/web-devlog/
 * (leading and trailing slashes; local `npm run dev` keeps base `/` unless you set the variable.)
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const baseRaw = env.VITE_BASE_PATH ?? '/'
  const base = baseRaw.endsWith('/') ? baseRaw : `${baseRaw}/`

  return {
    plugins: [react()],
    base,
  }
})
