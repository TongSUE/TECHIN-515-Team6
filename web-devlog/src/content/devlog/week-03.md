---
week: 3
date: "April 14 - April 20, 2026"
title: "Voice, Firebase & PIR — Build Log"
status: "In Progress"
show_next_steps: false
summary: >
  Yutong validated PSRAM and the SPH0645 microphone, built the full ESP-SR
  voice recognition pipeline with a wake-word state machine and a real-time
  serial monitor, and integrated Firebase Realtime Database with a cloud
  dashboard. Lucia wired the HC-SR501 PIR sensor to presence-trigger the
  ultrasonic atomizer and updated the project budget. The BME680 VOC sensor
  remains in transit.
credits:
  - name: Lucia
    initials: L
    tags:
      - PIR Sensor
      - Milestone Slides
      - Budget Update Form
  - name: Yutong
    initials: Y
    tags:
      - Voice Recognition
      - Firebase
      - Schematic Update
      - Devlog
prior_week_progress:
  refine-cad-schematic: true
  wifi-firebase: true
  microphone-module: true
  atomizer-test: true
planned_next:
  - id: end-to-end-integration
    label: PIR + Atomizer + Firebase End-to-End
    description: "Highest priority: merge the two validated paths — PIR trigger → atomizer spray → Firebase event write — completing the first full closed-loop pipeline."
  - id: unified-state-machine
    label: Voice + PIR Unified State Machine
    description: Merge voice commands and PIR triggers into a single state machine with defined priority (e.g. voice "stop" can interrupt a PIR-triggered spray) and concurrent conflict handling.
  - id: mobile-app
    label: Mobile App Framework
    description: Build a basic app that connects to Firebase and displays spray event history with timestamps.
  - id: bme680-bring-up
    label: BME680 Bring-up
    description: "If sensor arrives this week: validate I2C, read raw VOC/temperature/humidity, and begin collecting bathroom VOC time-series for the ML dataset."
---

## Executive Summary

This week the full sensor-to-cloud pipeline came together. Yutong validated the XIAO ESP32-S3's 8 MB OPI PSRAM (required for the ESP-SR AFE), confirmed the SPH0645 I2S microphone, and built the complete **ESP-SR v2.0 voice recognition pipeline** — wake-word state machine, FreeRTOS dual-core task split, and a real-time **Streamlit serial monitor**. He then ported the sketch to **Firebase Realtime Database**, working through three authentication approaches before landing on a database-secret legacy token, and built a companion **cloud dashboard** that polls spray events from anywhere without a USB connection. In parallel, Lucia wired the **HC-SR501 PIR presence sensor** through a 2N2222 transistor to gate the ultrasonic atomizer, delivering the first end-to-end presence-triggered spray cycle, and compiled the current hardware budget. The Adafruit BME680 VOC sensor remains delayed; bring-up is deferred to next week.

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
<a id="streamlit-dashboard" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Hardware Bring-up, Voice Recognition & Serial Monitor

### PSRAM Validation

ESP-SR's AFE (Audio Front End) allocates large audio buffers in PSRAM at initialisation — without PSRAM the AFE crashes immediately. Before committing to the full voice pipeline, we ran `PsramTest.ino` to confirm the hardware prerequisite.

The sketch calls `psramInit()`, checks `psramFound()`, reports total and free heap via `getPsramSize()` / `ESP.getFreePsram()`, and attempts a 512 KB `ps_malloc()` allocation. **Pass condition:** `psramFound()` = YES, allocation succeeds.

Result: **8,386,560 bytes (8 MB) of OPI PSRAM** confirmed available — ESP-SR can run.

> **Build note:** Tools → PSRAM must be set to **"OPI PSRAM"** in the Arduino IDE board menu. The default "Disabled" setting makes `psramFound()` return false even though the hardware is present.

### Microphone Bring-up

Before adding ESP-SR complexity, `MicTest.ino` validated the SPH0645 wiring and audio path in isolation. It uses the legacy `driver/i2s.h` API (simpler for standalone tests; `VoiceTest` switches to the new `i2s_std.h` API required by ESP-SR).

A **DC-blocking high-pass filter** (cutoff ~8 Hz, implemented as a first-order IIR) removes the SPH0645's DC bias before energy estimation. An **energy-based VAD** compares short-term energy (α = 0.03, time constant ~32 ms) against a long-term noise floor (α = 0.001, time constant ~2 s); speech is flagged when STE/LTE > 8× and held for 2 s via the onboard LED.

Result: microphone confirmed live; VAD reliably separated voice from background noise across the lab bench.

