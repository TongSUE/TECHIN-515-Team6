---
week: 6
date: "May 5 - May 11, 2026"
title: "ML On-Device Inference, Enclosure v2, PCB v1 & Firebase Validation"
status: "Completed"
show_next_steps: true
summary: >
  Four tracks converged this week. Lucia exported the trained IAQ MLP and
  Shower CNN weights as C float arrays and wired them into the AuraSync
  firmware — the device now classifies air quality and detects shower events
  entirely on-chip with no cloud inference step. The Firebase reverse-control
  loop was debugged and validated end-to-end with approximately 1-second
  round-trip latency. The enclosure was redesigned from a rectangular box to
  a cylindrical two-part snap-fit form factor and printed in PLA. Yutong
  designed the PCB as a circular board (R = 45 mm) fabricated on the GIX
  LPKF milling machine, and completed the Milestone 2 slide deck.
credits:
  - name: Lucia
    initials: L
    tags:
      - ML Firmware Integration
      - Enclosure v2
      - Milestone 2 Slides
  - name: Yutong
    initials: Y
    tags:
      - PCB Design
      - Milestone 2 Slides
      - Devlog
prior_week_progress:
  shower-data-and-retrain: true
  extreme-case-testing: "partial"
  enclosure: true
  pcb: true
planned_next:
  - id: pcb-finalize
    label: Finalize PCB & Soldering
    description: "Complete PCB v1 bring-up — power from LiPo + MT3608, verify all GPIO connections, confirm no shorts. Cut and solder PCB v2 to fix any routing or clearance issues found during testing."
  - id: enclosure-lid
    label: Enclosure Upper Lid
    description: "Cast the upper lid using a silicone mold and clear resin (A+B). The 3D-printed master's layer texture provides a natural frosted finish without post-processing."
  - id: enclosure-base
    label: Enclosure Lower Base
    description: "Model and slice the lower base for SLA resin printing. The base houses the PCB, battery, sensors, and atomizer, and must align with the snap-fit interface of the cast upper lid."
  - id: system-integration
    label: Full System Integration Test
    description: "Run all sensors + ML triggers + Firebase + app together as a complete pipeline — validate PIR wake → ML event detection → spray actuation → cooldown → Firebase state reflected in app under real conditions."
---

## Executive Summary

Four parallel tracks this week.

- **ML on-device inference** — Lucia exported trained model weights as C float arrays and integrated them into the AuraSync firmware. The device now runs IAQ classification and shower detection entirely on-chip with no cloud step.
- **Firebase validation** — The reverse-control loop (app → ESP32 → actuate → ack) was debugged and validated end-to-end with approximately 1-second round-trip latency.
- **Enclosure v2** — Redesigned from a rectangular box to a cylindrical two-part snap-fit. Printed in PLA; both sections confirmed to fit and separate cleanly.
- **PCB v1** — Yutong designed a circular PCB (R = 45 mm) using JST connector headers to mount all breakout boards. Fabricated at GIX on the LPKF milling machine and partially soldered.

<a id="ml-inference" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. ML On-Device Inference

### Model Export

Lucia converted the trained Python models to C float arrays using a custom export script. Three header files were added to the AuraSync sketch folder:

| File | Contents |
|---|---|
| `iaq_model.h` | IAQ MLP: StandardScaler parameters + weight matrices for two hidden layers (64 → 32) and a 3-class softmax output (Good / Moderate / Poor) |
| `shower_model.h` | Shower 1D-CNN: all conv, pool, and dense weight arrays |
| `feature_buffer.h` | 120-entry ring buffer (20-minute window) + `fb_push()`, `computeIAQFeatures()`, `computeShowerWindow()` |

The ring buffer stores one BSEC2 LP sample every 9–10 seconds. Feature engineering runs entirely inside the header functions, matching the training pipeline exactly — same 5-minute delta calculations, same 10-minute rolling statistics, same StandardScaler parameters.

### Firmware Integration

The AuraSync state machine now calls ML inference on each BSEC2 LP callback:

1. `fb_push()` adds the new reading (temperature, humidity, IAQ index) to the ring buffer.
2. When the buffer has at least 60 samples, `computeIAQFeatures()` builds the 10-feature vector and the IAQ MLP classifies air quality (Good / Moderate / Poor).
3. When the buffer has at least 30 samples, `computeShowerWindow()` builds the 30×6 normalised window and the Shower CNN outputs a probability.
4. If shower probability exceeds 0.65, the state machine transitions to SPRAYING.

An IAQ accuracy gate prevents classification during BSEC2 warm-up: readings with `iaq_accuracy < 1` are skipped for the first ~30 minutes after cold start.

### Round 2 Results (BSEC2 Data)

The switch from raw `gas_ohm` + rolling normalisation to the BSEC2 calibrated IAQ index collapsed inter-session IAQ variance from **±0.165** to **±0.012** — roughly a 14× improvement in feature stability.

| Model | Metric | Round 1 | Round 2 |
|---|---|---|---|
| IAQ MLP | CV Macro F1 variance | ±0.165 | ±0.012 |
| Shower CNN | Val F1 | 0.77 | **0.902** |
| Shower CNN | ROC-AUC | 0.94 | 0.94 |

