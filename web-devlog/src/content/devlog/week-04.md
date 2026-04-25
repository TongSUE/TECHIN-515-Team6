---
week: 4
date: "April 21 - April 27, 2026"
title: "BME680, Unified Firmware & Power-Aware State Machine"
status: "In Progress"
show_next_steps: true
summary: >
  Lucia brought up the BME680 VOC/environmental sensor — I2C validated at 0x77,
  all four data streams confirmed live, and a heat-gun test verified real-time
  response. Yutong merged PIR, voice recognition, and Firebase into a single
  AuraSync firmware with a dual-layer state machine, and added WiFi modem sleep
  plus Core 0 throttling for measurable idle power savings. The two-layer state
  machine architecture (SLEEP/AWAKE × IDLE/SPRAYING/COOLDOWN) with a four-priority
  trigger model was co-designed by both; BME680 integration into the live firmware
  remains in progress.
credits:
  - name: Lucia
    initials: L
    tags:
      - BME680 Bring-up
      - State Machine Design
      - Devlog
  - name: Yutong
    initials: Y
    tags:
      - AuraSync Unified Firmware
      - State Machine Design
      - Devlog
prior_week_progress:
  end-to-end-integration: true
  unified-state-machine: true
  mobile-app: false
  bme680-bring-up: true
planned_next:
  - id: bme680-firmware
    label: BME680 Firmware Integration
    description: Integrate BME680 into AuraSync alongside PIR and microphone — all three sensors active on a single ESP32-S3 with coordinated sampling.
  - id: voc-pattern-detection
    label: VOC Pattern Detection
    description: Implement sliding-window VOC rise-then-fall detection combined with PIR confirmation to identify post-flush odour events and trigger spray automatically.
  - id: voc-baseline
    label: Real-Environment VOC Baseline
    description: Collect VOC gas resistance time-series in an actual bathroom to calibrate the extreme-odour threshold and train the pattern detector.
  - id: firebase-reverse
    label: Firebase Reverse Control
    description: "Implement app-to-device command channel: app writes to /commands/action; ESP32 polls every 3 s, executes, and clears the node."
---

## Executive Summary

Sensors, firmware, and architecture — three parallel tracks advanced this week.

- **BME680 bring-up** — Lucia validated I2C at address 0x77, confirmed all four data
  streams (temperature, humidity, pressure, VOC gas resistance), and verified real-time
  environmental response with a heat-gun test. Cold-start heater warm-up identified as
  a calibration consideration.
- **AuraSync unified firmware** — Yutong merged PIR, voice recognition, and Firebase
  into `AuraSync.ino` — first firmware where all three hardware paths share one state
  machine. Serial output is minimal: only state transitions and in-window voice
  commands print.
- **Power saving** — WiFi modem sleep (DTIM-interval radio gating) and a Core 0
  poll-rate throttle during SLEEP mode reduce idle current draw without touching Core 1
  or the I2S clock.
- **State machine architecture** — Co-designed a two-layer model: Layer 1 (SLEEP/AWAKE,
  PIR-driven) and Layer 2 (IDLE/SPRAYING/COOLDOWN, shared absolute cooldown) with a
  four-priority trigger hierarchy. BME680 integration into the live firmware is in
  progress.

<a id="bme680-bring-up" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. BME680 Bring-up

The BME680 arrived this week. Bring-up followed the same bottom-up verification sequence used for the microphone and PIR: confirm the hardware path before layering in software complexity.

### Wiring

| BME680 Pin | XIAO ESP32-S3 | Notes |
|---|---|---|
| VIN | 3V3 | 3.3 V supply |
| GND | GND | Common ground |
| SDI (SDA) | D4 | Default SDA (GPIO5) |
| SCK (SCL) | D5 | Default SCL (GPIO6) |

### Step 1 — I2C Address Scan

An I2C scanner sketch confirmed the bus was live before any sensor-specific code was written. Result: device found at **0x77** — wiring correct.

### Step 2 — Library Setup & Initialisation

