/**
 * MicTest v2 — SPH0645 + energy-based VAD + LED trigger
 * Board   : Seeed Studio XIAO ESP32-S3
 * Hardware: Adafruit SPH0645LM4H I2S microphone breakout (#3421)
 *
 * Wiring:
 *   SPH0645 BCLK -> D8 (GPIO 7)
 *   SPH0645 LRCL -> D9 (GPIO 8)
 *   SPH0645 DOUT -> D10 (GPIO 9)
 *   SPH0645 SEL  -> GND  (left channel)
 *   SPH0645 3V   -> 3.3V
 *   SPH0645 GND  -> GND
 *
 * Note: this sketch implements Voice Activity Detection (VAD) only —
 * any speech triggers the LED. Keyword spotting requires a trained model
 * (see VoiceTest.ino for ESP-SR integration).
 */

#include "driver/i2s.h"
#include <math.h>

// ── Pins ──────────────────────────────────────────────────────
#define I2S_BCLK    D8
#define I2S_LRCLK   D9
#define I2S_DOUT    D10
#define PIN_LED     D0   // GPIO 21 — onboard orange LED

// ── I2S ───────────────────────────────────────────────────────
#define I2S_PORT      I2S_NUM_0
#define SAMPLE_RATE   16000
#define BUF_SAMPLES   512

// ── VAD parameters ────────────────────────────────────────────
// Short-term energy: ~32 ms time constant (tracks current sound level)
// Long-term energy : ~2 s  time constant (tracks background noise floor)
// Speech detected when STE / LTE > VAD_RATIO
#define STE_ALPHA   0.03f   // short-term smoothing (~32 ms)
#define LTE_ALPHA   0.001f  // long-term smoothing  (~2 s noise floor)
#define VAD_RATIO   8.0f    // 8x above noise floor -> speech

#define LED_DURATION_MS  2000

// ── Global state ──────────────────────────────────────────────
static int32_t rawBuf[BUF_SAMPLES];

// DC-blocking filter state (removes SPH0645 DC offset)
static float dcIn  = 0.0f;
static float dcOut = 0.0f;

static float steEnergy  = 0.0f;
static float lteEnergy  = 100.0f;  // small initial value to avoid divide-by-zero

static bool          ledActive    = false;
static unsigned long ledStartTime = 0;
static unsigned long lastPrint    = 0;

// ── DC-blocking high-pass filter ─────────────────────────────
// y[n] = x[n] - x[n-1] + 0.995 * y[n-1]
// Cutoff ~8 Hz — removes DC bias and very-low-frequency drift
inline float dcBlock(float x) {
  float y = x - dcIn + 0.995f * dcOut;
  dcIn  = x;
  dcOut = y;
  return y;
}


void setup() {
  Serial.begin(115200);
  delay(600);

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  Serial.println("\n========================================");
  Serial.println(" MicTest v2  —  VAD + LED trigger");
  Serial.println("========================================");
  Serial.println("[Tip]  Speak clearly into the mic -> LED lights for 2 s");
  Serial.println("[Note] Stay quiet for ~2 s after boot to calibrate noise floor");
  Serial.println("----------------------------------------");

  initI2S();
}


void loop() {
  // 1. Read I2S samples
  size_t bytesRead = 0;
  i2s_read(I2S_PORT, rawBuf, sizeof(rawBuf),
           &bytesRead, pdMS_TO_TICKS(50));

  int n = bytesRead / sizeof(int32_t);
  if (n == 0) return;

  // 2. Compute frame energy with DC blocking
  float frameEnergy = 0.0f;
  for (int i = 0; i < n; i++) {
    // SPH0645: 18-bit data in bits [31:14] of the 32-bit I2S frame
    float s = dcBlock((float)(rawBuf[i] >> 14));
    frameEnergy += s * s;
  }
  frameEnergy /= (float)n;

  // 3. Update short-term and long-term energy
  steEnergy = STE_ALPHA * frameEnergy + (1.0f - STE_ALPHA) * steEnergy;

  // Update noise floor only during quiet periods (STE close to LTE)
  // to avoid speech contaminating the baseline
  float ratio = steEnergy / lteEnergy;
  if (ratio < 2.0f) {
    lteEnergy = LTE_ALPHA * steEnergy + (1.0f - LTE_ALPHA) * lteEnergy;
  }
  if (lteEnergy < 1.0f) lteEnergy = 1.0f;

  // 4. VAD decision
  if (ratio > VAD_RATIO && !ledActive) {
    Serial.printf("[VAD] Speech detected! ratio=%.1f -> LED ON\n", ratio);
    digitalWrite(PIN_LED, HIGH);
    ledActive    = true;
    ledStartTime = millis();
  }

  // 5. LED timeout
  if (ledActive && millis() - ledStartTime >= LED_DURATION_MS) {
    digitalWrite(PIN_LED, LOW);
    ledActive = false;
    Serial.println("[LED] OFF — waiting for next trigger");
  }

  // 6. Throttled serial output (every 400 ms)
  unsigned long now = millis();
  if (now - lastPrint >= 400) {
    lastPrint = now;

    float rmsNow   = sqrtf(steEnergy);
    float rmsFloor = sqrtf(lteEnergy);

    // ASCII level bar
    int barLen = (int)(rmsNow / 150.0f);
    if (barLen > 40) barLen = 40;
    char bar[42];
    for (int i = 0; i < 40; i++) bar[i] = (i < barLen) ? '#' : '-';
    bar[40] = ledActive ? '!' : ' ';
    bar[41] = '\0';

    Serial.printf("RMS:%5.0f  floor:%4.0f  ratio:%4.1f  |%s|\n",
                  rmsNow, rmsFloor, ratio, bar);
  }
}


void initI2S() {
  const i2s_config_t cfg = {
    .mode             = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate      = SAMPLE_RATE,
    .bits_per_sample  = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format   = I2S_CHANNEL_FMT_ONLY_LEFT,  // SEL = GND -> left channel
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count    = 4,
    .dma_buf_len      = 256,
    .use_apll         = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk       = 0
  };
  const i2s_pin_config_t pins = {
    .bck_io_num   = I2S_BCLK,
    .ws_io_num    = I2S_LRCLK,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_DOUT
  };
  ESP_ERROR_CHECK(i2s_driver_install(I2S_PORT, &cfg, 0, NULL));
  ESP_ERROR_CHECK(i2s_set_pin(I2S_PORT, &pins));
  i2s_zero_dma_buffer(I2S_PORT);
  Serial.printf("[I2S] Ready — %d Hz\n", SAMPLE_RATE);
}
