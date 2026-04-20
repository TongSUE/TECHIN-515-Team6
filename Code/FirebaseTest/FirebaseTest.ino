/**
 * ============================================================
 * FirebaseTest — SPH0645 + ESP-SR + Firebase Realtime Database
 * ============================================================
 * Board    : Seeed Studio XIAO ESP32-S3
 * Requires : Arduino ESP32 v3.x (includes esp-sr)
 *            "Firebase Arduino Client Library for ESP8266 and ESP32"
 *             by Mobizt — install via Arduino Library Manager
 *
 * Behaviour:
 *   Say "Aura" → opens 7-second command window
 *   Say "Spray" → pushes a timestamped record to Firebase RTDB:
 *     /spray_events/<push_id>
 *       { "command": "spray", "unixMs": <ms>, "iso": "2026-..." }
 *
 * Build settings:
 *   Tools -> Partition Scheme -> "Huge APP (3MB No OTA / 1MB SPIFFS)"
 *   Tools -> PSRAM            -> "OPI PSRAM"
 *
 * Pin assignments (identical to VoiceTest):
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
#include <time.h>

// Firebase — install: Arduino Library Manager -> "Firebase Arduino Client
//            Library for ESP8266 and ESP32" by Mobizt
#include <Firebase_ESP_Client.h>

// ESP-IDF I2S (new API — required to co-exist with ESP-SR)
#include "driver/i2s_std.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_heap_caps.h"

// ESP-SR v2.0
#include "esp_afe_sr_iface.h"
#include "esp_afe_sr_models.h"
#include "esp_afe_config.h"
#include "esp_mn_iface.h"
#include "esp_mn_models.h"
#include "model_path.h"
#include "esp_mn_speech_commands.h"

// ============================================================
// 2. Credentials — defined in secrets.h (gitignored)
//    Copy secrets.h.example → secrets.h and fill in your values.
// ============================================================
#include "secrets.h"
// secrets.h must define:
//   WIFI_SSID, WIFI_PASSWORD
//   FIREBASE_DATABASE_URL, FIREBASE_DATABASE_SECRET

const unsigned long WIFI_TIMEOUT_MS = 15000;

// ============================================================
// 3. Pin / I2S definitions
// ============================================================
#define I2S_SCK         D8
#define I2S_WS          D9
#define I2S_SD          D10
#define PIN_LED         D0
#define I2S_SAMPLE_RATE 16000
#define DMA_BUF_COUNT   4
#define DMA_BUF_LEN     256

static i2s_chan_handle_t rx_chan = NULL;

// ============================================================
// 4. Voice recognition parameters
// ============================================================
#define CMD_ID_AURA   0
#define CMD_ID_SPRAY  1
#define CMD_ID_STOP   2
#define LISTEN_WINDOW_MS 7000
#define LED_ON_DURATION_MS 2000

// ============================================================
// 5. ESP-SR handles
// ============================================================
static const esp_afe_sr_iface_t *afe_handle = NULL;
static esp_afe_sr_data_t        *afe_data   = NULL;
static esp_mn_iface_t           *multinet   = NULL;
static model_iface_data_t       *model_data = NULL;

// ============================================================
// 6. State
// ============================================================
enum SysState { SYS_IDLE, SYS_LISTENING };
volatile SysState      sysState       = SYS_IDLE;
volatile unsigned long listenStart    = 0;

// SR task signals loop() via this queue (cmd_id values)
static QueueHandle_t cmdQueue = NULL;

bool          ledActive    = false;
unsigned long ledStartTime = 0;

// ============================================================
// 7. Firebase objects
// ============================================================
FirebaseData  fbdo;
FirebaseAuth  fbAuth;
FirebaseConfig fbConfig;
bool          firebaseReady = false;

TaskHandle_t srTaskHandle = NULL;

// ============================================================
// Forward declarations
// ============================================================
void connectWiFi();
void syncNTP();
void initFirebase();
void initI2S();
bool initESPSR();
void srProcessingTask(void *pvParam);
void pushSprayEvent();
void updateLED();


// ============================================================
//                          setup()
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[FirebaseTest] Booting...");

  if (psramInit()) {
    Serial.printf("[PSRAM] OK — %u bytes free\n", (unsigned)ESP.getFreePsram());
  } else {
    Serial.println("[PSRAM] WARNING: init failed — ESP-SR will not run!");
  }

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    syncNTP();
    initFirebase();
  }

  cmdQueue = xQueueCreate(8, sizeof(int));

  if (initESPSR()) {
    initI2S();
    BaseType_t ret = xTaskCreatePinnedToCore(
      srProcessingTask, "sr_task",
      12 * 1024, NULL, 5, &srTaskHandle, 1
    );
    if (ret != pdPASS) {
      Serial.println("[FirebaseTest] ERROR: SR task creation failed");
    } else {
      Serial.println("[FirebaseTest] SR task running on Core 1");
    }
  } else {
    Serial.println("[FirebaseTest] ERROR: ESP-SR init failed");
  }

  Serial.println("[FirebaseTest] Ready — say 'Aura' then 'Spray'");
}


// ============================================================
//                          loop()
// ============================================================
void loop() {
  int cmd;
  // Non-blocking dequeue — process one command per loop tick
  if (xQueueReceive(cmdQueue, &cmd, 0) == pdTRUE) {
    switch (cmd) {
      case CMD_ID_AURA:
        Serial.println("[Action] Wake word — window open");
        for (int i = 0; i < 3; i++) {
          digitalWrite(PIN_LED, HIGH); delay(200);
          digitalWrite(PIN_LED, LOW);  delay(200);
        }
        break;

      case CMD_ID_SPRAY:
        Serial.println("[Action] SPRAY — pushing to Firebase...");
        digitalWrite(PIN_LED, HIGH);
        ledActive    = true;
        ledStartTime = millis();
        pushSprayEvent();
        break;

      case CMD_ID_STOP:
        Serial.println("[Action] STOP");
        digitalWrite(PIN_LED, LOW);
        ledActive = false;
        break;
    }
  }

  updateLED();

  // Firebase token refresh (required by the library)
  if (firebaseReady) Firebase.ready();
}


// ============================================================
//                      connectWiFi()
// ============================================================
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t > WIFI_TIMEOUT_MS) {
      Serial.println("\n[WiFi] Timeout — continuing offline");
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
}


// ============================================================
//                        syncNTP()
// ============================================================
void syncNTP() {
  // UTC; adjust the second argument (seconds) for your timezone if desired
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("[NTP] Syncing");
  unsigned long t = millis();
  while (time(nullptr) < 1000000000UL) {
    if (millis() - t > 10000) { Serial.println(" timeout"); return; }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[NTP] Time synced — Unix: %llu\n", (unsigned long long)time(nullptr));
}


// ============================================================
//                      initFirebase()
// ============================================================
void initFirebase() {
  // Legacy database secret — bypasses GITKit token auth entirely.
  // No Authentication setup needed in Firebase Console.
  fbConfig.database_url              = FIREBASE_DATABASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_DATABASE_SECRET;

  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  firebaseReady = true;
  Serial.println("[Firebase] Ready (legacy token)");
}


// ============================================================
//                     pushSprayEvent()
// ============================================================
void pushSprayEvent() {
  if (!firebaseReady) {
    Serial.println("[Firebase] Not ready — skipping push");
    return;
  }
  if (!Firebase.ready()) {
    Serial.println("[Firebase] Token not ready — skipping push");
    return;
  }

  // Build ISO timestamp string (UTC)
  time_t now = time(nullptr);
  struct tm *t = gmtime(&now);
  char iso[32];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", t);

  unsigned long long unixMs = (unsigned long long)now * 1000ULL;

  FirebaseJson json;
  json.set("command",   "spray");
  json.set("unixMs",    (double)unixMs);
  json.set("iso",       iso);

  Serial.printf("[Firebase] Pushing spray event — %s\n", iso);

  if (Firebase.RTDB.pushJSON(&fbdo, "/spray_events", &json)) {
    Serial.printf("[Firebase] OK — key: %s\n", fbdo.pushName().c_str());
  } else {
    Serial.printf("[Firebase] FAILED: %s\n", fbdo.errorReason().c_str());
  }
}


// ============================================================
//                        initI2S()
// ============================================================
void initI2S() {
  i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
  chan_cfg.dma_desc_num  = DMA_BUF_COUNT;
  chan_cfg.dma_frame_num = DMA_BUF_LEN;
  ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, NULL, &rx_chan));

  i2s_std_config_t std_cfg = {
    .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(I2S_SAMPLE_RATE),
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
  Serial.printf("[I2S] SPH0645 ready (%d Hz)\n", I2S_SAMPLE_RATE);
}


// ============================================================
//                      initESPSR()
// ============================================================
bool initESPSR() {
  srmodel_list_t *models = esp_srmodel_init("model");
  if (!models) {
    Serial.println("[ESP-SR] ERROR: model init failed");
    return false;
  }
  Serial.printf("[ESP-SR] Found %d model(s)\n", models->num);

  afe_config_t *afe_cfg = afe_config_init("M", models, AFE_TYPE_SR, AFE_MODE_LOW_COST);
  if (!afe_cfg) { Serial.println("[ESP-SR] ERROR: AFE config failed"); return false; }

  if (psramFound()) {
    afe_cfg->memory_alloc_mode = AFE_MEMORY_ALLOC_MORE_PSRAM;
  } else {
    afe_cfg->memory_alloc_mode = AFE_MEMORY_ALLOC_MORE_INTERNAL;
  }
  afe_cfg->aec_init     = false;
  afe_cfg->wakenet_init = false;

  afe_handle = esp_afe_handle_from_config(afe_cfg);
  if (!afe_handle) { afe_config_free(afe_cfg); return false; }

  afe_data = afe_handle->create_from_config(afe_cfg);
  afe_config_free(afe_cfg);
  if (!afe_data) { Serial.println("[ESP-SR] ERROR: AFE create failed"); return false; }
  Serial.println("[ESP-SR] AFE ready");

  char *mn_name = esp_srmodel_filter(models, ESP_MN_PREFIX, ESP_MN_ENGLISH);
  if (!mn_name) { Serial.println("[ESP-SR] ERROR: no English model"); return false; }
  Serial.printf("[ESP-SR] Model: %s\n", mn_name);

  multinet   = esp_mn_handle_from_name(mn_name);
  model_data = multinet->create(mn_name, 6000);
  if (!model_data) { Serial.println("[ESP-SR] ERROR: MultiNet create failed"); return false; }

  esp_mn_commands_alloc(multinet, model_data);
  esp_mn_commands_add(CMD_ID_AURA,  "aura");
  esp_mn_commands_add(CMD_ID_SPRAY, "spray");
  esp_mn_commands_add(CMD_ID_STOP,  "stop");
  esp_mn_commands_update();

  Serial.println("[ESP-SR] Commands: aura / spray / stop");
  return true;
}


// ============================================================
//                    srProcessingTask()  [Core 1]
// ============================================================
void srProcessingTask(void *pvParam) {
  int chunkSamples = afe_handle->get_feed_chunksize(afe_data);

  // Read 2x to de-interleave L+R DMA slots (see VoiceTest comments)
  int32_t *i32Buf = (int32_t *)ps_malloc(2 * chunkSamples * sizeof(int32_t));
  int16_t *i16Buf = (int16_t *)malloc(chunkSamples * sizeof(int16_t));
  if (!i32Buf || !i16Buf) {
    Serial.println("[SR Task] ERROR: buffer alloc failed");
    free(i32Buf); free(i16Buf);
    vTaskDelete(NULL);
    return;
  }

  Serial.printf("[SR Task] chunk=%d samples, listening...\n", chunkSamples);

  vad_state_t lastVad = VAD_SILENCE;

  while (true) {
    size_t bytesRead = 0;
    esp_err_t err = i2s_channel_read(rx_chan,
                                      i32Buf,
                                      2 * chunkSamples * sizeof(int32_t),
                                      &bytesRead,
                                      portMAX_DELAY);
    if (err != ESP_OK || bytesRead == 0) { vTaskDelay(1); continue; }

    int totalRead   = bytesRead / sizeof(int32_t);
    int samplesRead = totalRead / 2;

    // De-interleave + 32->16 bit
    for (int i = 0; i < samplesRead; i++) {
      i16Buf[i] = (int16_t)(i32Buf[i * 2] >> 16);
    }

    afe_handle->feed(afe_data, i16Buf);
    afe_fetch_result_t *res = afe_handle->fetch(afe_data);
    if (!res) { vTaskDelay(1); continue; }

    // Wake-word window timeout
    if (sysState == SYS_LISTENING &&
        millis() - listenStart > LISTEN_WINDOW_MS) {
      sysState = SYS_IDLE;
      Serial.println("[Wake] Window timed out");
    }

    // VAD logging
    if (res->vad_state != lastVad) {
      lastVad = res->vad_state;
      Serial.println(lastVad == VAD_SPEECH ? "[VAD on]" : "[VAD off]");
    }

    // MultiNet recognition
    if (res->vad_state == VAD_SPEECH) {
      esp_mn_state_t mn_state = multinet->detect(model_data, res->data);
      if (mn_state == ESP_MN_STATE_DETECTED) {
        esp_mn_results_t *mn_result = multinet->get_results(model_data);
        if (mn_result && mn_result->num > 0) {
          int cmd_id = mn_result->command_id[0];

          if (cmd_id == CMD_ID_AURA) {
            sysState    = SYS_LISTENING;
            listenStart = millis();
            Serial.printf("[Wake] 'aura' (%.2f) — window open\n", mn_result->prob[0]);
            xQueueSend(cmdQueue, &cmd_id, 0);

          } else if (sysState == SYS_LISTENING) {
            sysState = SYS_IDLE;
            Serial.printf("[Cmd] '%s' (%.2f)\n", mn_result->string, mn_result->prob[0]);
            xQueueSend(cmdQueue, &cmd_id, 0);

          } else {
            Serial.printf("[ignored] '%s' — say 'aura' first\n", mn_result->string);
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


// ============================================================
//                       updateLED()
// ============================================================
void updateLED() {
  if (!ledActive) return;
  if (millis() - ledStartTime >= LED_ON_DURATION_MS) {
    digitalWrite(PIN_LED, LOW);
    ledActive = false;
  }
}
