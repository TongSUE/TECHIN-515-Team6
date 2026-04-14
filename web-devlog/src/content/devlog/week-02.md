---
week: 2
date: "April 7 - April 13, 2026"
title: "Schematic, Firmware & ML Data Strategy"
status: "In Progress"
summary: >
  This week we built the engineering foundation: Yutong completed the KiCAD schematic with custom footprints and the ESP32-S3 firmware framework, while Lucia delivered an early 3D enclosure prototype and a full ML dataset survey.
credits:
  - name: Lucia
    initials: L
    tags:
      - CAD Modeling
      - ML Dataset Research
  - name: Yutong
    initials: Y
    tags:
      - Schematic & PCB
      - Firmware Framework
      - Devlog
prior_week_progress:
  schematic-pcb: true
  cad-modeling: true
  firmware-framework: true
  ml-deliverable: partial
planned_next:
  - id: refine-cad-schematic
    label: Refine CAD & Schematic
    description: Update the 3D enclosure with actual component dimensions; revise schematic to reflect finalized hardware (atomizer swap).
  - id: wifi-firebase
    label: WiFi & Firebase
    description: Set up WiFi on the ESP32-S3 and push mock sensor data to Firebase for cloud validation.
  - id: microphone-module
    label: Microphone Bring-up
    description: Implement basic I2S audio capture on arrival of the INMP441; verify signal quality and stream samples.
  - id: atomizer-test
    label: Atomizer Test
    description: Validate ultrasonic atomizer integration via MOSFET driver — confirm stable mist output and on/off control.
---

## Executive Summary

With hardware still in transit, we maximised parallel engineering this week. Yutong completed the **KiCAD system schematic** (with custom footprints for XIAO ESP32-S3, INMP441, and MT3608 drawn from scratch) and the **ESP32-S3 firmware skeleton** (`AuraSync.ino`): non-blocking sensor loops, a four-state state machine, and I2S + BME680 + WiFi initialization. Lucia delivered an **early 3D enclosure prototype** exploring the physical layout of the fragrance container and pump, and conducted a thorough **ML dataset survey** mapping four public datasets to our two sensing modalities.

The one deliverable still in progress is the formal ML pipeline presentation slide—the data strategy is fully defined and documented below, and will be formalised into a deck alongside hardware bring-up next week.

---

## Pre-Flight Q&A

*Instructor questions to address before the next presentation.*

### Q1 · What does "I2S" mean for our sensor?

**I²S** (Inter-IC Sound) is a 3-wire serial bus designed for transferring PCM digital audio between ICs. All three lines are unidirectional:

| Signal line | Board pin | Role |
|-------------|-----------|------|
| **BCLK** — Bit Clock | `D8` · GPIO 7 · `I2S_SCK` | One bit shifted per clock pulse. Frequency = sample rate × bit depth × channels. |
| **WS** — Word Select / LRCLK | `D9` · GPIO 8 · `I2S_WS` | LOW = left channel; HIGH = right channel. Frequency equals sample rate (16 kHz). Our INMP441 L/R → VDD, so right channel (WS = HIGH). |
| **SD** — Serial Data | `D10` · GPIO 9 · `I2S_SD` | PCM audio bitstream, MSB-first. |

**Why I2S instead of an analog mic?**
The INMP441 encodes audio as a digital bitstream at the chip itself, so what travels over the PCB is immune to EMI noise from the MT3608 switching regulator. The ESP32-S3 reads the stream directly into RAM via DMA, freeing the CPU for ML inference without any software bit-banging.

**Data format detail:** the INMP441 outputs a 24-bit sample left-aligned inside a 32-bit I2S frame. Our firmware reads 32-bit words and right-shifts by 8 to recover the signed 24-bit value before any DSP processing.

---

### Q2 · How many data points per second does our system collect?

This depends on the sensor. Since our hardware has not yet arrived, these are our *design targets*—actual values will be validated during bring-up.

**BME680 — environmental sensor**

| Parameter | Value |
|-----------|-------|
| Sample rate | **1 Hz** (one full reading per second) |
| Values per reading | 4: temperature (°C), humidity (%), pressure (hPa), gas resistance (Ω) |
| Raw data per second | **4 values** |
| 30-second ML window | ~30 sample-sets → ~60 derived gradient features (Δhumidity/Δt, ΔVOC/Δt) |

The 1 Hz limit comes from the gas-heater cycle: our firmware heats the sensor to 320 °C for 150 ms before each gas reading.

