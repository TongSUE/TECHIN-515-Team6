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
| Adafruit BME680 *(in transit)* | Temp / humidity / pressure / VOC (I2C) |
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
| Atomizer transistor base | — | 5 |
| Status LED | D0 | 21 |

> SPH0645: SEL pin → GND (left channel). Data in bits [31:14] of 32-bit I2S frame.

---

## Repository Layout

```
Web/                          ← git root (this repo)
├── Code/
│   ├── AuraSync/             ← main firmware (state machine)
│   ├── VoiceTest/            ← ESP-SR voice recognition prototype
│   ├── MicTest/              ← SPH0645 bring-up / VAD test
│   └── PsramTest/            ← PSRAM validation
├── KiCAD/AuraSync_v1/        ← schematic + PCB layout (KiCAD 9)
├── monitor/                  ← real-time Streamlit dashboard
├── web-devlog/               ← React + Vite devlog site
└── README.md
```

---

## Running the Real-time Monitor

The Streamlit dashboard streams live audio level and recognised commands from the ESP32-S3 over USB serial.

**Requirements:** Python 3.9+, ESP32-S3 flashed with `VoiceTest.ino`, Arduino IDE serial monitor **closed**.

```bash
cd monitor
pip install -r requirements.txt
streamlit run app.py
```

Opens at `http://localhost:8501`. On the same Wi-Fi, open the **Network URL** on any phone or tablet for a wireless view.

The app auto-detects the COM port — no configuration needed.

---

## Flashing VoiceTest (Voice Recognition)

1. Open `Code/VoiceTest/VoiceTest.ino` in Arduino IDE
2. Fill in your Wi-Fi credentials (search `YOUR_WIFI_SSID`)
3. **Tools → Board:** Seeed XIAO ESP32-S3
4. **Tools → PSRAM:** OPI PSRAM
5. **Tools → Partition Scheme:** Huge APP (3MB No OTA / 1MB SPIFFS)
6. Run `Code/VoiceTest/flash_model.ps1` **once** to write ESP-SR models to flash
7. Upload `VoiceTest.ino`
8. Say **"Aura"** to open the 5-second command window, then **"Spray"** or **"Stop"**

---

## Firmware Overview

### `Code/AuraSync/AuraSync.ino` — Main state machine

Non-blocking architecture (`millis()` only, no `delay()` in main loop):

```
IDLE → ML_PROCESSING → ACTUATION (2 s pump) → COOLDOWN (60 s VOC recovery) → IDLE
```

### `Code/VoiceTest/VoiceTest.ino` — Voice recognition prototype

ESP-SR AFE + MultiNet v7 on FreeRTOS Core 1. Wake-word state machine:

```
IDLE → (say "Aura") → LISTENING [5 s] → (say "Spray"/"Stop") → IDLE
```

---

## Devlog Site

Built with React 19 + Vite. Auto-deployed to GitHub Pages.

```bash
cd web-devlog
npm install
npm run dev       # local preview
npm run build     # production build
```
