---
week: 5
date: "April 28 - May 4, 2026"
title: "Data Collection, First ML Pipeline & BSEC2 Firmware"
status: "In Progress"
show_next_steps: true
summary: >
  The team collected approximately 3 days of continuous BME680 data from a home
  bathroom (14 sessions, 10 000+ readings at 10 s intervals) and built a full
  end-to-end ML pipeline: a Random Forest IAQ classifier (Macro F1 0.77) and a
  1D-CNN shower event detector (Val F1 0.77, AUC 0.94). A key discovery — raw
  gas resistance baseline drift after strong VOC exposure — prompted a firmware
  upgrade from the Adafruit BME680 driver to Bosch BSEC2, which provides a
  self-calibrating IAQ index (0–500) and survives multi-day drift without manual
  normalisation.
credits:
  - name: Lucia
    initials: L
    tags:
      - Data Collection
      - ML Pipeline
      - BSEC2 Firmware
  - name: Yutong
    initials: Y
    tags:
      - Mobile App
      - Devlog
prior_week_progress:
  bme680-firmware: true
  voc-pattern-detection: "partial"
  voc-baseline: true
  firebase-reverse: false
planned_next:
  - id: annotated-shower-data
    label: Annotated Shower Data Collection
    description: "Collect 5+ shower sessions with BSEC2, annotate start/end times manually, and append to shower_annotations.csv — target: ≥150 positive windows for retraining."
  - id: retrain-shower-model
    label: Retrain Shower CNN with BSEC2 Data
    description: Replace gas_norm pipeline with calibrated iaq + iaq_accuracy ≥ 1 filter; retrain 1D-CNN; target Val F1 ≥ 0.85 on a proper held-out test set.
  - id: firebase-reverse
    label: Firebase Reverse Control
    description: "App writes to /commands/action; ESP32 polls every 3 s, executes spray, and clears the node — bi-directional control without WebSocket."
  - id: extreme-case-testing
    label: Extreme Case VOC Testing
    description: "Perfume, air freshener, cleaning products — test IAQ spike magnitude, recovery time, and edge cases for the classifier (compound events, high-humidity baseline days)."
---

## Mentor Meeting

*We connected with our project mentor Justin again this week.*

<div class="mentor-card-embed"></div>

Justin gave us five concrete pieces of feedback:

**1 · ML edge-case coverage**
When building ML models, it's important to account for extreme cases that the sensor will encounter in real life — someone entering briefly without using the toilet, back-to-back users, VOC spikes from cleaning products or soap (not odour-related), and the noisy warm-up window right after the device boots. We need a systematic test suite to verify the model does not misfire in these scenarios.

**2 · App remote trigger (pre-spray)**
When no one is in the bathroom, a user should be able to trigger a spray from the app in advance — for example, just before entering. The Firebase reverse-control feature already in our backlog addresses this directly; Justin recommended prioritising it.

**3 · PCB and enclosure co-design**
PCB layout should happen in parallel with enclosure design, not after. Specifically: screw holes and snap-fit points for mounting each sensor, a ventilation opening for the BME680 (it must contact ambient air), PIR field-of-view and angle, and connector/trace positions that are not obscured by the shell walls.

**4 · Smaller PIR sensor**
The HC-SR501 is bulky for a compact enclosure. Justin suggested switching to a smaller module such as the **AM312**, which has a much smaller footprint and is better suited for the final form factor.