### SPH0645 I2S Microphone

The INMP441 originally specified in the schematic was replaced with the **Adafruit SPH0645LM4H breakout** (product #3421). The SPH0645 has **better performance** — higher SNR and a lower noise floor — while sharing an identical I2S pinout. The only wiring difference: SPH0645's SEL pin is tied to GND, selecting the **left channel**.

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

### ESP-SR Pipeline

**ESP-SR v2.0** (bundled with Arduino ESP32 v3.x, no separate install) provides:
- **AFE** (Audio Front End) — noise suppression + VAD; runs in PSRAM (`AFE_MEMORY_ALLOC_MORE_PSRAM`)
- **MultiNet v7** — English keyword spotter; fires on `ESP_MN_STATE_DETECTED`

Both components run on **FreeRTOS Core 1** (pinned via `xTaskCreatePinnedToCore`), keeping Core 0 free for pump, LED, and Firebase I/O.

**Partition requirement:** The ESP-SR model files live in a dedicated SPIFFS partition. A custom `partitions.csv` (app0 = 3.7 MB, model SPIFFS = 4.25 MB) is placed in the sketch folder alongside a one-time `flash_model.ps1` script that burns the model to flash. Arduino IDE board menu: **"Huge APP (3MB No OTA / 1MB SPIFFS)"**.

**Registered commands:** `aura` (wake word), `spray` (trigger atomizer), `stop`

**I2S API:** The new `driver/i2s_std.h` API (ESP-IDF v5 style) is used throughout — the legacy `driver/i2s.h` conflicts with ESP-SR's internal I2S usage and produces all-zero reads.

### Wake-word State Machine

Recognising short isolated commands at arbitrary moments leads to false positives. We implement a two-stage model: a **wake word** gates a short command window.

<div class="wake-word-state-machine-diagram-embed"></div>

The command window is **7 seconds** — 5 s proved too tight because MultiNet only runs during VAD-detected speech segments; silence gaps consume window time without advancing recognition.

LED feedback: "Aura" → slow triple blink; "Spray" → LED on 2 s; "Stop" → LED off immediately.

### Serial Protocol

The firmware streams structured lines for the serial monitor:

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

### Serial Voice Monitor

`monitor/voice_monitor.py` implements a live monitoring interface that requires no user interaction beyond opening the URL.

**Architecture:** Uses the `st.empty()` placeholder pattern — a single `while True` loop overwrites placeholder contents each frame without triggering a full Streamlit script rerun.

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

> **Looking ahead:** Once the BME680 arrives, VOC gas resistance becomes a complementary spray trigger — no wake word needed when odour spikes above a learned threshold. Longer-term, delegating voice to Apple HomeKit / Google Home / Matter APIs offloads speech recognition to proven platform infrastructure; AuraSync would only need to respond to accessory events over the local home network.

<a id="firebase" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Firebase Integration & Cloud Dashboard

### Why Firebase

The serial monitor requires a USB connection to the board. To persist spray events beyond the serial session — and prove the data pipeline end-to-end — we connected the ESP32 to **Firebase Realtime Database**. It is REST-accessible from any device, requires no custom server, and the free Spark tier is sufficient for a demo.

### Firmware Architecture

**Library:** `Firebase_ESP_Client` by Mobizt (Arduino Library Manager).

The voice recognition SR task runs on Core 1 and writes command IDs to a **FreeRTOS queue** (depth 8). `loop()` on Core 0 drains the queue and calls `pushSprayEvent()` → `Firebase.RTDB.pushJSON()`. The voice pipeline never blocks on network I/O.

### Partition Challenge

`VoiceTest.ino` alone compiles to ~1.5 MB; the Firebase client library adds ~800 KB, pushing the total to ~2.3 MB — exceeding the default 2 MB app partition.

**Error:** `"text section exceeds available space in device"` at link time.

**Fix:** The same custom `partitions.csv` used for VoiceTest (app0 = 3.7 MB) plus **Tools → Partition Scheme → "Huge APP"** in the Arduino IDE. Both changes are required simultaneously: the CSV controls the flash layout; the IDE menu controls the linker's size check.

### Authentication Journey

Getting the ESP32 authenticated took three attempts:

**Attempt 1 — Anonymous sign-in.** `Firebase.signUp("","")` creates a new anonymous user on every reboot. After a few test runs, 8+ anonymous accounts had accumulated in the Firebase Console. Dropped.

**Attempt 2 — Email/password fixed account.** Switching to a fixed test account hit `PASSWORD_LOGIN_DISABLED` (the Email/Password provider was not yet enabled in the Console). After enabling it, the next error was `INVALID_LOGIN_CREDENTIALS` — a password mismatch between the code and what had been typed in the Console.

**Attempt 3 — Database secret (legacy token).** Setting `fbConfig.signer.tokens.legacy_token` to the project's database secret bypasses GITKit authentication entirely. It works immediately, requires no user management, and is the correct pattern for an IoT device (not a human client).

### Time Sync & Event Schema

`configTime(0, 0, "pool.ntp.org")` runs at boot and blocks until `time(nullptr) > 1e9`, guaranteeing a valid UTC epoch before the first event is written.

Each spray event pushed to `/spray_events/<Firebase push ID>`:

```json
{
  "command": "spray",
  "unixMs": 1776658120000,
  "iso": "2026-04-19T21:08:40Z"
}
```

**End-to-end demo:** Say **"Aura"** → say **"Spray"** within the 7-second window → LED lights, atomizer fires, and a new record appears in the Firebase Console in real time.

### Cloud Dashboard

`monitor/firebase_dashboard.py` is a Streamlit app that reads spray events from Firebase without needing a USB connection.

**Data access:** Plain `requests.get(f"{DATABASE_URL}/spray_events.json?auth={DATABASE_SECRET}")` — no Firebase SDK or service-account JSON required. `@st.cache_data(ttl=5)` caches the response for 5 seconds; `st.rerun()` drives the auto-refresh loop.

**Timestamps** are converted to **Seattle time** (`zoneinfo.ZoneInfo("America/Los_Angeles")`).

**UI features:**
- Dark / light mode toggle via CSS custom properties + `st.session_state`
- 4 metric cards: total events, last spray time, time-since-last, sprays in last 60 min
- Cumulative step chart (area fill) — shows both frequency and total growth over time
- Hourly distribution bar chart
- Recent events list with ago-time badges
- Daily breakdown with proportional progress bars

The cumulative chart was chosen over a raw scatter plot because it simultaneously communicates frequency (slope) and total usage (height).

> **Looking ahead:** **Bi-directional app control** — an app writes `{action:"spray", executed:false}` to `/commands/<pushId>`; the ESP32 polls, executes, then marks `executed:true`. No WebSocket or persistent connection needed. **VOC decay dashboard** — once the BME680 arrives, plot gas resistance with spray markers, compute a "freshness index" (0–100 %, normalised resistance recovery), and estimate re-spray time from a fitted first-order exponential: C(t) = C_max · e^(−k·t).

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

## 5. Budget Update

| Item | Qty | Unit Price | Total |
|------|-----|-----------|-------|
| Seeed Studio XIAO ESP32-S3 | 2 | $7.49 | $14.98 |
| Adafruit BME680 | 1 | $18.95 | $18.95 |
| Adafruit MOSFET Driver | 1 | $3.95 | $3.95 |
| Mini Water Pump | 4 | $2.36 | $9.43 |
| 3.7V 2000mAh LiPo Battery | 1 | $13.06 | $13.06 |
| INMP441 Microphone Module | 3 | $3.20 | $9.59 |
| Adafruit I2S MEMS Microphone Breakout | 1 | $13.72 | $13.72 |
| DC-DC Step Up Boost Converter | 5 | $1.19 | $5.95 |
| Dupont Jumper Wires (120pcs) | 1 | $6.88 | $6.88 |
| Ultrasonic Mist Maker Ceramics Discs | 6 | $1.17 | $6.99 |
| USB Atomization Drive Circuit Board | 4 | $2.37 | $9.48 |
| **Total Spent** | | | **$113.98** |
| **Total Budget** | | | **$350.00** |
| **Remaining** | | | **$236.02** |

## Next Steps

**Week 4 Plan · April 21 – April 27, 2026**

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **PIR + Atomizer + Firebase End-to-End** | Highest priority — merge the two validated paths: PIR trigger → atomizer spray → Firebase event write. First full closed-loop pipeline. |
| <input type="checkbox" /> | **Voice + PIR Unified State Machine** | Merge voice commands and PIR triggers into one state machine with defined priority (e.g. voice "stop" interrupts a PIR-triggered spray) and concurrent conflict handling. |
| <input type="checkbox" /> | **Mobile App Framework** | Build a basic app that connects to Firebase and displays spray event history with timestamps. |
| <input type="checkbox" /> | **BME680 Bring-up** *(if arrives)* | Validate I2C, read raw VOC / temperature / humidity, and begin collecting bathroom VOC time-series for the ML dataset. |
