/**
 * ============================================================
 * AuraSync v1.0 — Firmware Framework
 * ============================================================
 * Board   : Seeed Studio XIAO ESP32-S3
 * Toolchain: Arduino IDE (esp32 by Espressif 2.x / 3.x)
 * Goal    : Non-blocking sensor polling + state machine + WiFi + I2S audio
 *
 * Pin corrections (Seeed official XIAO ESP32-S3 pinout):
 *   D8  = GPIO7  (BCLK)
 *   D9  = GPIO8  (LRCLK)
 *   D10 = GPIO9  (DOUT)
 *   D3  = GPIO4  (pump MOSFET)
 *
 * Required libraries (install via Arduino Library Manager):
 *   - Adafruit BME680 Library
 *   - Adafruit Unified Sensor
 *   driver/i2s.h is bundled with the ESP32 Arduino core.
 *   Note: driver/i2s.h is deprecated in ESP-IDF v5.x but compiles
 *         fine under Arduino ESP32 v3.x.
 * ============================================================
 */

// ============================================================
// 1. Includes
// ============================================================
#include <Wire.h>               // I2C bus (BME680)
#include <WiFi.h>               // ESP32 WiFi
#include <Adafruit_Sensor.h>    // Adafruit unified sensor interface
#include <Adafruit_BME680.h>    // BME680 VOC + environmental sensor
#include "driver/i2s.h"         // I2S driver (INMP441 microphone)

// ============================================================
// 2. Pin Definitions
//    Reference: https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/
// ============================================================
// --- I2C (BME680) ---
#define PIN_SDA     5    // D4 = GPIO5
#define PIN_SCL     6    // D5 = GPIO6

// --- I2S (INMP441 microphone) ---
// INMP441 L/R pin tied to VDD (+3.3V) → right channel
#define I2S_WS      8    // D9  = GPIO8  (LRCLK / Word Select)
#define I2S_SCK     7    // D8  = GPIO7  (BCLK  / Bit Clock)
#define I2S_SD      9    // D10 = GPIO9  (DOUT  / Serial Data)

// --- Pump MOSFET control ---
#define PIN_PUMP    4    // D3  = GPIO4

// ============================================================
// 3. WiFi Configuration
// ============================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";      // replace with your network name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // replace with your password
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000; // connection timeout (15 s)

// ============================================================
// 4. Timing Constants (milliseconds)
// ============================================================
const unsigned long BME_SAMPLE_INTERVAL_MS = 1000;   // environmental sensor polling: 1 s
const unsigned long PUMP_ON_DURATION_MS    = 2000;   // pump spray duration: 2 s
const unsigned long COOLDOWN_DURATION_MS   = 60000;  // VOC cooldown lockout: 60 s

// ============================================================
// 5. I2S Parameters
// ============================================================
#define I2S_PORT         I2S_NUM_0   // use I2S peripheral 0
#define I2S_SAMPLE_RATE  16000       // sample rate: 16 kHz (matches Edge Impulse model)
#define DMA_BUF_COUNT    4           // number of DMA buffers
#define DMA_BUF_LEN      1024        // samples per DMA buffer
// INMP441 outputs 24-bit data left-aligned in a 32-bit I2S frame.
// Shift right 8 bits to recover the signed 24-bit value.
// L/R tied to VDD → right channel (I2S_CHANNEL_FMT_ONLY_RIGHT).
int32_t audioBuffer[DMA_BUF_LEN];   // I2S DMA read buffer

// ============================================================
// 6. BME680 Object and Data Structures
// ============================================================
// Schematic note: BME680 SDO selects the I2C address (not a data line).
// SDO → GND = address 0x76; SDO → VCC = address 0x77.
// Data line: SDI → SDA. SCK → SCL unchanged.
#define BME680_I2C_ADDR  0x76  // SDO tied to GND

Adafruit_BME680 bme;

/**
 * EnvData: one BME680 sample snapshot.
 * gasResistance is a VOC proxy: lower resistance = higher VOC concentration.
 */
struct EnvData {
  float temperature;        // °C
  float humidity;           // % RH
  float pressure;           // hPa
  float gasResistance;      // Ω (VOC proxy — lower = more odor)
  unsigned long timestamp_ms; // millis() at time of reading
};

EnvData lastEnvData = {0};  // most recent sample
EnvData prevEnvData = {0};  // previous sample (used for slope / rate-of-change)

unsigned long lastBmeReadTime = 0; // millis() of last BME680 read

// ============================================================
// 7. State Machine Definition
// ============================================================
/**
 * SystemState: main system states
 *
 *  IDLE          → standby; continuously sampling; waiting for ML trigger
 *  ML_PROCESSING → feature aggregation + inference (Edge Impulse model slot)
 *  ACTUATION     → pump active (spraying)
 *  COOLDOWN      → VOC lockout; prevents re-spray while fragrance disperses
 */
