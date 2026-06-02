# AuraSync — TECHIN 515 Team 6

**AuraSync** is a context-aware bathroom scent diffuser built for MSTI Hardware–Software Lab II (TECHIN 515), Spring 2026. It senses shower, odor, and presence events using on-device sensor fusion and ML, then autonomously actuates an ultrasonic atomizer to dispense fragrance at the right moment.

Live devlog: [https://tongsue.github.io/TECHIN-515-Team6/](https://tongsue.github.io/TECHIN-515-Team6/)

---

## Team

| Member | GitHub | Focus |
|--------|--------|-------|
| Yutong Luo | [@TongSUE](https://github.com/TongSUE) | Firmware · App · PCB · Devlog site |
| Lucia Shen | [@xtshen777](https://github.com/xtshen777) | Hardware · ML · CAD · Firmware |

---

## System Overview

### Hardware

| Component | Role |
|-----------|------|
| XIAO ESP32-S3 | Dual-core LX7 MCU, 8 MB flash, PSRAM |
| BME680 | Temperature / humidity / pressure / VOC gas resistance |
| INMP441 | I²S MEMS microphone (right channel, 16 kHz) |
| WS2812B × 24 | State-reactive LED ring (FastLED, GPIO3) |
| Ultrasonic atomizer | N-channel MOSFET drive on GPIO4 |
| Custom PCB | Circular R = 45 mm, JST connectors, MT3608 boost |
| LiPo 3.7 V | Battery via MT3608 → 5 V supply rail |

### Firmware

Built with **PlatformIO** (pioarduino, ESP-IDF 5.x). Key subsystems:

- **Two-layer state machine** — outer SLEEP/AWAKE, inner IDLE/SPRAYING/COOLDOWN
- **BSEC2** — self-calibrating IAQ index from BME680 via Bosch library
- **ESP-SR MultiNet7** — on-device wake-word + command recognition (`aura` / `spray` / `release` / `stop` / `fragrance`)
- **On-device ML** — IAQ MLP + Shower 1D-CNN infer from a 120-entry ring buffer (no cloud step)
- **Firebase RTDB** — bidirectional sync: app → ESP32 commands; ESP32 → app sensor data / status
- **DEMO\_MODE** — fast 3 s sampling, 30 s warmup, relaxed thresholds for classroom demos

### Five Trigger Paths

| # | Trigger | Mechanism |
|---|---------|-----------|
| 1 | Voice | MultiNet7 detects "spray" or "release" keyword |
| 2 | App | Firebase command executed from any device state |
| 3 | IAQ Poor | On-device MLP classifies air quality as Poor |
| 4 | Shower CNN | 1D-CNN probability exceeds 0.65 |
| 5 | VOC + PIR | VOC inflection detected → PIR fires within 60 s |

Paths 3–5 are gated by the `autoSprayEnabled` flag from the app.

### LED Ring States

| State | Animation |
|-------|-----------|
| Sleep | Slow blue breathing |
| IAQ Good / Moderate / Poor | Green / yellow / orange breathing |
| Spraying | White rotating chase |
| Cooldown | Cyan fade-out |
| Voice window | Purple double-flash |

### Mobile App

React Native (Expo SDK 54) + Firebase JS SDK 10. Features: live Air Quality card, spray history log, Auto-Spray toggle, reservoir tracker with reset, dual Firebase / ESP32 online status indicator.

### ML Pipeline

| Model | Input | Output | Performance |
|-------|-------|--------|-------------|
| IAQ MLP (64→32→3) | 10 BSEC2 features | Good / Moderate / Poor | CV Macro F1 variance ±0.012 |
| Shower 1D-CNN | 30×6 normalised window | Shower probability | Val F1 0.902, AUC 0.94 |

Trained on 16 927 labelled bathroom readings; weights exported as C float arrays and inferred entirely on-chip.

---

## Devlog Site

Built with **React 19 + Vite 8 + Tailwind CSS 4**. Each week is a Markdown file with YAML front matter. Supports English / Chinese locale switching.

```
web-devlog/
├── public/images/devlog/       # Photos and figures
├── src/
│   ├── components/             # React UI components
│   ├── content/devlog/         # week-NN.md / week-NN.zh.md
│   ├── pages/                  # DevlogWeekPage, HomePage
│   └── i18n/strings.js         # EN/ZH UI strings + homepage credits
└── .github/workflows/          # GitHub Pages deploy
```

### Local development

```bash
cd web-devlog
npm install
npm run dev        # http://localhost:5173
```

Deployed automatically to GitHub Pages on every push to `main`.

---

MSTI Hardware–Software Lab II · Team 6 · Spring 2026