Libraries installed via Arduino Library Manager: **Adafruit BME680** and **Adafruit Unified Sensor**. Initialisation encountered one non-obvious issue:

| Attempt | Call | Result |
|---|---|---|
| Explicit GPIO | `Wire.begin(2, 3)` | I2C check FAILED |
| Default (no args) | `Wire.begin()` | I2C check OK — sensor initialised |

**Root cause:** The XIAO ESP32-S3's Arduino framework maps the default I2C bus to D4/D5 (GPIO5/GPIO6). Passing `Wire.begin(2, 3)` routes to GPIO2/GPIO3, which are unconnected to the BME680. The fix is to use `Wire.begin()` without arguments and let the framework apply the correct default mapping.

### Step 3 — Data Validation

First successful read:

| Measurement | Reading |
|---|---|
| Temperature | ~28 °C |
| Humidity | ~17 % |
| Pressure | ~1013 hPa |
| VOC gas resistance | ~37 kΩ |

![BME680 first live readings — all four data streams confirmed](images/devlog/BME_log.png "BME680 serial output — temperature, humidity, pressure, and gas resistance all reading live at I2C address 0x77")

### Step 4 — Real-Time Response Test

A heat gun was aimed at the sensor. Temperature readings climbed immediately and tracked the heat source in real time — confirming live environmental sensing rather than cached values.

### Sampling Configuration

```cpp
bme.setTemperatureOversampling(BME680_OS_8X);
bme.setHumidityOversampling(BME680_OS_2X);
bme.setPressureOversampling(BME680_OS_4X);
bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
bme.setGasHeater(320, 150);  // 320 °C, 150 ms — required for VOC measurement
```

> **Cold-start note:** The internal gas heater requires several minutes to reach thermal equilibrium after power-on. Gas resistance readings taken within the first ~2 minutes of a cold start should be treated as unstabilised and excluded from threshold comparisons.

<a id="end-to-end-integration" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="unified-state-machine" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. AuraSync Unified Firmware

With PIR, voice recognition, and Firebase individually validated across three separate sketches (`PIRTest`, `VoiceTest`, `FirebaseTest`), this week's firmware goal was merging all three into a single sketch: `Code/AuraSync/AuraSync.ino`.

![PIR, INMP441 mic, XIAO ESP32-S3 and ultrasonic atomizer integrated on breadboard — Firebase spray events logging live](images/devlog/firebase_pir_voice_atomizer.png "Integrated test setup: all three hardware paths (PIR, voice, atomizer) active on a single board, Firebase console open in background")

### Architecture

The dual-core split from VoiceTest is retained and extended:

| Core | Responsibility |
|---|---|
| **Core 1** — `srTask` | I2S read → AFE noise suppression → MultiNet recognition → `cmdQueue` |
| **Core 0** — `loop()` | PIR polling · state machine · atomizer · Firebase push · BME680 (planned) |

The SR task runs at `configMAX_PRIORITIES - 1` — the highest FreeRTOS priority — so audio processing is never preempted by Firebase I/O on the same core.

### Four-State Machine

<div class="aurasync-four-state-diagram-embed"></div>

### Serial Protocol

Output is deliberately minimal — only meaningful state transitions appear in the monitor:

| Line | When |
|---|---|
| `SPRAY:idle` / `SPRAY:spraying` / `SPRAY:cooldown` | State transition |
| `VOICE:aura` | Wake word confirmed |
| `WORD:spray:0.73` | Command recognised **inside** the 7 s window only |
| `ERROR:xxx` | Fault only |

Commands detected outside the voice window are silently discarded. This eliminates the false-positive noise that cluttered the raw VoiceTest serial output and makes the monitor readable at a glance.

### Firebase Event Schema

Each spray event pushed to `/spray_events/<push_id>`:

```json
{
  "trigger":     "pir",
  "command":     "spray",
  "duration_ms": 5000,
  "unixMs":      1776658120000,
  "iso":         "2026-04-25T21:08:40Z"
}
```

The `trigger` field (added in v2) distinguishes sensor-driven from human-commanded sprays — essential for later analysis of when and why the device actuates.

