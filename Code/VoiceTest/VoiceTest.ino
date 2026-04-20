/**
 * ============================================================
 * VoiceTest v2.0 — SPH0645 + ESP-SR MultiNet keyword recognition
 * ============================================================
 * Board    : Seeed Studio XIAO ESP32-S3
 * Requires : Arduino ESP32 v3.x (includes esp-sr)
 *
 * Features:
 *   - WiFi connection (offline fallback after 15 s timeout)
 *   - SPH0645 I2S microphone capture (left channel, SEL = GND)
 *   - ESP-SR MultiNet English keyword recognition
 *   - Wake-word state machine: "Aura" opens a 5-second window;
 *     "Spray" and "Stop" are only accepted within that window.
 *
 * Build settings:
 *   Tools -> Partition Scheme -> "Huge APP (3MB No OTA / 1MB SPIFFS)"
 *   Tools -> PSRAM            -> "OPI PSRAM"
 *
 * Pin assignments:
 *   I2S SCK  -> D8  (GPIO 7) BCLK
 *   I2S WS   -> D9  (GPIO 8) LRCLK
 *   I2S SD   -> D10 (GPIO 9) Data
 *   SPH0645 SEL -> GND       (left channel)
 * ============================================================
 */

// ============================================================
// 1. Includes
// ============================================================
#include <WiFi.h>
#include "driver/i2s_std.h"   // new API — matches ESP-SR internal driver, avoids legacy conflicts
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_heap_caps.h"

// ESP-SR v2.0 (bundled with Arduino ESP32 v3.x)
#include "esp_afe_sr_iface.h"
#include "esp_afe_sr_models.h"
#include "esp_afe_config.h"
#include "esp_mn_iface.h"
#include "esp_mn_models.h"
#include "model_path.h"
#include "esp_mn_speech_commands.h"

// ============================================================
// 2. WiFi credentials
// ============================================================
const char* WIFI_SSID               = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD           = "YOUR_WIFI_PASSWORD";
const unsigned long WIFI_TIMEOUT_MS = 15000;

// ============================================================
// 3. Pin definitions
// ============================================================
#define I2S_SCK   D8    // GPIO 7 — BCLK
#define I2S_WS    D9    // GPIO 8 — LRCLK / Word Select
#define I2S_SD    D10   // GPIO 9 — Serial Data
#define PIN_LED   D0    // GPIO 21 — onboard orange LED

// ============================================================
// 4. I2S parameters
// ============================================================
#define I2S_SAMPLE_RATE 16000
#define DMA_BUF_COUNT   4
#define DMA_BUF_LEN     256

static i2s_chan_handle_t rx_chan = NULL;

// ============================================================
// 5. Recognition & LED parameters
// ============================================================
#define LED_ON_DURATION_MS 2000

#define CMD_ID_AURA   0   // "aura"  — wake word
#define CMD_ID_SPRAY  1   // "spray" — trigger spray
#define CMD_ID_STOP   2   // "stop"  — stop spray

// Commands are only accepted within this window after "Aura"
#define LISTEN_WINDOW_MS  7000

// ============================================================
// 6. ESP-SR global handles
// ============================================================
static const esp_afe_sr_iface_t *afe_handle = NULL;
static esp_afe_sr_data_t        *afe_data   = NULL;
static esp_mn_iface_t           *multinet   = NULL;
static model_iface_data_t       *model_data = NULL;

// ============================================================
// 7. State variables
// ============================================================
volatile bool commandDetected  = false;
volatile int  lastCommandId    = -1;

bool          ledActive        = false;
unsigned long ledStartTime     = 0;

// Wake-word state machine
enum SysState { SYS_IDLE, SYS_LISTENING };
volatile SysState     sysState    = SYS_IDLE;
volatile unsigned long listenStart = 0;

TaskHandle_t srTaskHandle = NULL;

// ============================================================
// Forward declarations
// ============================================================
void connectWiFi();
void initI2S();
bool initESPSR();
void srProcessingTask(void *pvParam);
void onCommandDetected(int cmd_id);
void updateLED();


