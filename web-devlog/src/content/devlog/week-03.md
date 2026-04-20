---
week: 3
date: "April 14 - April 20, 2026"
title: "Voice Recognition, PIR Sensor & Milestone 1 Prep"
status: "In Progress"
show_next_steps: false
summary: >
  Yutong built the full ESP-SR voice recognition pipeline with a wake-word
  state machine and a real-time Streamlit dashboard; Lucia integrated an
  HC-SR501 PIR sensor to presence-trigger the ultrasonic atomizer. The VOC
  sensor remains in transit from Adafruit.
credits:
  - name: Lucia
    initials: L
    tags:
      - PIR Sensor
      - Milestone Slides
  - name: Yutong
    initials: Y
    tags:
      - Voice Recognition
      - Streamlit Dashboard
      - Schematic Update
      - Devlog
prior_week_progress:
  refine-cad-schematic: true
  wifi-firebase: false
  microphone-module: true
  atomizer-test: true
planned_next:
  - id: firebase
    label: Firebase Integration
    description: Push live sensor event data to Firebase Realtime Database.
  - id: milestone-1
    label: Milestone 1 Demo Fair
    description: Present live voice + PIR demo at workstation; 10 min presentation + 5 min Q&A.
  - id: enclosure
    label: Low-fi Enclosure
    description: Fabricate cardboard or laser-cut enclosure for demo form factor.
  - id: bme680-bring-up
    label: BME680 Bring-up
    description: Integrate environmental sensor once Adafruit order arrives.
---

## Executive Summary

This week both hardware paths came alive. Yutong brought up the **SPH0645 I2S microphone** and integrated **Espressif's ESP-SR speech recognition** engine, implementing a wake-word state machine ("Aura" → command window) and a companion **real-time Streamlit dashboard** that streams audio level and recognised commands over serial. Lucia wired the **HC-SR501 PIR presence sensor** through a 2N2222 transistor to gate the ultrasonic atomizer, delivering the first end-to-end presence-triggered spray cycle. The Adafruit VOC sensor order remains delayed; BME680 bring-up is deferred to next week.

## Note — Mentor Meeting

*We connected with our project mentor this week.*

<div class="mentor-card-embed"></div>

His input touched on three areas:

**1 · Whole-home ecosystem integration**
Rather than shipping a standalone device with its own microphone and cloud backend, Justin suggested positioning AuraSync as a **smart-home accessory** — registering with Apple HomeKit, Google Home, or the Matter protocol so it receives commands through the user's existing smart speaker or phone. This approach offloads speech recognition entirely to proven platform APIs (Siri, Google Assistant) and integrates naturally into routines users have already set up.

**2 · Sensor rationalisation**
Justin observed that both the microphone and the BME680 ultimately infer the same high-level events — presence, shower start, odour spike. Since the BME680 provides richer and more distinctive environmental signals, he recommended keeping it and replacing the microphone with a simpler, lower-power **PIR sensor** for presence detection. The microphone's value is largely duplicated once platform voice APIs are in the picture.

**3 · Cloud architecture**
Delegating voice to Apple/Google APIs dissolves the custom cloud pipeline question: the platform handles speech-to-intent; AuraSync only needs to respond to accessory events over a local home network.

**Our response for Milestone 1:** We find the ecosystem direction compelling and intend to explore it after the milestone. For the current demo we are retaining the microphone (already validated and integrated) while also adding the PIR sensor as Justin suggested. We will revisit the microphone-vs-platform trade-off at Milestone 2, informed by real BME680 signal quality data once the sensor arrives.

<div class="special-thanks-card-embed"></div>

<a id="voice-recognition" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="microphone-module" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Voice Recognition — SPH0645 + ESP-SR

### Hardware — SPH0645 I2S Microphone

