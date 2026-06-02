---
week: 7
date: "May 12 - May 18, 2026"
title: "AuraSync v4, Open House Demo, App UI Polish & Enclosure Casting"
status: "Completed"
show_next_steps: true
summary: >
  Four tracks this week. Lucia upgraded the firmware to AuraSync v4: added
  DEMO_MODE (3 s sampling, 30 s warmup), rewrote the P3 VOC inflection trigger
  with a 60-second PIR latch for a realistic demo flow, fixed WiFi retries and
  MIN_MODEM power mode, fixed Firebase command parsing (getJSON) and an API
  key typo, added pushSensorData() and pollFirebaseSettings() so the app Air
  Quality card and Auto-Spray toggle are now live-connected, and corrected the
  feature_buffer warmup filter. All five trigger paths verified in hardware.
  The full pipeline was demoed live at the MSTI Alumni Reunion Open House
  without issues. Yutong polished the app UI with trigger icons, repositioned
  IAQ badge, reservoir reset, and dual Firebase/ESP32 status header. The
  enclosure upper lid was cast in clear resin from a silicone mold — PLA layer
  texture produced a frosted finish. Lower base CAD updated (height, USB-C,
  PCB mount, mic) and sliced; SLA printer broke and has since been repaired.
credits:
  - name: Lucia
    initials: L
    tags:
      - AuraSync v4 Firmware
      - Enclosure v3 CAD
      - Transparent Lid Casting
      - Open House Demo
  - name: Yutong
    initials: Y
    tags:
      - App UI Polish
      - Transparent Lid Casting
      - Open House Demo
      - Devlog
prior_week_progress:
  pcb-finalize: "partial"
  enclosure-lid: true
  enclosure-base: "partial"
  system-integration: true
planned_next:
  - id: sand-cover
    label: Sand & Finish Transparent Lid
    description: "Sand the cast resin lid to achieve a uniform frosted-glass surface finish, then test fit onto the lower base."
  - id: print-base
    label: Print Enclosure Lower Shell
    description: "SLA printer is repaired — print the lower base in resin, verify dimensional fit against the cast lid and PCB."
  - id: full-assembly
    label: Full Enclosure Assembly
    description: "Assemble upper lid + lower base with all components seated — PCB, LiPo, BME680, PIR, INMP441, atomizer. Run the full state machine to confirm nothing regressed post-assembly."
  - id: pcb-soldering
    label: PCB Final Soldering
    description: "Complete final soldering when the custom PCB arrives — all breakout connectors, atomizer MOSFET, MT3608, and WS2812B ring leads."
  - id: backup-video
    label: Record Backup Demo Video
    description: "Record a complete run-through of all five trigger paths as a fallback in case the live demo has connectivity or environmental issues."
---

## Executive Summary

Four tracks this week.

- **AuraSync v4 firmware** — Lucia overhauled the firmware: added `DEMO_MODE` (3 s sampling, 30 s warmup, relaxed thresholds), rewrote the P3 VOC inflection trigger with a 60-second PIR latch so "spray → walk to sensor" works as a demo flow, fixed WiFi retries and `WIFI_PS_MIN_MODEM`, fixed Firebase `getJSON` parsing and an API key typo, added `pushSensorData()` and `pollFirebaseSettings()` so the app's Air Quality card and Auto-Spray toggle are now live-connected, and corrected the `feature_buffer.h` warmup filter to skip high readings rather than cap them.
- **Open House demo** — The full system was demonstrated live at the MSTI Alumni Reunion Open House. All triggers fired correctly throughout the event and the team received positive feedback from alumni attendees.
- **App UI polish** — Yutong added trigger icons for `iaq_poor` (🌫️) and `p3_shower_end` (🚿), moved the IAQ badge below the gas resistance value, added a reservoir reset flow, and introduced a dual status indicator showing Firebase and ESP32 connection states independently.
- **Enclosure** — The lower base CAD was updated for v3. The transparent upper lid was cast in clear resin using a silicone mold — the PLA layer texture produced a frosted surface. The lower base is modelled and sliced; the SLA printer broke before printing but has been repaired.

<a id="firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Firmware Refinement — AuraSync v4

### DEMO_MODE

A `DEMO_MODE` compile flag was added (default: enabled) to make the device practical for short classroom demos without waiting 30 minutes for the BSEC2 warm-up.

