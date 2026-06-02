---
week: 8
date: "May 19 - May 25, 2026"
title: "Enclosure Finishing, PCB Bring-up, LED Ring & Full Assembly"
status: "In Progress"
show_next_steps: true
summary: >
  The final build sprint. Yutong SLA-printed and wet-sanded the lower base
  (60 → 1000 grit, water-cooled), then trimmed, drilled, and accidentally
  cracked the clear resin lid — the team chose same-resin repair over recasting;
  Lucia prepared a fresh mold as backup; the repair finished cleaner than
  expected. The custom PCB arrived: Yutong soldered all components and wired
  the 24-LED WS2812B ring. Lucia integrated five state-reactive LED animations,
  migrated the build to PlatformIO (ESP-IDF 5.x), and tuned voice recognition
  — adding "Release" as a second trigger word after "Spray" proved unreliable
  in noisy environments. Final assembly confirmed all five trigger paths
  working end-to-end.
credits:
  - name: Lucia
    initials: L
    tags:
      - LED Firmware
      - Voice Tuning
      - Resin Lid Re-mold (backup)
      - Full Assembly
      - Final Presentation Slides
  - name: Yutong
    initials: Y
    tags:
      - PCB Soldering
      - Enclosure Finishing
      - Resin Lid Repair
      - Full Assembly
      - Devlog
prior_week_progress:
  sand-cover: true
  print-base: true
  full-assembly: true
  pcb-soldering: true
  backup-video: "partial"
planned_next:
  - id: backup-video
    label: Record Backup Demo Video
    description: "Record a complete run-through of all five trigger paths as a fallback in case the live demo has connectivity or environmental issues."
  - id: final-demo
    label: Final Project Demo
    description: "Present AuraSync at the final demo session — device, app, and Firebase all operational; all five trigger paths ready."
---

## Executive Summary

Four tracks this week brought the project to completion.

- **Enclosure** — Both halves finished. Yutong SLA-printed and wet-sanded the lower base (60 → 1000 grit, water-cooled) with Kevin's guidance. The resin upper lid was trimmed with a band saw, then drilled for the spray nozzle — the resin cracked. After consulting Kevin, the team chose same-resin repair over recasting; Lucia prepared a backup mold in parallel. The repair was unexpectedly clean; both halves were re-sanded together to a uniform frosted finish.
- **PCB & Electronics** — The custom PCB arrived. Yutong soldered all breakout connectors, the atomizer MOSFET, MT3608, and WS2812B ring leads. Several debugging passes cleared short circuits before bring-up was clean.
- **Firmware** — Lucia integrated five state-reactive WS2812B animations and migrated the build to PlatformIO (ESP-IDF 5.x). Voice recognition was tuned after "Spray" proved unreliable in ambient noise — "Release" was added as a second trigger word.
- **Full Assembly** — All components seated in the enclosure. All five trigger paths verified end-to-end. The app → Firebase → ESP32 pipeline and LED ring are both operational.

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Enclosure — Final Finishing

### Lower Base — SLA Print & Sanding

With the SLA printer repaired, Yutong printed the lower base resin with Kevin's guidance. Post-print finishing:

1. Remove support structures
2. UV post-cure (secondary hardening pass)
3. Wet-sand: 60 → 120 → 240 → 400 → 600 → 1000 grit

Wet-sanding keeps the sandpaper dipped in water throughout — this dissipates heat and prevents resin dust from clogging the abrasive or becoming airborne.

![Wet sanding the lower base — sandpaper dipped in water at each grit stage](images/devlog/sanding-paper.jpg "Wet sanding — water keeps the paper clear and prevents heat build-up")

![Finished lower base after SLA printing and wet sanding to 1000 grit](images/devlog/sanding-lower-base.jpg "Finished lower base — smooth resin surface ready for assembly")

### Transparent Upper Lid — Trim, Drill & Repair

The cast resin lid needed two finishing steps: trim excess flash from the perimeter and drill the spray nozzle opening at the apex.

![Trimming excess resin flash from the lid perimeter with a band saw](images/devlog/band-saw.jpg "Band saw trim — removing excess flash before drilling the nozzle hole")

After trimming, the spray hole was drilled at the top centre. When the drill broke through, the resin cracked radially outward from the hole.

Kevin was consulted. Three options were considered:

| Option | Pros | Cons |
|---|---|---|
| Recast | Guaranteed clean result | 48+ h cure; lose the finished piece |
| UV glue repair | Fast (minutes) | Different material; may leave a visible seam |
| Same-resin repair | Material match; strong, near-invisible bond | 24 h cure; cosmetic result uncertain |

The team chose **same-resin repair**: liquid resin was worked into the cracks and cured for 24 hours. In parallel, Lucia re-modelled the mold and prepared a fresh silicone mold for recasting — it turned out not to be needed.

![Resin upper lid with radial cracks from the drilled spray nozzle opening](images/devlog/drill-broken-lid.jpg "Drill-through crack — resin cracked radially from the nozzle hole")

![Same-resin repair — liquid resin worked into cracks before 24 h cure](images/devlog/repair-using-resin.jpg "Same-resin repair — liquid resin fills the cracks; 24 h cure")

After curing, Lucia and Yutong re-sanded the lid together. The cracks are nearly invisible and the frosted finish is consistent across the whole surface.

![Re-sanding the repaired lid — Lucia and Yutong finishing together](images/devlog/sanding-after-repair.jpg "Post-repair sanding — crack lines nearly invisible after re-sand")

<a id="electronics" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. PCB & Electronics

The custom PCB arrived this week. Yutong soldered all components onto the board:

- JST connector headers — ESP32-S3, BME680, PIR, INMP441
- MOSFET + gate resistor for the atomizer drive circuit
- MT3608 boost converter pads
- 24-LED WS2812B ring lead wires to GPIO3 (D2)

Multiple debugging passes identified and cleared short circuits before the board passed bring-up cleanly.

<a id="firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. Firmware — LED Ring & Voice

### WS2812B LED Ring

Lucia integrated a 24-LED WS2812B ring (FastLED 3.9.0, GPIO3) with five state-reactive animations:

| Device state | Animation |
|---|---|
| Sleep | Slow blue breathing |
| IAQ Good / Moderate / Poor | Green / yellow / orange breathing |
| Spraying | White rotating chase (3–4 pixels, 30 ms/step) |
| Cooldown | Cyan fade-out |
| Voice trigger window | Purple double-flash |

Frame rate capped at ~60 fps via `millis()` delta (16 ms per tick).

### PlatformIO Migration

The build was migrated from Arduino IDE (ESP-IDF 4.x) to **PlatformIO** (pioarduino, ESP-IDF 5.x). FastLED 3.9.0 is now pinned, builds are reproducible, and compiler diagnostics are much cleaner.

### Voice Command Tuning

After full assembly, voice recognition was tested in real conditions:

- **"Aura"** (wake) and **"Stop"** (cancel) — reliable
- **"Spray"** — consistently missed in ambient noise (hardware limitation: the acoustic cavity design attenuates certain phonemes)

Fix: **"Release"** was added as a second trigger word. Both map to the same spray action. With MultiNet7 threshold at `0.45f`, "Release" is significantly more detectable than "Spray" in a noisy environment.

Active voice commands: `aura` / `spray` / `fragrance` / `release` / `stop`

<a id="assembly" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. Full Assembly & Integration

All components were seated into the assembled enclosure. All five trigger paths confirmed to fire correctly:

1. **Voice** — "Aura" wake + "Release" / "Spray" triggers spray via priority queue
2. **App** — Firebase command received and executed from any state, including SLEEP
3. **IAQ Poor** — on-device MLP classifies air quality as Poor; triggers spray (gated by `autoSprayEnabled`)
4. **Shower CNN** — 1D-CNN probability exceeds threshold; transitions to SPRAYING (gated by `autoSprayEnabled`)
5. **VOC inflection + PIR (P3)** — latch: inflection detected → PIR fires within 60 s → spray (gated by `autoSprayEnabled`)

![AuraSync fully assembled — transparent frosted upper lid over resin lower base, all components seated](images/devlog/final-model.jpg "Final assembly — both halves closed, all components inside")

![App trigger test — spray command sent via Firebase, ESP32 responds in real time](images/devlog/final-app-control-test.jpg "App trigger — Firebase → ESP32 in ~1 s")

<div class="final-triggers-embed"></div>

## Next Steps

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **Record Backup Demo Video** | Record a complete run-through of all five trigger paths as a fallback for the live demo. |
| <input type="checkbox" /> | **Final Project Demo** | Present AuraSync — device, app, and Firebase all operational; all five trigger paths ready. |
