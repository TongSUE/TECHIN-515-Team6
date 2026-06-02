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
      - WS2812B LED Firmware
      - PlatformIO Migration
      - Voice Tuning
      - Resin Lid Re-mold (backup)
  - name: Yutong
    initials: Y
    tags:
      - PCB Soldering
      - Enclosure Finishing
      - Resin Lid Repair
      - Devlog
prior_week_progress:
  sand-cover: true
  print-base: true
  full-assembly: true
  pcb-video: "partial"
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

- **Enclosure** — Both halves finished. Yutong SLA-printed and wet-sanded the lower base (60 → 1000 grit, water-cooled) with Kevin's guidance. The resin upper lid was trimmed with a band saw, then drilled for the spray nozzle — the resin cracked. After consulting Kevin, the team chose same-resin repair over recasting; Lucia prepared a backup mold in parallel. The repair result was unexpectedly clean; Lucia and Yutong re-sanded both halves together to a uniform frosted finish.
- **PCB & Electronics** — The custom PCB arrived. Yutong soldered all breakout connectors, the atomizer MOSFET drive circuit, and the 24-LED WS2812B ring leads. Several debugging passes cleared short circuits before bring-up was clean.
- **Firmware** — Lucia integrated five state-reactive WS2812B animations and migrated the build from Arduino IDE to PlatformIO (ESP-IDF 5.x). Voice command recognition was tuned after "Spray" proved unreliable in ambient noise — "Release" was added as a second trigger word with much better detection.
- **Full Assembly** — All components seated in the enclosure. All five trigger paths verified end-to-end. The app → Firebase → ESP32 pipeline and LED ring are both operational.

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Enclosure — Final Finishing

### Lower Base — SLA Print & Sanding

With the SLA printer repaired, Yutong printed the lower base resin with Kevin's guidance. Post-print finishing steps:

1. Remove support structures
2. UV post-cure (secondary hardening pass)
3. Wet-sand through 60 → 120 → 240 → 400 → 600 → 1000 grit
   - Wet-sanding technique: sandpaper kept wet to dissipate heat and prevent resin dust

![Finished lower base after SLA printing and sanding to 1000 grit](images/devlog/enclosure-base-printed.jpg "SLA-printed lower base — support removed, UV cured, wet-sanded to 1000 grit")

### Transparent Upper Lid — Trim, Drill & Repair

The cast resin lid required two final steps before assembly: trim excess flash from the perimeter and drill the spray nozzle opening at the apex.

1. **Band saw** — trimmed excess resin from the cast perimeter
2. **Drill press** — drilled the spray opening at the top centre

**Problem:** When the drill broke through, the resin cracked radially outward from the hole.

Kevin was consulted. Three options were considered:

| Option | Pros | Cons |
|---|---|---|
| Recast | Guaranteed clean result | 48+ h cure; lose the finished piece |
| UV glue repair | Fast (minutes) | Different material; may leave a visible line or be weaker |
| Same-resin repair | Material match; strong, near-invisible bond | 24 h cure; cosmetic result uncertain |

The team chose **same-resin repair**: liquid resin was worked into the cracks, clamped to seat the material, and cured for 24 hours. In parallel, Lucia re-modelled the silicone mold and prepared a fresh mold for recasting as a backup — it turned out not to be needed.

<div class="resin-repair-embed"></div>

After curing, Lucia and Yutong re-sanded the lid together. The crack lines are nearly invisible and the frosted finish is consistent across the whole surface.

<a id="electronics" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. PCB & Electronics

The custom PCB arrived this week. Yutong soldered all components onto the board:

- All JST connector headers — ESP32-S3, BME680, PIR, INMP441
- MOSFET + gate resistor for the atomizer drive circuit
- MT3608 boost converter pads
- 24-LED WS2812B ring lead wires to GPIO3 (D2)

Multiple debugging passes were needed to identify and clear short circuits before the board passed bring-up cleanly.

![Custom PCB with all components soldered — ESP32-S3, BME680, INMP441, PIR, atomizer MOSFET, MT3608, and WS2812B ring leads](images/devlog/pcb-soldered.jpg "Custom PCB fully soldered and brought up")

<a id="firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. Firmware — LED Ring & Voice

### WS2812B LED Ring

Lucia integrated a 24-LED WS2812B ring (FastLED 3.9.0, GPIO3) with five state-reactive animations that give the device clear visual feedback at every stage:

| Device state | Animation |
|---|---|
| Sleep | Slow blue breathing |
| IAQ Good | Green breathing |
| IAQ Moderate | Yellow breathing |
| IAQ Poor | Orange breathing |
| Spraying | White rotating chase (3–4 bright pixels, 30 ms/step) |
| Cooldown | Cyan fade-out |
| Voice trigger window | Purple double-flash |

The ring updates at up to 60 fps via a `millis()` delta frame cap (16 ms per tick).

<div class="led-ring-embed"></div>

### PlatformIO Migration

The firmware build was migrated from Arduino IDE (ESP-IDF 4.x) to **PlatformIO** (pioarduino platform, ESP-IDF 5.x). The new build system pins FastLED 3.9.0 explicitly, produces better compiler diagnostics, and gives fully reproducible builds.

### Voice Command Tuning

After the full assembly was complete, voice recognition was tested under real conditions:

- **"Aura"** (wake) and **"Stop"** (cancel) — reliable detection
- **"Spray"** — consistently missed in ambient noise (hardware limitation: the acoustic cavity design attenuates certain phonemes)

Fix: **"Release"** was added as a second trigger word. Both "Spray" and "Release" execute the same spray action. With the MultiNet7 threshold set to `0.45f`, "Release" is significantly more detectable than "Spray" in a noisy environment.

Active voice commands: `aura` / `spray` / `fragrance` / `release` / `stop`

<a id="assembly" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. Full Assembly & Integration

All components were seated into the assembled enclosure. All five trigger paths were confirmed to fire correctly:

1. **Voice** — "Aura" wake + "Release" / "Spray" trigger via the priority queue
2. **App** — Firebase command received and executed from any state, including SLEEP
3. **IAQ Poor** — on-device MLP classifies air quality as Poor; triggers spray (gated by `autoSprayEnabled`)
4. **Shower CNN** — 1D-CNN probability exceeds threshold; transitions to SPRAYING (gated by `autoSprayEnabled`)
5. **VOC inflection + PIR (P3)** — latch: inflection detected → PIR fires within 60 s → spray (gated by `autoSprayEnabled`)

The app → Firebase → ESP32 spray pipeline is reliable. The LED ring provides unambiguous visual state feedback. AuraSync is demo-ready.

<div class="assembly-embed"></div>

## Next Steps

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **Record Backup Demo Video** | Record a complete run-through of all five trigger paths as a fallback in case the live demo has connectivity or environmental issues. |
| <input type="checkbox" /> | **Final Project Demo** | Present AuraSync — device, app, and Firebase all operational; all five trigger paths ready. |