// ============================================================
//                          setup()
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[VoiceTest] Booting...");

  // Must call psramInit() before any ESP-SR init; otherwise heap_caps
  // reports zero SPIRAM and the AFE falls back to internal RAM, which
  // is too small and causes a crash.
  if (psramInit()) {
    Serial.printf("[PSRAM] OK — %u bytes free\n", (unsigned)ESP.getFreePsram());
  } else {
    Serial.println("[PSRAM] WARNING: init failed — ESP-SR will not run!");
  }

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  connectWiFi();

  // I2S must be initialised AFTER ESP-SR: the AFE's create_from_config()
  // reconfigures the I2S peripheral internally. Initialising I2S first
  // and then calling AFE overwrites the driver, producing all-zero reads.
  if (initESPSR()) {
    initI2S();
    BaseType_t ret = xTaskCreatePinnedToCore(
      srProcessingTask, "sr_task",
      12 * 1024, NULL, 5, &srTaskHandle, 1
    );
    if (ret != pdPASS) {
      Serial.println("[VoiceTest] ERROR: failed to create SR task");
    } else {
      Serial.println("[VoiceTest] SR task running on Core 1");
    }
  } else {
    Serial.println("[VoiceTest] ERROR: ESP-SR init failed");
  }

  Serial.println("[VoiceTest] Ready. Say 'Aura' to open command window.");
}


// ============================================================
//                          loop()
// ============================================================
void loop() {
  if (commandDetected) {
    int cmd = lastCommandId;
    commandDetected = false;
    onCommandDetected(cmd);
  }
  updateLED();
}


// ============================================================
//                      Function implementations
// ============================================================

void connectWiFi() {
  Serial.printf("[WiFi] Connecting to: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime > WIFI_TIMEOUT_MS) {
      Serial.println("\n[WiFi] Timeout — continuing offline");
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
}


void initI2S() {
  // New i2s_std API (ESP-IDF v5 / Arduino ESP32 v3.x).
  // Uses the same driver layer as ESP-SR AFE, avoiding register conflicts
  // that cause all-zero reads when the legacy driver/i2s.h API is mixed in.

  i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
  chan_cfg.dma_desc_num  = DMA_BUF_COUNT;
  chan_cfg.dma_frame_num = DMA_BUF_LEN;
  ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, NULL, &rx_chan));

  i2s_std_config_t std_cfg = {
    .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(I2S_SAMPLE_RATE),
    // SPH0645: Philips I2S, 32-bit frame, 18-bit valid data, left channel (SEL = GND)
    .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
                  I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
    .gpio_cfg = {
      .mclk = I2S_GPIO_UNUSED,
      .bclk = (gpio_num_t)I2S_SCK,
      .ws   = (gpio_num_t)I2S_WS,
      .dout = I2S_GPIO_UNUSED,
      .din  = (gpio_num_t)I2S_SD,
      .invert_flags = { .mclk_inv = false, .bclk_inv = false, .ws_inv = false },
    },
  };

  ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx_chan, &std_cfg));
  ESP_ERROR_CHECK(i2s_channel_enable(rx_chan));

  Serial.printf("[I2S] SPH0645 ready (BCLK=D8, LRCL=D9, DOUT=D10, %d Hz)\n",
                I2S_SAMPLE_RATE);
}