**INMP441 — I2S microphone**

| Parameter | Value |
|-----------|-------|
| Sample rate | **16,000 Hz** (16 kHz) |
| Bit depth (DMA buffer) | 32-bit frame (24-bit valid) |
| Raw data per second | ~64 KB |
| After FFT extraction | A 30-second window of 480,000 samples → compressed to O(hundreds) of frequency-domain coefficients for the ML model |

> Both figures are design targets from our firmware framework. The BME680 gas-heater duty cycle and INMP441 DMA buffer dynamics will be validated on real hardware once sensors arrive.

---

<a id="schematic-pcb" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Schematic & PCB

### Overview

The complete AuraSync v1.0 system schematic was drawn in **KiCAD 9.0**. Because none of our modules had official KiCAD library symbols or footprints, every component was drawn by hand:

- **XIAO ESP32-S3** — custom symbol with all 14 user-accessible pins labelled by pad name and GPIO number (e.g. `GPIO5_A4_D4_SDA`)
- **INMP441 breakout** — 6-pin symbol: VDD, GND, WS, SCK, SD, L/R
- **MT3608 boost module** — 4-pin symbol: VIN+, VIN−, VOUT+, VOUT−
- **N-channel MOSFET driver module** — 4-pin: Signal, V+, GND, Out+/Out−

### Key design decisions

**Power architecture:** The LiPo battery (3.7 V nominal) feeds the MT3608 boost converter, stepping up to a regulated 5 V rail for the MOSFET driver and pump. The ESP32-S3's onboard 3.3 V LDO powers all logic-level peripherals (BME680, INMP441).

**I2C addressing:** The BME680's `SDO` pin is connected to GND, fixing the I2C address to **0x76**.

**I2S channel:** The INMP441's `L/R` pin is connected to VDD (+3.3 V), selecting the **right channel** (`WS = HIGH`). The firmware `channel_format` is set accordingly to `I2S_CHANNEL_FMT_ONLY_RIGHT`.

**Pin assignments (XIAO ESP32-S3):**

| Signal | Arduino Pin | GPIO |
|--------|------------|------|
| I2C SDA | D4 | GPIO 5 |
| I2C SCL | D5 | GPIO 6 |
| I2S BCLK | D8 | GPIO 7 |
| I2S LRCLK | D9 | GPIO 8 |
| I2S Data | D10 | GPIO 9 |
| Pump Signal | D3 | GPIO 4 |

### Schematic

![AuraSync v1.0 System Schematic](images/devlog/schematic_v1.png)

*AuraSync v1.0 KiCAD schematic — custom footprints for all four modules.*

---

<a id="cad-modeling" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. CAD Modeling & Prototyping

### Early 3D prototype

Lucia created an early-stage 3D enclosure prototype to explore the physical layout before committing to PCB dimensions. The model serves two goals:

1. **Spatial layout validation** — positioning the fragrance reservoir and water pump relative to the electronics to identify integration constraints (pump outlet clearance, cable routing).
2. **Form factor intuition** — giving the team a sense of the device's physical presence before the first fabrication attempt.

Key observations from the prototype:

- The pump outlet orientation requires the reservoir to sit at the same level or above, not below, to maintain suction prime.
- The BME680 needs an exposed vent path to sample ambient air rather than recirculated interior air.
- The XIAO ESP32-S3's USB-C port should remain externally accessible for flashing.

### Planned refinements

Once PCB dimensions are locked and the atomizer module arrives (replacing the original pump for mist output), the enclosure will be re-modelled with precise mounting constraints and toleranced slots for sensor vents.

---

<a id="firmware-framework" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. Firmware Framework

### Architecture

The `AuraSync.ino` firmware skeleton (`Code/AuraSync/AuraSync.ino`) implements a fully non-blocking scaffold:

**`setup()`**

- `Serial.begin(115200)`
- `PIN_PUMP` → OUTPUT, LOW (safety-first)
- `connectWiFi()` — 15 s timeout, offline fallback
- `Wire.begin(GPIO5, GPIO6)` — I2C for BME680
- `initBME680()` — 8×/2×/4× oversampling + IIR filter
- `initI2S()` — 16 kHz, 32-bit, right channel, DMA ×4

**`loop()` — zero `delay()` calls**