enum SystemState {
  IDLE,
  ML_PROCESSING,
  ACTUATION,
  COOLDOWN
};

SystemState currentState = IDLE;

// ============================================================
// 8. Pump State Variables
// ============================================================
bool          pumpActive        = false;
unsigned long pumpStartTime     = 0;
unsigned long cooldownStartTime = 0;

// ============================================================
// Forward Declarations
// ============================================================
void connectWiFi();
bool initBME680();
void initI2S();
void readBME680();
void readI2SAudio();
float computeHumiditySlope();
float computeVOCSlope();
void analyzeAudioEnergy(int32_t* samples, size_t count);
void triggerPump();
void updatePumpState();
void runStateMachine();


// ============================================================
// setup()
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[AuraSync] Booting...");

  // Pump pin first — ensures atomizer is off before anything else powers up
  pinMode(PIN_PUMP, OUTPUT);
  digitalWrite(PIN_PUMP, LOW);
  Serial.println("[Pump] Pump pin initialised, default LOW (off)");

  connectWiFi();

  Wire.begin(PIN_SDA, PIN_SCL);
  Serial.printf("[I2C] Ready (SDA=GPIO%d, SCL=GPIO%d)\n", PIN_SDA, PIN_SCL);

  if (!initBME680()) {
    Serial.println("[BME680] FAIL — check wiring and I2C address. Halting.");
    while (true) { delay(1000); }
  }

  initI2S();

  Serial.println("[AuraSync] Init complete — entering main loop.");
}


// ============================================================
// loop()
// ============================================================
void loop() {
  // No delay() anywhere in this loop — all timing via millis() deltas.

  readBME680();      // Task 1: environmental sensor (every 1000 ms)
  readI2SAudio();    // Task 2: audio DMA drain (non-blocking, timeout=0)
  updatePumpState(); // Task 3: check whether pump 2 s window has elapsed
  runStateMachine(); // Task 4: state machine dispatch
}


// ============================================================
// Function Implementations
// ============================================================

/**
 * connectWiFi() — connect with timeout; called only from setup().
 * setup() is allowed to block, so delay() inside is acceptable here.
 */
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime > WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println("\n[WiFi] Timeout — continuing in offline mode.");
      return;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.printf("[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
}


/**
 * initBME680() — configure oversampling and IIR filter; return false on failure.
 *
 * Oversampling rationale:
 *   - Temp/pressure: higher oversampling → lower noise
 *   - Humidity: moderate oversampling → saves time (gas heater is the bottleneck)
 *   - IIR SIZE_3: smooths transient noise on temp/pressure without slowing VOC response
 */
bool initBME680() {
  if (!bme.begin(BME680_I2C_ADDR)) {
    return false;
  }

  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  // 320 °C for 150 ms balances VOC response speed vs. power draw
  bme.setGasHeater(320, 150);

  Serial.printf("[BME680] Ready (I2C addr: 0x%02X)\n", BME680_I2C_ADDR);
  return true;
}


/**
 * initI2S() — configure I2S for the INMP441 microphone.
 *
 * bits_per_sample = 32: INMP441 outputs 24-bit data left-aligned in a 32-bit frame.
 * channel_format = ONLY_RIGHT: L/R tied to VDD (+3.3V) → right channel.
 */