> [AM312 Mini Pyroelectric PIR on Amazon](https://www.amazon.com/HiLetgo-Pyroelectric-Sensor-Infrared-Detector/dp/B07RT7MK7C/ref=sr_1_5?crid=TWL9YZ1T5VSM&dib=eyJ2IjoiMSJ9.l1xKrNlnzEthz1oRjEpGYT8CihWAyuwJTb89TiNx1Mm0Q51JTMCSAW7ZHh4v0hPP7ZNXtp8_59dRTvwixmbeX0Fe14uw1TeO9mm5TWhNbvjUsYQBK4L_TxCijl69Q1IBpJyNwJ6iB3UO2rGH0YyvzX2LsYJolBoKuudWQIte7b8LyjgFtpjhw3ocRsv14HR4tn3-66SfWjp42oqY92pq0GpFVG_hWluqajOa1xAmJdHeq1MxVUAgvDG03wGdbeu5kcRwuPWostLJgfXAcxa2MvQyGkRoKlyLvXBw81cBqzs.NFvSE8Vvaa9xcc0Blp5dKBWsKA1565p8HRNywZMI6pA&dib_tag=se&keywords=AM312+Mini+Pyroelectric&qid=1777671054&sprefix=am312+mini+pyroelectric+%2Caps%2C145&sr=8-5)

**5 · 3.3 V → 5 V boost converter**
The ultrasonic atomizer requires 5 V, while the ESP32-S3 runs at 3.3 V. Justin suggested evaluating compact boost converter modules. We already have an **MT3608** on hand (already listed in the BOM) — a well-suited choice. He also pointed to the **XL6002** as a compact alternative if we need to integrate the converter directly onto the PCB.

> [XL6002 Boost Converter Module on Amazon](https://www.amazon.com/EC-Buying-XL63020-3-3-XL63020-3-3V-Microcontroller/dp/B0D8T3J8QZ/ref=sxin_17_pa_sp_search_thematic_sspa?content-id=amzn1.sym.9a3e287f-4954-410d-ad08-8ae28dc40a36%3Aamzn1.sym.9a3e287f-4954-410d-ad08-8ae28dc40a36&crid=SHWVWJAWK9ND&cv_ct_cx=boost+convertor&keywords=boost+convertor&pd_rd_i=B0D8T3J8QZ&pd_rd_r=4bbd85b6-dcdf-462b-bb9f-4f481078cf7a&pd_rd_w=uSpOG&pd_rd_wg=Fsrx1&pf_rd_p=9a3e287f-4954-410d-ad08-8ae28dc40a36&pf_rd_r=G2JKQSXNVKTV496J0RCP&qid=1777670940&s=electronics&sbo=RZvfv%2F%2FHxDF%2BO5021pAnSA%3D%3D&sprefix=boost+convertor%2Celectronics%2C161&sr=1-1-6e60e730-e094-43e9-99e8-1a4854cd27ff-spons&aref=JRGHB5aJmx&sp_csd=d2lkZ2V0TmFtZT1zcF9zZWFyY2hfdGhlbWF0aWM&psc=1)

<div class="special-thanks-card-embed"></div>

## Executive Summary

Three parallel tracks this week, all centred on closing the loop from raw sensor data to trained models.

- **Data collection** — Lucia deployed the ESP32-S3 + BME680 in a home bathroom and collected 3 days of continuous data: 14 sessions fetched from Firebase, 10 successfully preprocessed (16 927 stable readings at 10 s intervals).
- **ML pipeline** — An end-to-end pipeline was built from raw Firebase data to two trained models: a Random Forest IAQ classifier (CV Macro F1 **0.77 ± 0.17**, 5-fold GroupKFold) and a 1D-CNN shower event detector (Val F1 **0.77**, precision **0.97**, ROC-AUC **0.94**).
- **BSEC2 firmware upgrade** — A critical discovery about gas resistance drift motivated a firmware upgrade to the Bosch BSEC2 library, which outputs a self-calibrating IAQ index (0–500) that handles multi-day baseline drift without manual normalisation.

<a id="data-collection" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 1. Data Collection

The Seeed XIAO ESP32-S3 + BME680 sensor was deployed in a home bathroom and collected approximately **3 days of continuous data** (April 29 – May 2, Seattle time). 14 sessions were fetched from Firebase; 10 passed preprocessing (4 had corrupted NTP timestamps and were discarded), yielding **16 927 stable readings** at 10 s intervals.

| Split | Sessions | Readings | Annotated showers |
|---|---|---|---|
| Train | 6 | 9 184 | 1 |
| Val | 1 | 1 461 | 2 |
| Test | 2 | 6 046 | 0 |

> Sessions are split at the session level, not the reading level, to prevent data leakage across time.

### Deployment

To protect the bare breadboard circuit from bathroom moisture and condensation, the entire assembly was wrapped in **cling film** before each deployment — a quick prototyping solution that proved effective for multi-day unattended operation.

![Breadboard with ESP32-S3 and BME680 wrapped in cling film for waterproofing](images/devlog/water-proof.jpg "The breadboard assembly wrapped in cling film to protect exposed circuitry from humidity and water vapour during bathroom deployment")

Data collection happened in two locations. We first spent an afternoon collecting in the **GIX building bathroom** to get an initial real-world baseline, with a sticky note on the box asking passersby not to disturb the device.

![Sensor deployed in the GIX building bathroom on a cardboard box, with sticky notes reading "Collecting Data — Please don't touch" and "Anything wrong, please contact Lucia / Yutong"](images/devlog/collecting-in-gix.jpg "First field deployment at GIX — breadboard on a cardboard box on the bathroom counter, with a note to discourage interference")

Lucia then brought the device home and ran it continuously for several days, collecting the **bulk of the dataset** with natural VOC variation from daily routines.

![Sensor deployed in home bathroom on the sink counter, with cling-film-wrapped breadboard and USB cable visible](images/devlog/collecting-in-home.jpg "Home bathroom deployment — multi-day continuous data collection on the sink counter")

Each reading contains: `temp_c`, `humidity_pct`, `pressure_hpa`, `gas_ohm`, `elapsed_s`, `unix_ms`, `iso`, `heater_stable`.

### Key Observation — Gas Baseline Drift

After spraying a strong VOC activator at school, the `gas_ohm` baseline permanently drifted from ~50 kΩ down to ~30 kΩ, then slowly recovered over several days. Using raw gas resistance values as ML features is therefore unreliable across sessions — motivating both the normalisation approach in Phase 2 and the BSEC2 upgrade in Phase 3.

<a id="ml-pipeline" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 2. First ML Pipeline

An end-to-end ML pipeline was built from Firebase data to trained models.

### Data Preprocessing

All sessions were exported from Firebase to CSV via `fetch_firebase.py`. Readings with `heater_stable=False` (first ~120 s per session) were discarded. To handle the gas resistance baseline drift, a **sliding-window baseline normalisation** was applied:

$$\text{gas\_norm}_t = \frac{\text{gas\_ohm}_t - \text{baseline}_t}{\text{baseline}_t}, \quad \text{baseline}_t = \max(\text{gas\_ohm}_{t-120:t})$$

The 20-minute rolling maximum window is long enough to survive shower events without being corrupted. The plot below shows a 9-hour training session: `gas_ohm` drifts upward as the sensor warms over the night, while `gas_norm` stays near zero (clean air) and spikes negative only during actual events.

![gas_ohm vs gas_norm for session 20260502-082315 — 9 hours of overnight bathroom data showing how the normalised signal remains stable while raw resistance drifts upward](images/devlog/ml_gas_norm_session.png "Top: raw gas resistance (Ω) rising as sensor self-calibrates overnight. Bottom: gas_norm baseline-normalised signal, flat near zero between events and spiking negative during odour events")

**8 features** were engineered per reading:

| Feature | Description |
|---|---|
| `temp_c` | Raw temperature (°C) |
| `humidity_pct` | Raw humidity (%) |
| `gas_norm` | Baseline-normalised gas resistance (relative) |
| `gas_min_10m` | 10-minute rolling minimum of `gas_norm` |
| `gas_delta_5m` | 5-minute rate-of-change of `gas_norm` |
| `humidity_max_10m` | 10-minute rolling maximum of humidity |
| `humidity_delta_5m` | 5-minute rate-of-change of humidity |
| `temp_delta_5m` | 5-minute rate-of-change of temperature |
| `hour_sin`, `hour_cos` | Cyclical time-of-day encoding |

> The rolling statistics capture trend direction; the sinusoidal time features let the model distinguish morning from evening baseline shifts without treating hour as a linear feature.

**IAQ labels** are assigned by rule (no manual annotation):
- **Good**: `gas_norm > −0.15` AND `humidity < 65 %` AND `temp < 27 °C`
- **Poor**: `gas_norm < −0.40` OR `humidity > 80 %`
- **Moderate**: everything else

Dataset composition: **15 964 Good (96.5 %)** / **473 Moderate (2.9 %)** / **110 Poor (0.7 %)**.

### Task 1 — IAQ Classification (Good / Moderate / Poor)

| | |
|---|---|
| **Model** | Random Forest, `n_estimators=200`, `max_depth=10`, `class_weight='balanced'` |
| **Validation** | 5-fold GroupKFold CV by session — prevents leakage across continuous time |
| **CV Macro F1** | **0.771 ± 0.165** |
| **Test Macro F1** | **0.667** (test sessions had no "Poor" samples) |

The bar chart below shows each fold's Macro F1. Fold 1 reaches 1.0 (the val fold happened to contain balanced classes); Fold 2 scores 0.58 because its val sessions had very few Moderate/Poor readings. GroupKFold variance is expected with such extreme class imbalance.

![5-fold GroupKFold CV results for IAQ Random Forest — bar chart of per-fold Macro F1 scores with mean and ±1 std band](images/devlog/ml_iaq_cv.png "5-fold GroupKFold cross-validation: F1 = [1.00, 0.58, 0.67, 0.67, 0.94], mean 0.77 ± 0.17")

The confusion matrix (test set) shows perfect separation between Good and Moderate — the classifier never confuses the two, though the test set contained no Poor samples.

![IAQ Random Forest confusion matrix on the test set — 1178 Good correct, 28 Moderate correct, 0 Poor samples present](images/devlog/ml_iaq_confusion.png "Test set: 1178 Good correctly classified, 28 Moderate correctly classified. Poor class absent from test sessions.")

Feature importance confirms domain knowledge: `gas_norm` accounts for **36 %** of split gain, followed by its rolling statistics (`gas_min_10m`, `gas_delta_5m`). The time-of-day features (`hour_sin`) rank 4th, reflecting the fact that baseline humidity rises predictably in the evenings.

![RF feature importances (top 8) — gas_norm dominates at 0.36, followed by gas_min_10m at 0.18, gas_delta_5m at 0.12](images/devlog/ml_iaq_features.png "Top-8 feature importances: gas_norm 0.36 > gas_min_10m 0.18 > gas_delta_5m 0.12 > hour_sin 0.09 > humidity_pct 0.09 > humidity_max_10m 0.06")

### Task 2 — Shower Event Detection

**Approach:** sliding-window binary classification — each 5-minute window (30 readings) is classified as shower or not. Stride is 50 s (5 readings), so windows overlap heavily and the detector can flag the start of an event within one stride.

**CNN architecture** (PyTorch, trained on NVIDIA RTX 4060 Laptop GPU):

![1D-CNN architecture for shower detection — Input 30×6 → Conv1d 6→32 → ReLU → Conv1d 32→64 → ReLU → AdaptiveAvgPool1d → Linear 512→32 → sigmoid output](images/devlog/ml_cnn_arch.png "Architecture: Input(30×6) → Conv1d(k=5, 32ch) → Conv1d(k=3, 64ch) → AvgPool(8) → FC(512→32) → FC(32→1, sigmoid). Dropout 0.3 before final layer.")

| | Train | Val |
|---|---|---|
| **Total windows** | 1 831 | 285 |
| **Shower (positive)** | 96 | 115 |
| **Non-shower** | 1 735 | 170 |

Training used 4× augmentation on positive windows (Gaussian jitter σ=0.05 + magnitude scaling ±10 %) to partially compensate for the extreme positive class scarcity. The val set has proportionally more shower windows because the annotated val session spans two shower events.

**Results @ threshold = 0.70:**

![1D-CNN shower detection per-class precision, recall, and F1 on the val set — Shower precision 0.97, recall 0.63, F1 0.77; No-Shower precision 0.80, recall 0.99, F1 0.88](images/devlog/ml_shower_report.png "Val set (285 windows): Shower precision=0.97, recall=0.63, F1=0.77 (n=115). No-Shower precision=0.80, recall=0.99, F1=0.88 (n=170). Accuracy=85%.")

The high precision (0.97) means nearly every window the model flags as a shower is a real shower. The lower recall (0.63) means the model misses some shower windows — which is the safer failure mode for our use case (a missed spray is less intrusive than a false spray).

| Metric | Value |
|---|---|
| Val F1 (shower class) | **0.755** |
| Val accuracy | **85 %** |
| ROC-AUC | **0.94** |
| Test F1 | 0.0 (no shower annotations in test sessions — test set is not yet evaluable) |

**Limitation:** only 3 annotated shower events total (96 positive windows before augmentation). The test F1 of 0.0 reflects the absence of shower annotations in the test sessions — a proper generalisation estimate requires collecting and annotating 5+ additional shower sessions.

<a id="bsec2-firmware" style="display:block;height:0;overflow:hidden;scroll-margin-top:7rem"></a>

## 3. BSEC2 Firmware Upgrade

### Problem

The manual 20-minute rolling-max baseline cannot handle multi-day drift. A fundamental fix requires the sensor's baseline to be managed by a proper calibration algorithm at the firmware level.

### Solution: Bosch BSEC2

The firmware was upgraded from the Adafruit BME680 driver to **Bosch-BSEC2-Library** (ESP32-S3 compatible). BSEC2 runs short-term and long-term background calibration models simultaneously, outputting a normalised **IAQ index (0–500)** that is self-calibrating and environment-independent.

### New Firebase Fields

| Field | Description |
|---|---|
| `iaq` | Calibrated IAQ index, 0–500 |
| `iaq_accuracy` | Calibration quality: 0 = unreliable → 3 = fully calibrated |
| `temp_c` | Heat-source compensated temperature |
| `humidity_pct` | Heat-source compensated humidity |

> `static_iaq`, `co2_eq_ppm`, `breath_voc_ppm` require BSEC2 Extended (paid). All three are derived from `gas_ohm` — no independent ML information is lost by omitting them.

### Deployment Challenges

| Issue | Fix |
|---|---|
| `libalgobsec` missing for ESP32-S3 | Switched to Bosch-BSEC2-Library (includes S3 pre-built binary) |
| Linker crash on Chinese username path | Set `build_dir = C:/.pio_build/VOCLogger` in `platformio.ini` |
| `status=14` (unsupported BSEC2 outputs) | Removed Extended-only output fields from the subscription list |
| Serial upload blocks when no PC connected | Added `Serial.setTxTimeoutMs(0)` — non-blocking USB CDC |

### Current Deployment Status

- Sensor deployed in bathroom, uploading every 10 s, running headless on wall power
- Multi-WiFi: automatically tries UW MPSK → home network on connection failure
- BSEC2 calibration state saved to NVS — survives power cuts
- `iaq_accuracy = 0` at cold start; expect ≥ 1 in ~30 min, full calibration (3) in ~4 days

## Next Steps

| Done | Task | Description |
|:-:|---|---|
| <input type="checkbox" /> | **Annotated Shower Data Collection** | Collect 5+ shower sessions with BSEC2, annotate start/end times, append to `shower_annotations.csv` — target ≥ 150 positive windows. |
| <input type="checkbox" /> | **Retrain Shower CNN with BSEC2 Data** | Replace `gas_norm` pipeline with `iaq` + `iaq_accuracy ≥ 1` filter; retrain 1D-CNN; target Val F1 ≥ 0.85. |
| <input type="checkbox" /> | **Firebase Reverse Control** | App writes to `/commands/action`; ESP32 polls every 3 s, executes, and clears — bi-directional control without WebSocket. |
| <input type="checkbox" /> | **Extreme Case VOC Testing** | Perfume, air freshener, cooking VOCs — test IAQ spike magnitude, recovery time, and classifier edge cases. |