| Parameter | Normal | DEMO_MODE |
|---|---|---|
| Sampling interval | ~9 s | ~3 s |
| IAQ warm-up | ~30 min | 30 s |
| Detection thresholds | Production-tuned | Relaxed for fast response |

### P3 Inflection + PIR Trigger — Rewrite

The original P3 logic required the VOC inflection point and an active PIR signal to occur simultaneously within a 5-second window. In practice this almost never fires during a demo because a person sprays perfume and then has to walk back to the PIR field of view.

The trigger was rewritten with a **latch mechanism**: when a VOC inflection is detected, a timestamp is recorded. If PIR fires within the next **60 seconds**, the spray is triggered. This supports the natural demo flow of "spray fragrance → walk to device" without needing to be in front of the sensor at the moment of detection.

### WiFi & Firebase Fixes

| Issue | Fix |
|---|---|
| Unreliable WiFi connection | Added 3 retries; each attempt prints progress and failure status code |
| Firebase SSL timeout (`ERROR:mRunUntil1`) | `WIFI_PS_MAX_MODEM` → `WIFI_PS_MIN_MODEM`; modem sleep too aggressive for SSL handshake |
| Command read returning empty string | `getString` → `getJSON` + `FirebaseJsonData`; App sends JSON objects, not plain strings |
| Auth failure | API key character fix: digit `1` → letter `l` in position 4 |

### App Data Sync — New Additions

Two polling functions were added to push device state to Firebase so the app reflects live sensor data:

**`pushSensorData()`** — runs every 5 s. Writes `gas_ohm`, `temp_c`, `humidity_pct`, and `context` to `/sensors/latest`. This is what powers the Air Quality card in the app; previously the card showed no data.

**`pollFirebaseSettings()`** — runs every 10 s. Reads `/settings/autoSprayEnabled`. All three automatic trigger paths (IAQ Poor, Shower CNN, P3 inflection) now gate on this flag — the Auto-Spray toggle in the app now has actual effect.

### feature_buffer.h — Warmup Filter

The warmup filter strategy was corrected:

| Before | After |
|---|---|
| Readings with `gas_ohm > 100k` were capped to 100k before entering the buffer | Readings with `gas_ohm > 60k` are skipped entirely |

Capping created artificially high values that polluted the rolling-max baseline used for normalisation. Skipping them outright prevents this while still allowing the buffer to fill with valid post-warmup readings.

### Verified Trigger Paths

All five trigger paths were confirmed to fire correctly in hardware testing:

1. **Voice** — ESP-SR keyword "spray" detected and routed through the priority queue
2. **App** — Firebase command received and executed from any device state, including SLEEP
3. **IAQ Poor** — On-device MLP classifies air quality as Poor; triggers spray (gated by `autoSprayEnabled`)
4. **Shower CNN** — 1D-CNN probability exceeds threshold; transitions to SPRAYING (gated by `autoSprayEnabled`)
5. **VOC inflection + PIR (P3)** — Latch mechanism: inflection detected → PIR fires within 60 s → spray (gated by `autoSprayEnabled`)

<a id="demo" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Full System Integration & Open House Demo

With AuraSync v4 complete, the full pipeline — PIR, ML triggers, Firebase, and app — was run and validated together for the first time.

The team presented AuraSync at the **MSTI Alumni Reunion Open House**. The live system ran throughout the event: attendees could trigger sprays via the app and observe the diffuser respond in real time. All five trigger types were demonstrated. Debugging was smooth with no issues during the event.

<a id="app-ui" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. App UI Polish

Four targeted improvements to the mobile app this week.

### Trigger Icon Mapping

Two trigger types were appearing as `❓` with raw key names because they were not yet registered in the app. Both are now properly mapped:

| Firebase key | Label | Icon | Color |
|---|---|---|---|
| `iaq_poor` | IAQ Poor | 🌫️ | Red |
| `p3_shower_end` | Shower | 🚿 | Blue |

### IAQ Pill Position & Overflow Fix

The air quality badge was previously rendered **above** the gas resistance reading. It now appears **below** the kΩ value — matching the visual hierarchy of the other sensor tiles. `numberOfLines={1}` and tighter padding prevent "Moderate" from wrapping on narrow screens.

### Reservoir Reset

A `⟳` button next to the reservoir estimate opens an action sheet:

- **Fill to Full** — resets consumption tracking to 30 ml in one tap
- **Set Amount…** — custom ml entry via native text prompt (iOS); Android falls back to Fill to Full

Reset state is written to Firebase `settings/` and persists across app restarts.

### Device Online Indicator

The header now shows two separate status rows:

| Row | Monitors |
|---|---|
| **App** 🟢 / 🔴 | App ↔ Firebase real-time connection |
| **Device** 🟢 / 🔴 | ESP32 online — inferred from `sensor.updatedAt`; offline if no update in > 2 min |

A 30-second interval re-evaluates device status even when sensor data stops arriving.

<div class="app-ui-update-embed"></div>

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. Enclosure

### Lower Base CAD — v3 Updates

Lucia revised the lower base model ahead of SLA printing:

| Change | Detail |
|---|---|
| Upper shell height | Raised to accommodate the atomizer module height |
| USB-C cutout | Added to lower shell for charging access |
| PCB mounting | Revised mounting method for secure fit |
| Microphone placement | Revised position for better acoustic clearance |

Modelling and slicing for the SLA resin printer were completed this week. The printer broke before the run could start — Zubin repaired it over the weekend and printing is scheduled for next week.

### Transparent Upper Lid — Silicone Mold Casting

The upper lid is the transparent section of the enclosure. The goal is a frosted-glass surface finish that diffuses internal LED light softly. Silicone mold casting with clear resin was chosen for the material finish.

#### Mold Design

![Silicone mold sketch — single-body mold design using outer shell with internal displacer to minimise silicone volume](images/devlog/silicone-mold-design.jpg "Mold design — Kevin's single-body approach: outer box + internal displacer saves silicone")

Kevin shared a **single-body mold** concept: rather than a two-part split mold, pour silicone around the master inside an outer box, with an internal structure displacing the bulk to reduce material use significantly.

#### Making the Mold

An outer cardboard box was built around the 3D-printed PLA master. Silicone was mixed, degassed under vacuum, then poured.

<div class="silicone-making-embed"></div>

A **glass bottle** was pressed into the wet silicone as the internal displacer — saving a large volume of material. This worked, but glass was the wrong choice: the silicone cured against the smooth bottle surface and bonded tightly. The bottle was eventually freed by **injecting air with a compressor** to break the seal.

![Cutting the silicone mold to release the cured resin lid — mold cut away in sections where no air gap formed](images/devlog/silicone-mold-wiggle-cut.jpg "Demoulding the resin lid — silicone cut away in sections to release the cast")

#### Casting the Lid

Clear resin (A+B, 1:1 by volume) was mixed, degassed, and poured into the mold. A wooden board was bound across the top to apply even pressure during cure. The resin cured for 48 hours.

![Resin poured into silicone mold with wooden board bound on top to apply pressure during cure](images/devlog/silicone-mold-with-resin.jpg "Resin cast in progress — wood board bound down to maintain even pressure")

Demolding the cured lid was difficult: the silicone was cast too thick with no air gap, so the lid could not be pulled free. The mold was cut away in sections to release the piece.

#### Result

![Finished clear resin upper lid — frosted translucent surface from PLA print layer lines](images/devlog/enclosure-clear-lid.jpg "Finished upper lid — clear resin with frosted texture from the PLA master's layer lines. Surface sanding only needed.")

The PLA print layer lines transferred through the silicone and into the resin surface, producing the intended frosted-glass aesthetic without any coating. Surface sanding is still needed to even out the finish before final assembly.

## Next Steps

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" checked /> | **Sand & Finish Transparent Lid** | Sand cast resin lid to a uniform frosted finish; test fit onto lower base. |
| <input type="checkbox" checked /> | **Print Enclosure Lower Shell** | SLA printer repaired — print lower base in resin; verify fit against lid and PCB. |
| <input type="checkbox" checked /> | **Full Enclosure Assembly** | Seat PCB, LiPo, BME680, PIR, INMP441, and atomizer into lower base; close both halves; confirm full state machine runs post-assembly. |
| <input type="checkbox" checked /> | **PCB Final Soldering** | Solder all components when custom PCB arrives — breakout connectors, atomizer MOSFET, MT3608, WS2812B ring leads. |
| <input type="checkbox" /> | **Record Backup Demo Video** | Record a complete run-through of all five trigger paths as a fallback for the live demo. |