- `readBME680()` — millis-throttled, 1 Hz
- `readI2SAudio()` — non-blocking `i2s_read(timeout=0)`
- `updatePumpState()` — 2 s shutoff via millis comparison
- `runStateMachine()` — IDLE → ML_PROCESSING → ACTUATION → COOLDOWN

### State machine

Four states implemented with `enum SystemState` and a `switch-case` dispatcher:

| State | Entry condition | Exit condition |
|-------|----------------|----------------|
| `IDLE` | Default / cooldown expired | Sensor slope exceeds threshold |
| `ML_PROCESSING` | Slope trigger fired | Confidence ≥ 70 % → ACTUATION; else → IDLE |
| `ACTUATION` | `triggerPump()` called | 2 s elapsed → COOLDOWN |
| `COOLDOWN` | Pump shutoff | 60 s elapsed → IDLE |

### DSP placeholder functions

Three placeholder functions are stubbed and documented for the Edge Impulse integration:

- `computeHumiditySlope()` — returns Δhumidity / Δt (%/s)
- `computeVOCSlope()` — returns Δgas_resistance / Δt (Ω/s)
- `analyzeAudioEnergy()` — computes RMS from the 32-bit DMA buffer; FFT hook noted in comments

### Non-blocking pump control

The pump's 2-second active period is entirely non-blocking. `triggerPump()` sets `pumpActive = true` and records `pumpStartTime = millis()`. On every `loop()` call, `updatePumpState()` checks `millis() - pumpStartTime ≥ 2000` and shuts the MOSFET off—no `delay()` anywhere in the main loop.

---

<a id="ml-deliverable" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 4. ML Dataset Research

### Dataset survey

With sensors in transit, Lucia conducted a systematic public dataset survey to identify sources that can seed the training pipeline before our own recordings are available.

**Audio modality (INMP441 microphone)**

| Dataset | Relevant features | Role |
|---------|------------------|------|
| [ESC-50](https://github.com/karoldvl/ESC-50) | Water pouring, rain, dripping, toilet flush | Baseline audio classifier; initial training for water-event detection |
| [AudioSet (Google)](https://research.google.com/audioset/) | Water tap, liquid sounds, indoor ambient | Diversity augmentation; improves robustness in real-world environments |

**Environmental modality (BME680 sensor)**

| Dataset | Relevant features | Role |
|---------|------------------|------|
| [Indoor Air Quality – hemanthkarnati](https://www.kaggle.com/datasets/hemanthkarnati/indoor-air-quality-dataset) | Humidity, temperature, gas/VOC, CO₂ | Learn normal vs. active patterns; simulate BME680 behavior |
| [IoT Indoor Air Quality – khajaahmed1](https://www.kaggle.com/datasets/khajaahmed1/iot-indoor-air-quality) | Humidity, temperature, air quality index | Context classification; detect state transitions |

### Hybrid data strategy

Existing datasets cover the modalities but not the *context*—none were recorded in small bathroom environments with our specific acoustic and VOC dynamics. Our proposed strategy:

1. **Phase 1 (now):** Pre-train on ESC-50 + AudioSet for audio; Kaggle IAQ datasets for environmental baselines.
2. **Phase 2 (Week 3–4):** Collect labelled recordings in realistic bathroom scenarios once hardware arrives. Fine-tune Phase 1 models on domain-specific data.
3. **Phase 3:** Merge audio features (FFT frequency bands) with environmental gradients (ΔH/Δt, ΔVOC/Δt) into a single feature vector for the Edge Impulse classifier.

### Core insight

> Shower is not a single sensor label—it is a **conjunction of signals**: steep positive humidity slope + water-flow audio energy + no VOC spike. This multi-modal fusion is what distinguishes our system from simple threshold triggers and makes the dataset combination strategy necessary.

The formal pipeline presentation slide is being finalised and will be presented in Week 3.

---

## Next Steps

Hardware is expected to arrive next week, so our focus shifts to bring-up and integration:

| Todo | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **Refine CAD & Schematic** | Update the 3D enclosure with actual component dimensions; revise schematic to reflect the atomizer swap. |
| <input type="checkbox" /> | **WiFi & Firebase** | Set up WiFi on the ESP32-S3 and establish a connection to Firebase for basic data transmission. |
| <input type="checkbox" /> | **Microphone Bring-up** | With the microphone arriving, implement basic I2S audio input and verify signal capture. |
| <input type="checkbox" /> | **Atomizer Test** | Test the ultrasonic atomizer module and verify integration with the ESP32-S3 via MOSFET driver. |