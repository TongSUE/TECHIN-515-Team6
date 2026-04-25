# AuraSync — Context-Aware Scent Diffuser

**AuraSync** automatically detects bathroom context (shower, odor, presence) via sensor fusion and triggers a fragrance diffuser at the right moment — no manual input required.

**Devlog:** [tongsue.github.io/TECHIN-515-Team6](https://tongsue.github.io/TECHIN-515-Team6/)  
**Course:** TECHIN 515 Hardware-Software Lab II, UW, Spring 2026  
**Team:** Yutong Luo (@TongSUE) · Lucia Shen (@xtshen777)

---

## Hardware

| Component | Role |
|---|---|
| Seeed XIAO ESP32-S3 | MCU — dual-core, 8 MB PSRAM, native I2S |
| Adafruit SPH0645LM4H | I2S MEMS microphone — voice recognition |
| HC-SR501 PIR | Presence detection — triggers actuation |
| Adafruit BME680 | Temp / humidity / pressure / VOC (I2C 0x77) |
| Ultrasonic atomizer + 2N2222 NPN | Fragrance mist actuation |
| MT3608 boost converter + 3.7 V LiPo | Power supply |

### Pin Assignments

| Function | Arduino Pin | GPIO |
|---|---|---|
| I2C SDA (BME680) | D4 | 5 |
| I2C SCL (BME680) | D5 | 6 |
| I2S BCLK (SPH0645) | D8 | 7 |
| I2S LRCLK (SPH0645) | D9 | 8 |
| I2S DOUT (SPH0645) | D10 | 9 |
| PIR signal (HC-SR501) | — | 4 |
| Atomizer MOSFET gate | — | 5 |
| Status LED | D0 | 21 |

> SPH0645: SEL pin → GND (left channel). Data in bits [31:14] of 32-bit I2S frame.  
> BME680: use `Wire.begin()` with no arguments — the framework maps D4/D5 by default.

---

## Repository Layout

```
Web/                          ← git root (this repo)
├── Code/
│   ├── AuraSync/             ← main firmware (two-layer state machine)
│   ├── VoiceTest/            ← ESP-SR voice recognition prototype
│   ├── FirebaseTest/         ← VoiceTest + Firebase Realtime Database
│   ├── MicTest/              ← SPH0645 bring-up / VAD test
│   ├── PIRTest/              ← PIR motion-triggered spray controller
│   ├── AtomizerTest/         ← serial 1/0 → D2 HIGH/LOW bare atomizer test
│   └── PsramTest/            ← PSRAM validation
├── KiCAD/AuraSync_v1/        ← schematic + PCB layout (KiCAD 9)
├── monitor/
│   ├── voice_monitor.py      ← real-time serial monitor (USB)
│   ├── firebase_dashboard.py ← cloud dashboard (reads Firebase, no USB needed)
│   └── requirements.txt
├── web-devlog/               ← React + Vite devlog site
└── README.md
```

---

## Flashing AuraSync (Main Firmware)

1. Open `Code/AuraSync/AuraSync.ino` in Arduino IDE
2. **Tools → Board:** Seeed XIAO ESP32-S3
3. **Tools → PSRAM:** OPI PSRAM
4. **Tools → Partition Scheme:** Huge APP (3MB No OTA / 1MB SPIFFS)
5. Copy `Code/AuraSync/partitions.csv` into the sketch folder (already present)
6. Run `Code/VoiceTest/flash_model.ps1` **once** to write ESP-SR models to flash
7. Upload `AuraSync.ino`
8. Say **"Aura"** to open the 7-second command window, then **"Spray"** or **"Stop"**; PIR presence for ≥ 3 s also triggers spray

---

## Running the Serial Voice Monitor

Streams live audio level and recognised commands from the ESP32-S3 over USB serial.

**Requirements:** Python 3.9+, ESP32-S3 flashed with `VoiceTest.ino` or `AuraSync.ino`, Arduino IDE serial monitor **closed**.

```bash
cd monitor
pip install -r requirements.txt
streamlit run voice_monitor.py
```

Opens at `http://localhost:8501`. The app auto-detects the COM port — no configuration needed.

---

## Running the Firebase Cloud Dashboard

Reads spray events from Firebase Realtime Database — no USB connection required.

```bash
cd monitor
pip install -r requirements.txt
streamlit run firebase_dashboard.py
```

Opens at `http://localhost:8502`. Supports dark/light mode toggle; auto-refreshes every 5 seconds.

---

## Flashing VoiceTest (Voice Recognition Prototype)

1. Open `Code/VoiceTest/VoiceTest.ino` in Arduino IDE
2. **Tools → Board:** Seeed XIAO ESP32-S3
3. **Tools → PSRAM:** OPI PSRAM
4. **Tools → Partition Scheme:** Huge APP (3MB No OTA / 1MB SPIFFS)
5. Run `Code/VoiceTest/flash_model.ps1` **once** to write ESP-SR models to flash
6. Upload `VoiceTest.ino`
7. Say **"Aura"** to open the 7-second command window, then **"Spray"** or **"Stop"**

---

## Firmware Overview

### `Code/AuraSync/AuraSync.ino` — Main firmware (Week 4+)

Two-layer state machine, non-blocking (`millis()` only, no `delay()` in main loop):

**Layer 1 — System Mode** (PIR-driven presence):
```
MODE_SLEEP  ──PIR detected──▶  MODE_AWAKE
MODE_AWAKE  ──60 s no PIR──▶  MODE_SLEEP
```

**Layer 2 — Spray State** (shared absolute cooldown):
```
SPRAY_IDLE → SPRAY_SPRAYING (5 s) → SPRAY_COOLDOWN (20 s test / 3 min prod) → SPRAY_IDLE
```

Four-priority trigger model: P1 voice/app (bypasses cooldown, works in SLEEP) → P2 extreme VOC < 10 kΩ (works in SLEEP, queues during cooldown) → P3 PIR + VOC inflection (AWAKE + IDLE only).

FreeRTOS dual-core: I2S + ESP-SR on Core 1 at max priority; PIR, state machine, Firebase, BME680 on Core 0. Power saving: `WiFi.setSleep(WIFI_PS_MAX_MODEM)` + Core 0 throttle in SLEEP mode (~30 mA idle from 2000 mAh LiPo ≈ 60–70 h).

### `Code/VoiceTest/VoiceTest.ino` — Voice recognition prototype

ESP-SR AFE + MultiNet v7 on FreeRTOS Core 1. Wake-word state machine:

```
IDLE → (say "Aura") → LISTENING [7 s] → (say "Spray"/"Stop") → IDLE
```

### `Code/FirebaseTest/FirebaseTest.ino` — Voice + Firebase

Extends VoiceTest: SR task (Core 1) → FreeRTOS queue → `loop()` (Core 0) → `Firebase.RTDB.pushJSON()`. Auth via database-secret legacy token; NTP time sync at boot.

---

## Devlog Site

Built with React 19 + Vite. Auto-deployed to GitHub Pages.

```bash
cd web-devlog
npm install
npm run dev       # local preview
npm run build     # production build
```