bool initESPSR() {
  // 1. Load model list from the "model" SPIFFS partition
  srmodel_list_t *models = esp_srmodel_init("model");
  if (!models) {
    Serial.println("[ESP-SR] ERROR: model init failed");
    Serial.println("  -> Check partition scheme: must be 'Huge APP'");
    Serial.println("  -> Check board package: Arduino ESP32 >= v3.0");
    return false;
  }
  Serial.printf("[ESP-SR] Found %d model(s)\n", models->num);
  for (int i = 0; i < models->num; i++) {
    Serial.printf("  [%d] %s\n", i, models->model_name[i]);
  }

  // 2. Build AFE config — "M" = single mic input
  afe_config_t *afe_cfg = afe_config_init("M", models, AFE_TYPE_SR, AFE_MODE_LOW_COST);
  if (!afe_cfg) {
    Serial.println("[ESP-SR] ERROR: AFE config init failed");
    return false;
  }

  // Use PSRAM for AFE buffers when available (psramFound() is more reliable
  // than heap_caps_get_total_size after an explicit psramInit() call)
  if (psramFound()) {
    afe_cfg->memory_alloc_mode = AFE_MEMORY_ALLOC_MORE_PSRAM;
    Serial.printf("[ESP-SR] PSRAM available (%u bytes) — high-quality mode\n",
                  (unsigned)ESP.getFreePsram());
  } else {
    afe_cfg->memory_alloc_mode = AFE_MEMORY_ALLOC_MORE_INTERNAL;
    Serial.println("[ESP-SR] No PSRAM — internal RAM mode (reduced quality)");
  }
  afe_cfg->aec_init     = false;  // no speaker, disable echo cancellation
  afe_cfg->wakenet_init = false;  // using MultiNet commands directly, not WakeNet

  // 3. Create AFE instance
  afe_handle = esp_afe_handle_from_config(afe_cfg);
  if (!afe_handle) {
    Serial.println("[ESP-SR] ERROR: failed to get AFE handle");
    afe_config_free(afe_cfg);
    return false;
  }

  afe_data = afe_handle->create_from_config(afe_cfg);
  afe_config_free(afe_cfg);
  if (!afe_data) {
    Serial.println("[ESP-SR] ERROR: AFE create failed (out of RAM?)");
    return false;
  }
  Serial.println("[ESP-SR] AFE ready");

  // 4. Find the English MultiNet model
  char *mn_name = esp_srmodel_filter(models, ESP_MN_PREFIX, ESP_MN_ENGLISH);
  if (!mn_name) {
    Serial.println("[ESP-SR] ERROR: no English MultiNet model found");
    return false;
  }
  Serial.printf("[ESP-SR] MultiNet model: %s\n", mn_name);

  // 5. Create MultiNet instance (6000 ms recognition timeout)
  multinet   = esp_mn_handle_from_name(mn_name);
  model_data = multinet->create(mn_name, 6000);
  if (!model_data) {
    Serial.println("[ESP-SR] ERROR: MultiNet create failed");
    return false;
  }
  Serial.println("[ESP-SR] MultiNet loaded");

  // 6. Register command words
  esp_mn_commands_alloc(multinet, model_data);
  esp_mn_commands_add(CMD_ID_AURA,  "aura");
  esp_mn_commands_add(CMD_ID_SPRAY, "spray");
  esp_mn_commands_add(CMD_ID_STOP,  "stop");
  esp_mn_commands_update();

  Serial.println("[ESP-SR] Commands: aura (wake) / spray / stop");
  return true;
}