The INMP441 originally specified in the schematic was swapped for the **Adafruit SPH0645LM4H breakout** (product #3421). The I2S pinout is identical; the difference is the channel selection: SPH0645's SEL pin is tied to GND, selecting the **left channel**.

| Signal | XIAO Pin | GPIO | Notes |
|--------|----------|------|-------|
| BCLK   | D8       | 7    | Bit clock |
| LRCL   | D9       | 8    | Left/right word select |
| DOUT   | D10      | 9    | Serial audio data |
| SEL    | GND      | —    | Left channel select |
| VDD    | 3V3      | —    | |
| GND    | GND      | —    | |

SPH0645 outputs 18-bit audio left-aligned in bits [31:14] of a 32-bit I2S frame. Firmware reads the full 32-bit word and right-shifts by 14 for peak level, or by 16 for 16-bit PCM to feed the ESP-SR AFE.

![SPH0645 wiring to XIAO ESP32-S3](images/devlog/mictest_wiring.png)

### Software — ESP-SR Pipeline

**ESP-SR v2.0** (bundled with Arduino ESP32 v3.x) provides:
- **AFE** (Audio Front End) — noise suppression + VAD (Voice Activity Detection)
- **MultiNet v7** — keyword recognition from a vocabulary of registered phrases

Both run on **FreeRTOS Core 1** (pinned via `xTaskCreatePinnedToCore`) to keep the main loop free for pump and LED control.

PSRAM is required for the AFE's internal buffers. The XIAO ESP32-S3 carries 8 MB of OPI PSRAM; `psramInit()` must be called explicitly at the top of `setup()` before any ESP-SR initialisation.

**I2S API:** The new `driver/i2s_std.h` API (ESP-IDF v5 style) is used throughout — the legacy `driver/i2s.h` conflicts with ESP-SR's internal I2S usage and produces all-zero reads.

### Wake-word State Machine

Recognising short isolated commands at arbitrary moments leads to false positives. We implement a two-stage model: a **wake word** gates a short command window.

<div class="wake-word-state-machine-diagram-embed"></div>

LED feedback: "Aura" → slow triple blink; "Spray" → LED on 2 s; "Stop" → LED off immediately.

### Serial Protocol

The firmware streams structured lines for the Streamlit dashboard:

| Line | Meaning | Rate |
|------|---------|------|
| `LEVEL:xx.x` | Normalised audio amplitude (0–80) | Every DMA frame (~32 ms) |
| `WORD:word:prob` | Recognised command + confidence | On detection |
| `STATE:listening` | Wake word heard, window open | On "Aura" |
| `STATE:idle` | Command executed or window timed out | On transition |

### Challenges

**All I2S samples returned `0x00000001`.**
The ESP-SR AFE internally initialises I2S using the new driver API. When we subsequently called the legacy API's `i2s_driver_install()`, it corrupted the hardware registers, producing a constant `0x00000001` pattern. Resolution: replaced the entire I2S layer with the new `i2s_std.h` API (`i2s_chan_handle_t`, `i2s_new_channel`, `i2s_channel_read`).

**Recognition never fired despite real audio arriving.**
Even configured as MONO, the DMA buffer interleaves left and right channel slots: indices 0, 2, 4… = left (SPH0645 data); indices 1, 3, 5… = right (floating ≈ 0). The AFE therefore received the pattern L, 0, L, 0 — halving the effective sample rate to 8 kHz and breaking MultiNet's phoneme model. Resolution: allocate a 2× buffer, read 2× the expected samples, then extract only even indices before feeding the AFE.

<a id="streamlit-dashboard" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Real-time Streamlit Dashboard

`monitor/app.py` implements a live monitoring interface that requires no user interaction beyond opening the URL.

**Architecture:** Uses the `st.empty()` placeholder pattern taught in class — a single `while True` loop overwrites placeholder contents each frame without triggering a full Streamlit script rerun.

**Auto-connection:** On startup the app scans available COM ports and connects to the first one found. If the port is held by another process (e.g. Arduino IDE serial monitor), a sidebar error explains the conflict rather than showing silent zeros.

**Panels:**

| Panel | Implementation | Update rate |
|-------|---------------|------------|
| State banner | Pure HTML `<div>` | Every frame (0.4 s) |
| Audio level | HTML progress bar + CSS `transition` | Every frame — no flicker |
| Vocabulary cards | HTML — active word highlighted | Every frame |
| Line history | Plotly `go.Scatter` | Every 5 frames (2 s) |
| Recognition cards | HTML — latest command large, history compact | Every frame |
| Word frequency bar | Plotly `go.Bar` | Every 5 frames (2 s) |

The Plotly charts are updated at reduced frequency to avoid the re-render flicker that occurs when a full SVG is replaced each frame.

![Streamlit dashboard — live audio level and recognition state](images/devlog/streamlit_app.png)

<a id="pir-sensor" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="atomizer-test" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. PIR Sensor & Presence-Triggered Atomizer

### Hardware

| Component | Model |
|-----------|-------|
| MCU | Seeed Studio XIAO ESP32-S3 |
| Presence sensor | HC-SR501 PIR |
| Atomizer module | SazkJere ultrasonic atomizer + PCB (Micro USB powered) |
| Switching element | 2N2222 NPN transistor |
| Base resistor | 1 kΩ |

### Wiring

| Connection | Notes |
|------------|-------|
| PIR VCC → XIAO 3V3 | PIR supply |
| PIR GND → GND | Common ground |
| PIR OUT → GPIO4 | Presence signal input |
| GPIO5 → 1 kΩ → 2N2222 Base (middle leg) | Transistor control signal |
| 2N2222 Emitter (left leg) → GND | |
| 2N2222 Collector (right leg) → Atomizer PCB GND | Switches GND return path |
| Atomizer PCB VCC → XIAO 5V | Atomizer power |

*2N2222 orientation — flat face toward you: left = Emitter · middle = Base · right = Collector.*

![HC-SR501 PIR + 2N2222 transistor wiring](images/devlog/pirtest_wiring.png)

### HC-SR501 Configuration

| Control | Setting | Reason |
|---------|---------|--------|
| Sensitivity knob (left) | Minimum (fully CCW) | Reduces detection radius to avoid false triggers across the room |
| Delay knob (right) | Minimum (fully CCW) | Signal returns LOW quickly after person leaves, allowing fast cooldown |
| Jumper | **H** — repeat trigger | Sustains HIGH output continuously while presence remains; **L** (single trigger) caused the output to drop after ~1 s regardless of presence |

### Actuation Logic

<div class="pir-actuation-diagram-embed"></div>

The atomizer PCB includes an onboard toggle switch. Because toggling it on every cycle was unreliable, **both switch pads were soldered together (bridged)** so the PCB powers on and begins atomising whenever supply voltage is applied.

### Challenges

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| Atomizer ran constantly at power-up | GPIO logic inverted — HIGH when it should have been LOW | Swapped `HIGH`/`LOW` in firmware |
| PIR went LOW after ~1 s even with continuous presence | Jumper in **L** (single-trigger) mode | Moved jumper to **H** (repeat-trigger) |
| Progress bar reset to 26% repeatedly | Same single-trigger issue — timer cleared before 3 s elapsed | Same fix |
| Atomizer PCB internal switch interfered with control | PCB switch disconnected GND path when in OFF state | Soldered switch pads to permanently bridge |

<!-- IMAGE: atomizer misting demo (photo pending) -->

<a id="schematic-update" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="refine-cad-schematic" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. Schematic Update

The KiCAD schematic was revised to reflect this week's hardware changes:

- **SPH0645** replaces INMP441 — same I2S pins, channel selection changed to SEL = GND (left channel)
- **HC-SR501 PIR** added — signal output to GPIO4
- **2N2222 NPN transistor** replaces the MOSFET driver module for atomizer switching (lower voltage drop, simpler gate drive)

<!-- IMAGE: updated KiCAD schematic (export pending) -->

<a id="firebase" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 5. Firebase Integration

With the voice pipeline validated, we connected the ESP32 to **Firebase Realtime Database** to log spray events over Wi-Fi — laying the groundwork for a companion app and remote monitoring.

### Architecture

| Layer | Implementation |
|-------|---------------|
| Auth | Email/password fixed test account — same credentials every reboot, no anonymous user accumulation |
| Time | NTP sync via `pool.ntp.org` at boot; UTC Unix timestamp + ISO 8601 string per event |
| Push | `Firebase.RTDB.pushJSON()` → `/spray_events/<auto_id>` on every "Spray" detection |
| Decoupling | SR task (Core 1) → FreeRTOS queue → loop() (Core 0) → Firebase push; voice pipeline never blocks on network I/O |

### Event Schema

Each spray event written to `/spray_events`:

```json
{
  "command": "spray",
  "unixMs": 1776658120000,
  "iso": "2026-04-19T21:08:40Z"
}
```

### End-to-end Demo

Say **"Aura"** → say **"Spray"** within the 7-second window → LED lights, atomizer fires, and a new record appears in the Firebase Realtime Database console in real time.

The Firebase client library (`Firebase_ESP_Client` by Mobizt) runs entirely on Core 0 alongside the main loop, keeping the ESP-SR audio processing on Core 1 uninterrupted.

## Next Steps

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **Firebase Integration** | Push live sensor event data to Firebase Realtime Database. |
| <input type="checkbox" /> | **Milestone 1 Demo Fair** | Live voice + PIR demo at workstation; 10 min presentation + 5 min Q&A. |
| <input type="checkbox" /> | **Low-fi Enclosure** | Fabricate cardboard or laser-cut enclosure for demo form factor. |
| <input type="checkbox" /> | **BME680 Bring-up** | Integrate environmental sensor once Adafruit order arrives. |