![Firebase Realtime Database — spray_events pushed from AuraSync firmware with trigger and timestamp fields](images/devlog/firebase_log.png "Firebase console showing live spray_events with push IDs, trigger source, duration_ms, and ISO timestamp")

### Power Saving

Two lightweight changes reduce idle current without affecting voice responsiveness. Estimates are based on the XIAO ESP32-S3 datasheet and the BOM hardware (MT3608 boost from 3.7 V LiPo, INMP441 at 1.4 mA continuous).

| Technique | Savings | Mechanism |
|---|---|---|
| `WiFi.setSleep(WIFI_PS_MAX_MODEM)` | **~90–110 mA** | Radio gates to DTIM beacon intervals (~102 ms). WiFi component drops from ~80–130 mA continuous Rx to ~5–20 mA avg; ESP32-S3 total drops from ~130–180 mA to ~20–35 mA. |
| `delay(80)` in `loop()` during SLEEP mode | **~20–30 mA** | Core 0 polls at ~12 Hz instead of near-continuous (~1 kHz). FreeRTOS enters tickless idle (WFI) for ~80 ms out of every 83 ms, cutting CPU active time from ~40 mA to ~5–10 mA. |
| BME680 30 s sample interval in SLEEP | **~1.6 mA** | Gas heater (320 °C, ~35 mA peak) fires 150 ms every 30 s (0.5 % duty) instead of every 3 s (5 % duty). Heater avg drops from ~1.75 mA to ~0.18 mA. |

> **Battery life estimate:** At ~30 mA system idle (SLEEP mode, all three techniques active), the EEMB 2000 mAh LiPo gives approximately **60–70 hours** continuous idle — compared to ~13 hours without any power optimisation. Core 1 (SR task + I2S) runs at full speed regardless, so wake-word detection is unaffected.

Core 1 (SR task + I2S) runs at full speed regardless of sleep mode — wake-word detection is unaffected.

<a id="state-machine-architecture" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. Two-Layer State Machine Design

*This section is a design record — firmware implementation is ongoing.*

The four-state model in Section 2 handles the current hardware set (PIR + voice). This section documents the expanded architecture designed to accommodate the BME680 once it is integrated into the firmware.

### Two Layers

<div class="two-layer-state-machine-diagram-embed"></div>

### Trigger Priority

<div class="trigger-priority-diagram-embed"></div>

### P2 — Extreme Odour Logic

P2 fires when gas resistance drops below 10 kΩ regardless of presence. In SLEEP mode it simultaneously wakes the system. If the cooldown is active when P2 triggers, the spray is queued (`p2Pending = true`) and fires as soon as the cooldown expires — ensuring extreme odour is always addressed even if a recent spray is still locked out.

### P3 — VOC Inflection + PIR

P3 targets the post-flush scenario: VOC rises as odour builds, peaks, then begins falling as ventilation takes effect. The firmware detects this inflection point using a rolling history of 8 BME680 samples (at 3 s intervals, this covers ~24 s of history). Detection requires the last three readings to show a declining gas resistance trend (resistance falls = odour rises) followed by the current reading showing recovery (resistance rises). PIR must have seen a HIGH signal within the past 5 s to confirm presence.

## Next Steps

Week 5 shifts from firmware architecture to sensor integration and real-environment data collection.

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **BME680 Firmware Integration** | Integrate BME680 into AuraSync alongside PIR and microphone — all three sensors active on a single device with coordinated sampling. |
| <input type="checkbox" /> | **VOC Pattern Detection** | Implement sliding-window VOC rise-then-fall detection with PIR confirmation as an automatic spray trigger (P3). |
| <input type="checkbox" /> | **Real-Environment VOC Baseline** | Collect gas resistance time-series in an actual bathroom to calibrate the P2 extreme-odour threshold. |
| <input type="checkbox" /> | **Firebase Reverse Control** | App writes to `/commands/action`; ESP32 polls every 3 s, executes, and clears — bi-directional control without WebSocket. |