The Shower CNN val F1 of 0.902 exceeds the ≥ 0.85 target set in week 5.

<a id="firebase-reverse" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Firebase Reverse Control — Validation

The Firebase command protocol was designed in week 5. This week the ESP32 polling loop was debugged and the full round trip was validated end-to-end.

### Bug Fix

The original implementation used `getString` to read `/commands/action`, which fails silently when the node contains a JSON object. The fix:

| Before | After |
|---|---|
| `getString` → empty string on JSON node | `getJSON` + `FirebaseJsonData` → correct parse |
| Ack: `setString(..., "")` (empty string ≠ null) | Ack: `deleteNode("/commands/action")` |

The app's `onValue` listener checks `snap.val() === null` for confirmation — node deletion is the correct acknowledgement signal.

A WiFi power-save bug was also fixed: `WIFI_PS_MAX_MODEM` caused the radio to sleep too aggressively during SSL handshake, producing `ERROR:mRunUntil1: SSL internals timed out!`. Changed to `WIFI_PS_MIN_MODEM`.

<div class="app-debug-photos-embed"></div>

Round-trip latency from app button tap to ESP32 actuation and app confirmation is approximately **1 second** under home WiFi conditions.

<a id="enclosure" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. Enclosure v2

### Target Vision

The goal is a compact consumer-product form factor — transparent upper shell exposing the fragrance bottle, white base, and a breathing LED showing interaction state.

<div class="enclosure-concept-embed"></div>

### CAD Design

The enclosure is a **cylindrical two-part snap-fit**. The upper cylinder holds the fragrance reservoir and atomizer. The lower base houses the PCB, battery, and all sensors, and is where all the interaction features are resolved.

**Feature decisions on the lower base:**

**Microphone** — A circumferential slot runs around the full perimeter of the base. A single hole was not enough for reliable audio capture; the continuous slot improves pickup from any angle and reduces sensitivity to device orientation.

**PIR sensor** — The AM312 mini PIR faces directly outward through a front-facing opening. Flush exposure gives it an unobstructed field of view without a separate lens or housing.

**LED indicator** — Currently a single indicator opening. Future versions may include an internal LED strip for a breathing-light effect that communicates device state (idle / spraying / cooldown) through the enclosure wall. The transparent upper shell in the final version would make this especially visible.

### Printed Prototype

<div class="enclosure-printed-embed"></div>

Both sections fit and separate cleanly. The current print is a structural prototype in yellow PLA — not the final material or colour.

### Next Iterations

| Item | Detail |
|---|---|
| Structural mounting | After PCB v1 bring-up, design mounting points, cable routing paths, and reserved space for the LiPo battery and fragrance container inside the base |
| Component fit verification | Confirm clearances once final PCB dimensions are fixed; add USB-C cutout and secure mounting method |
| High-fidelity finish | 3D print master → resin casting for smooth surface finish; target transparent upper + white base (tentative) |
| LED lighting | Evaluate internal LED strip for breathing-light interaction states visible through the enclosure wall |
| Fragrance bottle | Source a bottle sized to fit the inner cylinder diameter |

<a id="pcb" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. PCB Design v1

### Design

Because all components are purchased as breakout boards, the PCB uses **JST connector headers** as footprints rather than soldering components directly. Components on the board:

- XIAO ESP32-S3
- BME680 breakout
- INMP441 microphone breakout
- PIR sensor connector
- Atomizer MOSFET drive circuit
- MT3608 boost converter (footprint drawn from scratch)
- LiPo connector

The board is **circular with radius 45 mm** to fit the cylindrical enclosure base.

![PCB v1 schematic — all breakout boards connected via JST headers](images/devlog/pcb-schematic-v1.png "PCB v1 schematic")

![PCB v1 layout in KiCAD — circular board R=45mm with JST connector footprints](images/devlog/pcb-design-v1.png "PCB v1 PCB layout")

### Fabrication

The board was manufactured at **GIX using the LPKF PCB milling machine**. Milling confirmed that the circular board fits inside the enclosure lower base and gave a first look at trace quality and connector spacing.

![PCB v1 after LPKF milling](images/devlog/pcb-manufacture.png "PCB v1 milled on the GIX LPKF machine — board cut and ready for soldering")

![PCB v1 partially soldered](images/devlog/pcb-solder-test.png "PCB v1 partially soldered — subsystem bring-up in progress")

**Current status:** board is cut and partially soldered. Next step is functional testing of each subsystem on the PCB, then a second revision to fix any spacing or routing issues before full assembly.

## Next Steps

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **Finalize PCB & Soldering** | Complete PCB v1 bring-up; power from LiPo + MT3608; verify GPIO pinout and confirm no shorts. Cut and solder PCB v2 to address any issues. |
| <input type="checkbox" /> | **Enclosure Upper Lid** | Cast the upper lid using a silicone mold and clear resin (A+B). The PLA master's layer texture gives a natural frosted finish. |
| <input type="checkbox" /> | **Enclosure Lower Base** | Model and slice the lower base for SLA resin printing; must align with the snap-fit interface of the cast lid. |
| <input type="checkbox" /> | **Full System Integration Test** | Run all sensors + ML + Firebase + app together as one pipeline under real conditions. |