void initI2S() {
  const i2s_config_t i2s_config = {
    .mode             = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate      = I2S_SAMPLE_RATE,
    .bits_per_sample  = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format   = I2S_CHANNEL_FMT_ONLY_RIGHT, // L/R → VDD = right channel
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count    = DMA_BUF_COUNT,
    .dma_buf_len      = DMA_BUF_LEN,
    .use_apll         = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk       = 0
  };

  const i2s_pin_config_t pin_config = {
    .bck_io_num   = I2S_SCK,           // BCLK  = GPIO7 (D8)
    .ws_io_num    = I2S_WS,            // LRCLK = GPIO8 (D9)
    .data_out_num = I2S_PIN_NO_CHANGE, // TX not used
    .data_in_num  = I2S_SD             // DOUT  = GPIO9 (D10)
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[I2S] Driver install failed: %s\n", esp_err_to_name(err));
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("[I2S] Pin config failed: %s\n", esp_err_to_name(err));
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.printf("[I2S] INMP441 ready (SCK=GPIO%d, WS=GPIO%d, SD=GPIO%d, %dHz)\n",
                I2S_SCK, I2S_WS, I2S_SD, I2S_SAMPLE_RATE);
}


/**
 * readBME680() — non-blocking environmental sample task.
 * Throttled to BME_SAMPLE_INTERVAL_MS (1000 ms) via millis() delta.
 * Updates prevEnvData / lastEnvData for slope computation.
 */
void readBME680() {
  if (millis() - lastBmeReadTime < BME_SAMPLE_INTERVAL_MS) {
    return;
  }
  lastBmeReadTime = millis();

  prevEnvData = lastEnvData;

  if (!bme.performReading()) {
    Serial.println("[BME680] Read failed — skipping this sample.");
    return;
  }

  lastEnvData.temperature   = bme.temperature;
  lastEnvData.humidity      = bme.humidity;
  lastEnvData.pressure      = bme.pressure / 100.0f; // Pa → hPa
  lastEnvData.gasResistance = bme.gas_resistance;     // Ω
  lastEnvData.timestamp_ms  = millis();

  Serial.printf("[BME680] Temp: %.1f°C | Hum: %.1f%% | Press: %.1fhPa | VOC: %.0f Ω\n",
                lastEnvData.temperature,
                lastEnvData.humidity,
                lastEnvData.pressure,
                lastEnvData.gasResistance);
}


/**
 * readI2SAudio() — non-blocking audio DMA drain.
 * timeout=0: returns immediately if the DMA buffer is empty.
 */
void readI2SAudio() {
  size_t bytesRead = 0;

  esp_err_t result = i2s_read(
    I2S_PORT,
    audioBuffer,
    sizeof(audioBuffer),
    &bytesRead,
    0  // timeout=0 → non-blocking; portMAX_DELAY would block the loop
  );

  if (result == ESP_OK && bytesRead > 0) {
    size_t sampleCount = bytesRead / sizeof(int32_t);
    analyzeAudioEnergy(audioBuffer, sampleCount);
  }
}


// ============================================================
// DSP / Feature Extraction Stubs
// Placeholder implementations until the Edge Impulse pipeline is wired in.
// First-order differences serve as feature seeds.
// ============================================================

/**
 * computeHumiditySlope() — humidity rate of change (%/s).
 *
 * ML intent:
 *   - Shower: rapid rise (slope >> 0, e.g. +5 %/s)
 *   - Ventilation: rapid fall (slope << 0)
 *   - Idle indoor: slope ≈ 0
 *
 * TODO: use as one element of a 30 s sliding-window feature vector.
 */
float computeHumiditySlope() {
  if (prevEnvData.timestamp_ms == 0) {
    return 0.0f;
  }

  float deltaHumidity = lastEnvData.humidity - prevEnvData.humidity;
  float deltaTime_s   = (lastEnvData.timestamp_ms - prevEnvData.timestamp_ms) / 1000.0f;

  if (deltaTime_s < 0.001f) return 0.0f;

  return deltaHumidity / deltaTime_s; // %/s
}


/**
 * computeVOCSlope() — gas resistance rate of change (Ω/s).
 *
 * Note: resistance is inversely proportional to VOC concentration:
 *   - Rising VOC (odor)  → resistance falls → negative slope
 *   - Fragrance clearing → resistance rises → positive slope
 *
 * TODO: normalise to dR/R (relative change) to cancel sensor-to-sensor variation.
 */
float computeVOCSlope() {
  if (prevEnvData.timestamp_ms == 0) {
    return 0.0f;
  }

  float deltaGas    = lastEnvData.gasResistance - prevEnvData.gasResistance;
  float deltaTime_s = (lastEnvData.timestamp_ms - prevEnvData.timestamp_ms) / 1000.0f;

  if (deltaTime_s < 0.001f) return 0.0f;

  return deltaGas / deltaTime_s; // Ω/s
}


/**
 * analyzeAudioEnergy() — RMS energy stub.
 *
 * TODO:
 *   1. Add FFT to extract band energies:
 *      - <500 Hz  : toilet flush, exhaust fan
 *      - 500-4 kHz: voice, hair dryer
 *      - >4 kHz   : spray can, running water
 *   2. Feed band energies as feature vector into Edge Impulse classifier.
 *   INMP441: shift right 8 bits to recover the signed 24-bit value.
 */
void analyzeAudioEnergy(int32_t* samples, size_t count) {
  if (count == 0) return;

  double sumSquares = 0.0;
  for (size_t i = 0; i < count; i++) {
    int32_t sample = samples[i] >> 8; // recover 24-bit signed value
    sumSquares += (double)sample * sample;
  }
  float rms = sqrtf((float)(sumSquares / count));

  // TODO: store rms in a global for the state machine:
  // audioRMS = rms;

  // TODO: run FFT:
  // performFFT(samples, count);
}


// ============================================================
// Actuator Control
// ============================================================

/**
 * triggerPump() — activate the pump for one spray cycle.
 * Drives GPIO4 HIGH (MOSFET on), records start time, transitions to ACTUATION.
 * The 2 s shutoff is handled non-blocking in updatePumpState().
 */
void triggerPump() {
  if (pumpActive) {
    Serial.println("[Pump] Already running — ignoring duplicate trigger.");
    return;
  }

  Serial.println("[Pump] Spraying!");
  digitalWrite(PIN_PUMP, HIGH);
  pumpActive    = true;
  pumpStartTime = millis();
  currentState  = ACTUATION;
  Serial.printf("[State] ACTUATION — pump on for %lu ms\n", PUMP_ON_DURATION_MS);
}


/**
 * updatePumpState() — called every loop(); non-blocking pump shutoff.
 * Transitions to COOLDOWN after PUMP_ON_DURATION_MS (2000 ms).
 */
void updatePumpState() {
  if (!pumpActive) return;

  if (millis() - pumpStartTime >= PUMP_ON_DURATION_MS) {
    digitalWrite(PIN_PUMP, LOW);
    pumpActive = false;

    currentState      = COOLDOWN;
    cooldownStartTime = millis();
    Serial.printf("[Pump] Stopped. Entering COOLDOWN (%lu s)\n",
                  COOLDOWN_DURATION_MS / 1000);
    Serial.println("[State] COOLDOWN — waiting for VOC to clear...");
  }
}


// ============================================================
// State Machine
// ============================================================

/**
 * runStateMachine() — called every loop().
 *
 * Transition diagram:
 *
 *  IDLE ──[slope threshold crossed]──► ML_PROCESSING
 *   ▲                                      │
 *   │                        [confidence]  │ [low confidence]
 *   │                                      ▼        │
 *   │                                  ACTUATION ◄──┘ (or back to IDLE)
 *   │                                      │
 *   │                         [2 s done]   │
 *   │                                      ▼
 *   └──────────[60 s done]────────────── COOLDOWN
 *
 * Placeholder thresholds stand in for the Edge Impulse run_classifier() call.
 */
void runStateMachine() {
  switch (currentState) {

    case IDLE:
    {
      float humSlope = computeHumiditySlope();
      float vocSlope = computeVOCSlope();

      // Placeholder thresholds — replace with ML classifier output
      bool humidityTrigger = (humSlope > 2.0f);     // humidity rising > +2 %/s (shower)
      bool vocTrigger      = (vocSlope < -5000.0f);  // resistance falling > 5000 Ω/s (odor)

      if (humidityTrigger || vocTrigger) {
        currentState = ML_PROCESSING;
        Serial.printf("[State] IDLE → ML_PROCESSING (humSlope=%.2f, vocSlope=%.0f)\n",
                      humSlope, vocSlope);
      }
      break;
    }

    case ML_PROCESSING:
    {
      Serial.println("[State] ML_PROCESSING — running scene inference...");

      // TODO: replace this block with Edge Impulse run_classifier():
      //   ei_impulse_result_t result = {0};
      //   run_classifier(&signal, &result, false);
      //   float confidence_shower = result.classification[0].value;
      //   ...

      // Simulate classifier output until ML model is integrated
      float fakeConfidence = (float)random(0, 100) / 100.0f;
      const float CONFIDENCE_THRESHOLD = 0.70f;

      if (fakeConfidence >= CONFIDENCE_THRESHOLD) {
        Serial.printf("[ML] Confidence %.0f%% >= threshold %.0f%% — triggering spray.\n",
                      fakeConfidence * 100, CONFIDENCE_THRESHOLD * 100);
        triggerPump();
      } else {
        Serial.printf("[ML] Confidence %.0f%% too low — returning to idle.\n",
                      fakeConfidence * 100);
        currentState = IDLE;
        Serial.println("[State] ML_PROCESSING → IDLE");
      }
      break;
    }

    case ACTUATION:
    {
      // updatePumpState() handles the 2 s shutoff and COOLDOWN transition
      break;
    }

    case COOLDOWN:
    {
      unsigned long elapsed   = millis() - cooldownStartTime;
      unsigned long remaining = (elapsed < COOLDOWN_DURATION_MS)
                                ? (COOLDOWN_DURATION_MS - elapsed) / 1000
                                : 0;

      if (elapsed >= COOLDOWN_DURATION_MS) {
        currentState = IDLE;
        Serial.println("[State] COOLDOWN → IDLE (cooldown complete)");
      } else {
        static unsigned long lastCooldownLog = 0;
        if (millis() - lastCooldownLog >= 10000) {
          lastCooldownLog = millis();
          Serial.printf("[State] COOLDOWN — %lu s remaining...\n", remaining);
        }
      }
      break;
    }

    default:
      Serial.println("[State] Unknown state — resetting to IDLE.");
      currentState = IDLE;
      break;
  }
}
