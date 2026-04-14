# AuraSync — TECHIN 515 Team 6 Devlog

A weekly engineering devlog for **AuraSync**, a context-aware scent diffuser built for MSTI Hardware–Software Lab II (TECHIN 515). The site documents hardware decisions, firmware milestones, CAD iterations, and ML experiments across each week of the project.

Live site: [https://tongsue.github.io/TECHIN-515-Team6/](https://tongsue.github.io/TECHIN-515-Team6/)

---

## Team

| Member | GitHub | Primary focus |
|--------|--------|---------------|
| Yutong Luo | [@TongSUE](https://github.com/TongSUE) | Firmware, schematic, user flow, devlog site |
| Lucia Shen | [@xtshen777](https://github.com/xtshen777) | Hardware, CAD, ML research, procurement |

---

## Project Overview

AuraSync senses bathroom context — shower steam, ambient odor, grooming activity — through a **XIAO ESP32-S3** fusing data from a **BME680** environmental sensor and an **INMP441** I²S microphone. An on-device Edge ML model classifies the scenario and triggers an ultrasonic atomizer to dispense fragrance at the right moment, then enforces a VOC-feedback cooldown to prevent over-saturation.

**Hardware stack:** XIAO ESP32-S3 · BME680 · INMP441 · MT3608 boost · N-channel MOSFET driver · Ultrasonic atomizer · LiPo 3.7 V

---

## Devlog Site

Built with **React 19 + Vite 8 + Tailwind CSS 4**. Each week is a Markdown file (`src/content/devlog/week-NN.md`) with YAML front matter. The site is deployed to GitHub Pages via the Actions workflow in `.github/workflows/`.

### Local development

```bash
npm install
npm run dev        # http://localhost:5173
```

### Build & deploy

```bash
npm run build      # outputs to dist/
```

The GitHub Actions workflow auto-deploys on every push to `main`.

### Key libraries

| Library | Purpose |
|---------|---------|
| `react-markdown` + `remark-gfm` | Render `.md` files with GFM tables, task lists |
| `remark-math` + `rehype-katex` | LaTeX math rendering |
| `rehype-highlight` | Code syntax highlighting (highlight.js) |
| `rehype-raw` | Allow raw HTML embeds in Markdown |
| `framer-motion` | Page and list animations |
| `react-router-dom` (HashRouter) | Client-side routing on GitHub Pages |

---

## Repository Structure

```
web-devlog/
├── public/
│   └── images/devlog/          # Schematic, CAD, and figure assets
├── src/
│   ├── components/             # React UI components
│   ├── content/devlog/         # Weekly .md files (week-01.md, week-02.md, …)
│   ├── pages/                  # DevlogWeekPage, HomePage
│   └── utils/                  # loadDevlog.js, devlogDocUtils.js
└── .github/workflows/          # GitHub Pages deploy workflow
```

---

MSTI Hardware–Software Lab II · Spring 2026