void srProcessingTask(void *pvParam) {
  int chunkSamples = afe_handle->get_feed_chunksize(afe_data);
  Serial.printf("[SR Task] chunk = %d samples (%d ms)\n",
                chunkSamples, chunkSamples * 1000 / I2S_SAMPLE_RATE);

  // Even in MONO mode the DMA buffer interleaves L and R channel slots:
  //   index 0 = left (SPH0645 data), index 1 = right (floating ~0),
  //   index 2 = left, index 3 = right, ...
  // Reading only chunkSamples words gives the AFE an L,0,L,0 pattern
  // (effectively 8 kHz), breaking MultiNet. Fix: read 2x, de-interleave.
  int32_t *i32Buf = (int32_t *)ps_malloc(2 * chunkSamples * sizeof(int32_t));
  int16_t *i16Buf = (int16_t *)malloc(chunkSamples * sizeof(int16_t));

  if (!i32Buf || !i16Buf) {
    Serial.println("[SR Task] ERROR: buffer alloc failed");
    free(i32Buf);
    free(i16Buf);
    vTaskDelete(NULL);
    return;
  }

  Serial.println("[SR Task] Listening (stereo de-interleave mode)...");

  int         frameCount = 0;
  vad_state_t lastVad    = VAD_SILENCE;

  while (true) {
    // 1. Read L+R interleaved — 2x the required samples
    size_t bytesRead = 0;
    esp_err_t err = i2s_channel_read(rx_chan,
                                      i32Buf,
                                      2 * chunkSamples * sizeof(int32_t),
                                      &bytesRead,
                                      portMAX_DELAY);

    if (err != ESP_OK || bytesRead == 0) {
      vTaskDelay(1);
      continue;
    }

    int totalRead   = bytesRead / sizeof(int32_t);  // L+R interleaved count
    int samplesRead = totalRead / 2;                // actual left-channel samples

    // 2. De-interleave + 32->16 bit conversion
    // Even indices = left channel (SPH0645 audio); odd = right (discard)
    int32_t maxRaw = 0;
    for (int i = 0; i < samplesRead; i++) {
      int32_t left = i32Buf[i * 2];
      int32_t s    = left >> 14;
      if (s < 0) s = -s;
      if (s > maxRaw) maxRaw = s;
      i16Buf[i] = (int16_t)(left >> 16);  // 16-bit PCM for AFE
    }

    // 3. Feed AFE (noise suppression + VAD)
    afe_handle->feed(afe_data, i16Buf);

    // 4. Fetch AFE result
    afe_fetch_result_t *res = afe_handle->fetch(afe_data);
    if (!res) continue;

    frameCount++;

    // Structured audio level output for Streamlit dashboard
    float level = (float)maxRaw / 1310.72f;
    if (level > 100.0f) level = 100.0f;
    Serial.printf("LEVEL:%.1f\n", level);

    // Wake-word window timeout
    if (sysState == SYS_LISTENING &&
        millis() - listenStart > LISTEN_WINDOW_MS) {
      sysState = SYS_IDLE;
      Serial.println("STATE:idle");
      Serial.println("[Wake] Window timed out — back to idle");
    }

    // VAD state change logging
    if (res->vad_state != lastVad) {
      lastVad = res->vad_state;
      if (lastVad == VAD_SPEECH) Serial.println("\n[VAD on]");
      else                       Serial.println("[VAD off]");
    } else if (res->vad_state == VAD_SILENCE && frameCount % 50 == 0) {
      Serial.print(".");
    }

    // 5. MultiNet recognition (speech frames only)
    if (res->vad_state == VAD_SPEECH) {
      esp_mn_state_t mn_state = multinet->detect(model_data, res->data);
      if (mn_state == ESP_MN_STATE_DETECTED) {
        esp_mn_results_t *mn_result = multinet->get_results(model_data);
        if (mn_result && mn_result->num > 0) {
          int   cmd_id = mn_result->command_id[0];
          float prob   = mn_result->prob[0];

          if (cmd_id == CMD_ID_AURA) {
            // Wake word — open listening window
            sysState    = SYS_LISTENING;
            listenStart = millis();
            Serial.printf("WORD:aura:%.2f\n", prob);
            Serial.println("STATE:listening");
            lastCommandId   = CMD_ID_AURA;
            commandDetected = true;

          } else if (sysState == SYS_LISTENING) {
            // Command within window — execute
            Serial.printf("WORD:%s:%.2f\n", mn_result->string, prob);
            Serial.println("STATE:idle");
            sysState        = SYS_IDLE;
            lastCommandId   = cmd_id;
            commandDetected = true;

          } else {
            // Command outside window — ignore
            Serial.printf("[ignored] %s — say 'aura' first\n", mn_result->string);
          }
        }
      }
    }

    vTaskDelay(1);
  }

  free(i32Buf);
  free(i16Buf);
  vTaskDelete(NULL);
}


void onCommandDetected(int cmd_id) {
  switch (cmd_id) {
    case CMD_ID_AURA:
      // Slow triple blink — listening window open
      for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_LED, HIGH); delay(200);
        digitalWrite(PIN_LED, LOW);  delay(200);
      }
      break;
    case CMD_ID_SPRAY:
      digitalWrite(PIN_LED, HIGH);
      ledActive    = true;
      ledStartTime = millis();
      break;
    case CMD_ID_STOP:
      digitalWrite(PIN_LED, LOW);
      ledActive = false;
      break;
    default:
      break;
  }
}


void updateLED() {
  if (!ledActive) return;
  if (millis() - ledStartTime >= LED_ON_DURATION_MS) {
    digitalWrite(PIN_LED, LOW);
    ledActive = false;
    Serial.println("[LED] OFF");
  }
}
