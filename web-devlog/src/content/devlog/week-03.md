---
week: 3
date: "April 14 - April 20, 2026"
title: "Voice, Firebase & PIR — Build Log"
status: "In Progress"
show_next_steps: true
summary: >
  Yutong validated PSRAM and the SPH0645 microphone, built the full ESP-SR
  voice recognition pipeline with a wake-word state machine and a real-time
  serial monitor, integrated Firebase Realtime Database with a cloud dashboard,
  and updated the KiCAD schematic to v2.0. Lucia wired the HC-SR501 PIR sensor
  to presence-trigger the ultrasonic atomizer, prepared the Milestone 1 slides,
  and submitted the budget update form. The BME680 VOC sensor remains in transit.
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

Two validated hardware paths, a live cloud pipeline, and the first end-to-end spray cycle.

- **PSRAM & mic validation** — Confirmed 8 MB OPI PSRAM (required for ESP-SR AFE); brought up SPH0645 with energy-based VAD in isolation before integrating the full pipeline.
- **Voice recognition** — Built complete ESP-SR v2.0 pipeline: AFE noise suppression + MultiNet v7 keyword spotter, wake-word state machine ("Aura" → 7 s command window), FreeRTOS dual-core split. Debugged two non-obvious I2S issues (API conflict; DMA interleave).
- **Serial voice monitor** — Real-time Streamlit dashboard (`voice_monitor.py`) streams audio level, recognised commands, and state over USB serial — no user interaction needed.
- **Firebase integration** — Connected ESP32 to Firebase Realtime Database; worked through three authentication approaches before landing on database-secret legacy token. Every "Spray" command writes a timestamped event to `/spray_events`.
- **Cloud dashboard** — `firebase_dashboard.py`: polls Firebase via REST, no SDK, dark/light mode, 5-second auto-refresh, spray history charts.
- **PIR + atomizer** — Lucia wired HC-SR501 through a 2N2222 NPN transistor; first end-to-end presence-triggered spray cycle confirmed.
- **BME680** — Still in transit; bring-up deferred to Week 4.

## Mentor Meeting

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

The build followed a deliberate bottom-up sequence: verify the hardware prerequisite (PSRAM), confirm the microphone works in isolation, then layer the full ESP-SR voice pipeline on top. This way, each step has a clear pass/fail gate before adding the next layer of complexity.

### PSRAM Validation

ESP-SR's AFE (Audio Front End) allocates large audio buffers in PSRAM at initialisation — without PSRAM the AFE crashes immediately. Before committing to the full voice pipeline, we ran `PsramTest.ino` to confirm the hardware prerequisite.

The sketch calls `psramInit()`, checks `psramFound()`, reports total and free heap via `getPsramSize()` / `ESP.getFreePsram()`, and attempts a 512 KB `ps_malloc()` allocation. **Pass condition:** `psramFound()` = YES, allocation succeeds.

> **Result:** 8,386,560 bytes (8 MB) of OPI PSRAM confirmed available — ESP-SR can run.

> **Build note:** Tools → PSRAM must be set to **"OPI PSRAM"** in the Arduino IDE board menu. The default "Disabled" setting makes `psramFound()` return false even though the hardware is present.

---

### Microphone Bring-up

PSRAM confirmed — the next question was whether the microphone itself was producing valid audio. Rather than debug hardware and software simultaneously inside the full ESP-SR pipeline, we wrote a standalone `MicTest.ino` to validate the SPH0645 wiring and audio path first. It uses the legacy `driver/i2s.h` API (simpler for standalone tests; `VoiceTest` switches to the new `i2s_std.h` API required by ESP-SR).

A **DC-blocking high-pass filter** (cutoff ~8 Hz, implemented as a first-order IIR) removes the SPH0645's DC bias before energy estimation. An **energy-based VAD** compares short-term energy (α = 0.03, time constant ~32 ms) against a long-term noise floor (α = 0.001, time constant ~2 s); speech is flagged when STE/LTE > 8× and held for 2 s via the onboard LED.

> **Result:** Microphone confirmed live; VAD reliably separated voice from background noise across the lab bench.

---

### SPH0645 I2S Microphone

Before describing the bring-up results, a note on the hardware itself: the microphone used is not the INMP441 originally in the schematic. The INMP441 originally specified in the schematic was replaced with the **Adafruit SPH0645LM4H breakout** (product #3421). The SPH0645 has **better performance** — higher SNR and a lower noise floor — while sharing an identical I2S pinout. The only wiring difference: SPH0645's SEL pin is tied to GND, selecting the **left channel**.

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

---

### ESP-SR Pipeline

With PSRAM confirmed and the microphone producing clean audio, we could move to the actual voice recognition layer. `VoiceTest.ino` integrates both into Espressif's ESP-SR framework to add wake-word detection and command recognition on top of the validated audio path.

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

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| All I2S samples returned `0x00000001` | ESP-SR AFE initialises I2S internally via the new driver API; calling the legacy `i2s_driver_install()` after that corrupted the hardware registers | Replaced the entire I2S layer with `i2s_std.h` (`i2s_chan_handle_t`, `i2s_new_channel`, `i2s_channel_read`) |
| Recognition never fired despite audible input | DMA buffer interleaves L/R slots even in MONO config — AFE received L, 0, L, 0, effectively halving the sample rate to 8 kHz and breaking MultiNet's phoneme model | Allocate a 2× buffer, read 2× samples, then extract only even-indexed frames before passing to the AFE |

---

### Serial Voice Monitor

The voice pipeline was now functional, but observing it meant reading raw serial output in the Arduino IDE — a stream of `LEVEL:xx.x`, `WORD:spray:0.87`, and `STATE:listening` lines mixed together and impossible to parse at a glance. We built `monitor/voice_monitor.py` as a live Streamlit dashboard to make the system's state immediately readable during testing.

`monitor/voice_monitor.py` implements a live monitoring interface that requires no user interaction beyond opening the URL.

![AuraSync Voice Monitor — SPRAY state active, live audio level and vocabulary cards](images/devlog/voice_test_streamlit_app.png)

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

<video controls muted playsinline style="width:100%;border-radius:0.5rem;margin-bottom:0.75rem">
  <source src="images/devlog/voice_monitor_test.mp4" type="video/mp4" />
</video>

> **Looking ahead:** Once the BME680 arrives, VOC gas resistance becomes a complementary spray trigger — no wake word needed when odour spikes above a learned threshold. Longer-term, delegating voice to Apple HomeKit / Google Home / Matter APIs offloads speech recognition to proven platform infrastructure; AuraSync would only need to respond to accessory events over the local home network.

<a id="firebase" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. Firebase Integration & Cloud Dashboard

### Why Firebase

The voice pipeline was fully functional, but every spray event existed only in RAM — once the board was unplugged or reset, the data was gone. The serial monitor also required a physical USB cable to observe anything. To prove the data pipeline end-to-end and make events accessible remotely, the next step was adding persistent cloud storage.

We chose **Firebase Realtime Database** because it is REST-accessible from any device, requires no custom server, and the free Spark tier is sufficient for a demo. It is REST-accessible from any device, requires no custom server, and the free Spark tier is sufficient for a demo.

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

> **Key takeaway:** IoT devices should not authenticate as human users. A database secret (or a service-account key with restricted rules) is the right primitive — no session management, no password rotation, no anonymous user accumulation.

### Event Schema

Each spray event pushed to `/spray_events/<Firebase push ID>`:

```json
{
  "command": "spray",
  "unixMs": 1776658120000,
  "iso": "2026-04-19T21:08:40Z"
}
```

> **End-to-end demo:** Say **"Aura"** → say **"Spray"** within the 7-second window → LED lights, atomizer fires, and a new record appears in the Firebase Console in real time.

![Firebase Realtime Database — spray_events with push IDs, command, iso timestamp, and unixMs](images/devlog/firebase_test.png)

### Cloud Dashboard

With events persisting in Firebase, the last piece was a way to view them without opening the Firebase Console. We wanted the same zero-friction experience as the serial monitor — open a URL, see live data. `monitor/firebase_dashboard.py` is a Streamlit app that pulls spray events from Firebase via REST and displays them without needing a USB connection.

**Data access:** Plain `requests.get(f"{DATABASE_URL}/spray_events.json?auth={DATABASE_SECRET}")` — no Firebase SDK or service-account JSON required. `@st.cache_data(ttl=5)` caches the response for 5 seconds; `st.rerun()` drives the auto-refresh loop.

**UI features:**
- Dark / light mode toggle via CSS custom properties + `st.session_state`
- 4 metric cards: total events, last spray time, time-since-last, sprays in last 60 min
- Cumulative step chart (area fill) — shows both frequency and total growth over time
- Hourly distribution bar chart
- Recent events list with ago-time badges
- Daily breakdown with proportional progress bars

The cumulative chart was chosen over a raw scatter plot because it simultaneously communicates frequency (slope) and total usage (height).

![AuraSync Cloud Dashboard — 5 sprays recorded, cumulative chart and hourly breakdown](images/devlog/firebase_test_streamlit_app.png)

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

<video controls muted playsinline style="width:100%;border-radius:0.5rem;margin-bottom:0.75rem">
  <source src="images/devlog/pir_test.mp4" type="video/mp4" />
</video>

<a id="schematic-update" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>
<a id="refine-cad-schematic" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. Schematic Update

The KiCAD schematic was updated to **Rev v2.0** to reflect this week's hardware changes:

- **U4 SPH0645\_Mic** replaces the INMP441 — same I2S pin assignments (BCLK → GPIO7, LRCL → GPIO8, DOUT → GPIO9); SEL tied to GND to select the left channel
- **U2 HC-SR501 PIR** added — VCC → 3V3, GND → GND, OUT → GPIO4 (Signal)
- **J2 Battery connector** added as a dedicated 2-pin symbol (BATT+ / BATT−) for the LiPo input
- U1 BME680, U3 MOSFET driver, U5 MT3608 boost, and all power rails remain unchanged from v1.0

![AuraSync v2.0 Schematic — SPH0645 mic, HC-SR501 PIR, BME680, MT3608 boost, MOSFET driver, battery connector](images/devlog/schematic_v2.png)

*AuraSync v2.0 KiCAD schematic — Rev v2.0, 2026-04-20.*

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

With both hardware paths validated and the cloud pipeline live, Week 4 shifts from bring-up to integration — merging the two control loops, adding app connectivity, and onboarding the BME680 once it arrives.

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **PIR + Atomizer + Firebase End-to-End** | Highest priority — merge the two validated paths: PIR trigger → atomizer spray → Firebase event write. First full closed-loop pipeline. |
| <input type="checkbox" /> | **Voice + PIR Unified State Machine** | Merge voice commands and PIR triggers into one state machine with defined priority (e.g. voice "stop" interrupts a PIR-triggered spray) and concurrent conflict handling. |
| <input type="checkbox" /> | **Mobile App Framework** | Build a basic app that connects to Firebase and displays spray event history with timestamps. |
| <input type="checkbox" /> | **BME680 Bring-up** *(if arrives)* | Validate I2C, read raw VOC / temperature / humidity, and begin collecting bathroom VOC time-series for the ML dataset. |
