/**
 * ============================================================
 * AuraSync v3 — Two-layer state machine
 * ============================================================
 * Layer 1 — System mode:  SLEEP ↔ AWAKE  (PIR-driven)
 * Layer 2 — Spray state:  IDLE → SPRAYING → COOLDOWN → IDLE
 *
 * Priority (high → low):
 *   P1 Voice / App  bypass CD; Spray only in AWAKE; Stop always
 *   P2 BME680 VOC   works in SLEEP; waits (pending) during CD
 *   P3 PIR+VOC      AWAKE+IDLE only; respects CD
 *
 * Build:
 *   Partition Scheme → Custom (partitions.csv)
 *   PSRAM            → OPI PSRAM
 *   Libraries        → Firebase Arduino Client (Mobizt)
 *                      Adafruit BME680 + Adafruit Unified Sensor
 *
 * Wiring:
 *   SPH0645 SCK → D8  (GPIO7)   SPH0645 WS  → D9  (GPIO8)
 *   SPH0645 SD  → D10 (GPIO9)   SPH0645 SEL → GND
 *   BME680 SDA  → D4  (GPIO5)   BME680 SCL  → D5  (GPIO6)
 *   PIR OUT     → D1  (GPIO2)   PIR VCC     → 3.3V
 *   Atomizer FET→ D3  (GPIO4)
 * ============================================================
 */

// ── Test / Production mode ────────────────────────────────────
#define TEST_MODE   // comment out for production 3-min CD

#ifdef TEST_MODE
  #define SPRAY_CD_MS        20000UL  // absolute cooldown (shared)
  #define BME_SLEEP_MS       10000UL  // BME sampling interval while SLEEP
#else
  #define SPRAY_CD_MS       180000UL  // 3 minutes
  #define BME_SLEEP_MS       30000UL
#endif

// ── Includes ─────────────────────────────────────────────────
#include <WiFi.h>
#include <time.h>
#include <Wire.h>
#include <Firebase_ESP_Client.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include "driver/i2s_std.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_heap_caps.h"
#include "esp_afe_sr_iface.h"
#include "esp_afe_sr_models.h"
#include "esp_afe_config.h"
#include "esp_mn_iface.h"
#include "esp_mn_models.h"
#include "model_path.h"
#include "esp_mn_speech_commands.h"
#include "secrets.h"

// ── Pins / I2S ───────────────────────────────────────────────
#define I2S_SCK         D8      // GPIO7
#define I2S_WS          D9      // GPIO8
#define I2S_SD          D10     // GPIO9
#define PIN_PIR         2       // GPIO2
#define PIN_ATOMIZER    4       // GPIO4
#define PIN_LED         21

#define I2S_SAMPLE_RATE 16000
#define DMA_BUF_COUNT   4
#define DMA_BUF_LEN     256

static i2s_chan_handle_t rx_chan = NULL;

// ── Voice command IDs ─────────────────────────────────────────
#define CMD_ID_AURA   0
#define CMD_ID_SPRAY  1
#define CMD_ID_STOP   2

// ── Timing ───────────────────────────────────────────────────
#define SPRAY_MS           5000UL   // atomizer on-duration
#define AWAKE_TIMEOUT_MS  60000UL   // no PIR for 60s → SLEEP
#define PIR_HOLD_MS        3000UL   // PIR hold to count as "detected"
#define PIR_GRACE_MS       1500UL
#define P3_PIR_WINDOW_MS   5000UL   // PIR counts as "active" for this long
#define BME_AWAKE_MS       3000UL   // BME sampling interval while AWAKE
#define P2_GAS_THRESHOLD   10000.0f // ohms; below = extreme odor
#define VOICE_WINDOW_MS    7000UL   // Aura → Spray window
#define FB_POLL_MS         3000UL

const unsigned long WIFI_TIMEOUT_MS = 15000;

// ════════════════════════════════════════════════════════════
//  Layer 1 — System mode
// ════════════════════════════════════════════════════════════
enum SysMode { MODE_SLEEP, MODE_AWAKE };
volatile SysMode sysMode = MODE_SLEEP;

static unsigned long lastPirHighMs   = 0;  // last confirmed PIR HIGH
static unsigned long pirFirstMs      = 0;  // PIR hold start

// ════════════════════════════════════════════════════════════
//  Layer 2 — Spray state
// ════════════════════════════════════════════════════════════
enum SprayState { SPRAY_IDLE, SPRAY_SPRAYING, SPRAY_COOLDOWN };
volatile SprayState sprayState  = SPRAY_IDLE;
static unsigned long sprayStateMs = 0;  // millis when state entered
static char activeTrigger[16]   = "none";

// P2 fires during COOLDOWN → spray when CD expires
static bool p2Pending = false;

// ════════════════════════════════════════════════════════════
//  Voice listen window (P1 internal)
// ════════════════════════════════════════════════════════════
static bool          voiceWindow      = false;
static unsigned long voiceWindowStart = 0;

// SR task writes these just before xQueueSend; loop() reads after dequeue
// Single-producer single-consumer, no mutex needed
volatile float lastWordProb    = 0.0f;
volatile char  lastWordStr[16] = {};

// ════════════════════════════════════════════════════════════
//  BME680
// ════════════════════════════════════════════════════════════
Adafruit_BME680 bme;
bool            bmeReady    = false;
static unsigned long lastBmeMs   = 0;
static float    gasHistory[8]    = {};  // circular buffer (ohms)
static int      gasHistIdx       = 0;
static int      gasHistCount     = 0;

// ════════════════════════════════════════════════════════════
//  ESP-SR
// ════════════════════════════════════════════════════════════
static const esp_afe_sr_iface_t *afe_handle = NULL;
static esp_afe_sr_data_t        *afe_data   = NULL;
static esp_mn_iface_t           *multinet   = NULL;
static model_iface_data_t       *model_data = NULL;
static QueueHandle_t             cmdQueue   = NULL;
TaskHandle_t                     srTaskHandle = NULL;

// ════════════════════════════════════════════════════════════
//  Firebase
// ════════════════════════════════════════════════════════════
FirebaseData   fbdo;
FirebaseData   fbCmd;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;
bool           firebaseReady = false;
static unsigned long lastFbPollMs = 0;

// ── Forward declarations ──────────────────────────────────────
void connectWiFi();
void syncNTP();
void initFirebase();
void initI2S();
bool initESPSR();
bool initBME680();
void srProcessingTask(void *pvParam);
void pushSprayEvent(const char *trigger, unsigned long durationMs);

void enterMode(SysMode m);
void updateMode();
void enterSprayState(SprayState s);
void startSpray(const char *trigger, bool bypassCD);
void stopSpray();
void updateSpray();
void processVoiceCmd(int cmd);
void pollBME();
void pollFirebaseCommands();
bool detectVocInflection();


// ════════════════════════════════════════════════════════════
//  setup()
// ════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);

  if (!psramInit()) Serial.println("ERROR:psram_failed");

  pinMode(PIN_LED,      OUTPUT); digitalWrite(PIN_LED,      LOW);
  pinMode(PIN_ATOMIZER, OUTPUT); digitalWrite(PIN_ATOMIZER, LOW);
  pinMode(PIN_PIR,      INPUT);

  Wire.begin(5, 6);  // SDA=GPIO5, SCL=GPIO6
  bmeReady = initBME680();

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
      12 * 1024, NULL, configMAX_PRIORITIES - 1, &srTaskHandle, 1
    );
    if (ret != pdPASS) Serial.println("ERROR:sr_task_failed");
  } else {
    Serial.println("ERROR:espsr_init_failed");
  }

  enterMode(MODE_SLEEP);
  enterSprayState(SPRAY_IDLE);
}


// ════════════════════════════════════════════════════════════
//  loop()  [Core 0]
// ════════════════════════════════════════════════════════════
void loop() {
  updateMode();   // Layer 1
  updateSpray();  // Layer 2 timers

  int cmd;
  if (xQueueReceive(cmdQueue, &cmd, 0) == pdTRUE) {
    processVoiceCmd(cmd);  // P1
  }

  // Expire voice window without a follow-up command
  if (voiceWindow && millis() - voiceWindowStart >= VOICE_WINDOW_MS) {
    voiceWindow = false;
  }

  pollBME();               // P2 + P3
  pollFirebaseCommands();  // App

  if (firebaseReady) Firebase.ready();

  // SLEEP mode: throttle Core 0 poll rate to reduce idle CPU burn.
  // 80ms is safe — PIR_HOLD_MS is 3000ms so we won't miss a detection.
  // SR task (Core 1) runs unaffected; voice remains fully responsive.
  if (sysMode == MODE_SLEEP) delay(80);
}


// ════════════════════════════════════════════════════════════
//  Layer 1 — mode transitions
// ════════════════════════════════════════════════════════════
void enterMode(SysMode m) {
  sysMode = m;
  Serial.println(m == MODE_AWAKE ? "MODE:awake" : "MODE:sleep");
}

void updateMode() {
  unsigned long now    = millis();
  bool          pirHigh = digitalRead(PIN_PIR);

  if (pirHigh) {
    lastPirHighMs = now;
    if (pirFirstMs == 0) pirFirstMs = now;
    if (sysMode == MODE_SLEEP) enterMode(MODE_AWAKE);
  } else if (now - lastPirHighMs > PIR_GRACE_MS) {
    pirFirstMs = 0;
  }

  if (sysMode == MODE_AWAKE && now - lastPirHighMs >= AWAKE_TIMEOUT_MS) {
    enterMode(MODE_SLEEP);
  }
}


// ════════════════════════════════════════════════════════════
//  Layer 2 — spray state transitions
// ════════════════════════════════════════════════════════════
void enterSprayState(SprayState s) {
  sprayState   = s;
  sprayStateMs = millis();
  switch (s) {
    case SPRAY_IDLE:     Serial.println("SPRAY:idle");     break;
    case SPRAY_SPRAYING: Serial.println("SPRAY:spraying"); break;
    case SPRAY_COOLDOWN: Serial.println("SPRAY:cooldown"); break;
  }
}

// bypassCD=true: voice / app (can re-spray during COOLDOWN)
// bypassCD=false: all sensor triggers (blocked by COOLDOWN)
void startSpray(const char *trigger, bool bypassCD) {
  if (sprayState == SPRAY_SPRAYING) return;
  if (sprayState == SPRAY_COOLDOWN && !bypassCD) return;
  strncpy(activeTrigger, trigger, sizeof(activeTrigger) - 1);
  activeTrigger[sizeof(activeTrigger) - 1] = '\0';
  digitalWrite(PIN_ATOMIZER, HIGH);
  digitalWrite(PIN_LED,      HIGH);
  enterSprayState(SPRAY_SPRAYING);
}

void stopSpray() {
  if (sprayState != SPRAY_SPRAYING) return;
  unsigned long actual = millis() - sprayStateMs;
  digitalWrite(PIN_ATOMIZER, LOW);
  digitalWrite(PIN_LED,      LOW);
  enterSprayState(SPRAY_COOLDOWN);
  pushSprayEvent(activeTrigger, actual);
}

void updateSpray() {
  unsigned long elapsed = millis() - sprayStateMs;

  switch (sprayState) {
    case SPRAY_SPRAYING:
      if (elapsed >= SPRAY_MS) {
        digitalWrite(PIN_ATOMIZER, LOW);
        digitalWrite(PIN_LED,      LOW);
        pushSprayEvent(activeTrigger, SPRAY_MS);
        enterSprayState(SPRAY_COOLDOWN);
      }
      break;

    case SPRAY_COOLDOWN:
      if (elapsed >= SPRAY_CD_MS) {
        enterSprayState(SPRAY_IDLE);
        if (p2Pending) {
          p2Pending = false;
          startSpray("p2_voc", false);
        }
      }
      break;

    default: break;
  }
}


// ════════════════════════════════════════════════════════════
//  P1 — Voice commands  (bypass CD; Spray only in AWAKE)
// ════════════════════════════════════════════════════════════
void processVoiceCmd(int cmd) {
  bool inWindow = voiceWindow && (millis() - voiceWindowStart < VOICE_WINDOW_MS);

  switch (cmd) {

    case CMD_ID_AURA:
      // Aura is the wake word — always print, always open window
      voiceWindow      = true;
      voiceWindowStart = millis();
      Serial.println("VOICE:aura");
      for (int i = 0; i < 2; i++) {
        digitalWrite(PIN_LED, HIGH); delay(150);
        digitalWrite(PIN_LED, LOW);  delay(150);
      }
      break;

    case CMD_ID_SPRAY:
      if (inWindow) {
        // Only print if in window (counts); outside = false positive, ignore silently
        Serial.printf("WORD:%s:%.2f\n", (const char *)lastWordStr, lastWordProb);
        voiceWindow = false;
        startSpray("voice", true);      // bypass CD; works in SLEEP and AWAKE
        if (sysMode == MODE_SLEEP) {    // wake system when voice triggers spray
          enterMode(MODE_AWAKE);
          lastPirHighMs = millis();
        }
      }
      break;

    case CMD_ID_STOP:
      if (inWindow || sprayState == SPRAY_SPRAYING) {
        // Print if in window, or if actively stopping a spray (always meaningful)
        Serial.printf("WORD:%s:%.2f\n", (const char *)lastWordStr, lastWordProb);
        voiceWindow = false;
        if (sprayState == SPRAY_SPRAYING) stopSpray();
      }
      break;
  }
}


// ════════════════════════════════════════════════════════════
//  P2 + P3 — BME680 sensor polling
// ════════════════════════════════════════════════════════════
bool detectVocInflection() {
  // Need 4+ samples; inflection = was declining, now rising
  // Rising gas resistance = VOC concentration dropping = "after peak"
  if (gasHistCount < 4) return false;
  int i3 = (gasHistIdx - 4 + 8) % 8;
  int i2 = (gasHistIdx - 3 + 8) % 8;
  int i1 = (gasHistIdx - 2 + 8) % 8;
  int i0 = (gasHistIdx - 1 + 8) % 8;
  bool wasDeclining = (gasHistory[i2] < gasHistory[i3]) && (gasHistory[i1] < gasHistory[i2]);
  bool nowRising    = (gasHistory[i0] > gasHistory[i1]);
  return wasDeclining && nowRising;
}

void pollBME() {
  if (!bmeReady) return;
  unsigned long interval = (sysMode == MODE_AWAKE) ? BME_AWAKE_MS : BME_SLEEP_MS;
  if (millis() - lastBmeMs < interval) return;
  lastBmeMs = millis();

  if (!bme.performReading()) return;

  float gasR = (float)bme.gas_resistance;  // ohms

  // Store in history ring buffer
  gasHistory[gasHistIdx] = gasR;
  gasHistIdx  = (gasHistIdx + 1) % 8;
  if (gasHistCount < 8) gasHistCount++;

  // ── P2: extreme odor — works in any mode, waits during COOLDOWN ──
  if (gasR < P2_GAS_THRESHOLD) {
    if (sprayState == SPRAY_SPRAYING) {
      // already spraying, do nothing
    } else if (sprayState == SPRAY_COOLDOWN) {
      p2Pending = true;  // fire when CD expires
    } else {
      // SPRAY_IDLE (from SLEEP or AWAKE)
      if (sysMode == MODE_SLEEP) {
        enterMode(MODE_AWAKE);
        lastPirHighMs = millis();  // reset awake timer
      }
      startSpray("p2_voc", false);
    }
  }

  // ── P3: PIR + VOC inflection — AWAKE + IDLE only, respects CD ──
  if (sysMode == MODE_AWAKE && sprayState == SPRAY_IDLE) {
    bool pirRecent = (millis() - lastPirHighMs < P3_PIR_WINDOW_MS);
    if (pirRecent && detectVocInflection()) {
      startSpray("p3_inflection", false);
    }
  }
}


// ════════════════════════════════════════════════════════════
//  App — Firebase command polling  (same priority as voice)
// ════════════════════════════════════════════════════════════
void pollFirebaseCommands() {
  if (!firebaseReady) return;
  if (millis() - lastFbPollMs < FB_POLL_MS) return;
  lastFbPollMs = millis();

  if (!Firebase.RTDB.getString(&fbCmd, "/commands/action")) return;
  String action = fbCmd.stringData();
  if (action.length() == 0) return;

  // Clear immediately to prevent re-processing
  Firebase.RTDB.setString(&fbCmd, "/commands/action", "");

  if (action == "spray") {
    // App Spray: same restriction as voice — only in AWAKE
    if (sysMode == MODE_AWAKE) {
      startSpray("app", true);  // bypass CD
    }
  } else if (action == "stop") {
    // App Stop: works in any mode
    if (sprayState == SPRAY_SPRAYING) stopSpray();
  }
}


// ════════════════════════════════════════════════════════════
//  connectWiFi / syncNTP / initFirebase
// ════════════════════════════════════════════════════════════
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t > WIFI_TIMEOUT_MS) return;
    delay(500);
  }
  // Modem sleep: WiFi radio sleeps between beacon intervals (~100ms DTIM)
  // Saves ~100mA average while idle; wakes automatically for TX/RX
  WiFi.setSleep(WIFI_PS_MAX_MODEM);
}

void syncNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  unsigned long t = millis();
  while (time(nullptr) < 1000000000UL) {
    if (millis() - t > 10000) return;
    delay(500);
  }
}

void initFirebase() {
  fbConfig.database_url               = FIREBASE_DATABASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_DATABASE_SECRET;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  firebaseReady = true;
}


// ════════════════════════════════════════════════════════════
//  pushSprayEvent()
// ════════════════════════════════════════════════════════════
void pushSprayEvent(const char *trigger, unsigned long durationMs) {
  if (!firebaseReady || !Firebase.ready()) return;
  time_t now = time(nullptr);
  char   iso[32];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));

  FirebaseJson json;
  json.set("trigger",     trigger);
  json.set("command",     "spray");
  json.set("duration_ms", (int)durationMs);
  json.set("unixMs",      (double)((unsigned long long)now * 1000ULL));
  json.set("iso",         iso);

  if (!Firebase.RTDB.pushJSON(&fbdo, "/spray_events", &json)) {
    Serial.printf("ERROR:firebase:%s\n", fbdo.errorReason().c_str());
  }
}


// ════════════════════════════════════════════════════════════
//  initBME680()
// ════════════════════════════════════════════════════════════
bool initBME680() {
  if (!bme.begin(0x76) && !bme.begin(0x77)) {
    Serial.println("ERROR:bme680_not_found");
    return false;
  }
  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);  // 320°C heater, 150ms
  return true;
}


// ════════════════════════════════════════════════════════════
//  initI2S()
// ════════════════════════════════════════════════════════════
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
}


// ════════════════════════════════════════════════════════════
//  initESPSR()
// ════════════════════════════════════════════════════════════
bool initESPSR() {
  srmodel_list_t *models = esp_srmodel_init("model");
  if (!models) { Serial.println("ERROR:espsr_no_model"); return false; }

  afe_config_t *afe_cfg = afe_config_init("M", models, AFE_TYPE_SR, AFE_MODE_LOW_COST);
  if (!afe_cfg) { Serial.println("ERROR:afe_config"); return false; }

  afe_cfg->memory_alloc_mode = psramFound()
    ? AFE_MEMORY_ALLOC_MORE_PSRAM : AFE_MEMORY_ALLOC_MORE_INTERNAL;
  afe_cfg->aec_init     = false;
  afe_cfg->wakenet_init = false;
  afe_cfg->vad_mode     = VAD_MODE_4;  // most aggressive speech detection

  afe_handle = esp_afe_handle_from_config(afe_cfg);
  if (!afe_handle) { afe_config_free(afe_cfg); return false; }

  afe_data = afe_handle->create_from_config(afe_cfg);
  afe_config_free(afe_cfg);
  if (!afe_data) { Serial.println("ERROR:afe_create"); return false; }

  char *mn_name = esp_srmodel_filter(models, ESP_MN_PREFIX, ESP_MN_ENGLISH);
  if (!mn_name) { Serial.println("ERROR:no_en_model"); return false; }

  multinet   = esp_mn_handle_from_name(mn_name);
  model_data = multinet->create(mn_name, 6000);
  if (!model_data) { Serial.println("ERROR:multinet_create"); return false; }

  esp_mn_commands_alloc(multinet, model_data);
  esp_mn_commands_add(CMD_ID_AURA,  "aura");
  esp_mn_commands_add(CMD_ID_SPRAY, "spray");
  esp_mn_commands_add(CMD_ID_STOP,  "stop");
  esp_mn_commands_update();
  multinet->set_det_threshold(model_data, 0.0f);  // max sensitivity
  return true;
}


// ════════════════════════════════════════════════════════════
//  srProcessingTask()  [Core 1]
// ════════════════════════════════════════════════════════════
void srProcessingTask(void *pvParam) {
  int chunkSamples = afe_handle->get_feed_chunksize(afe_data);
  int32_t *i32Buf  = (int32_t *)ps_malloc(2 * chunkSamples * sizeof(int32_t));
  int16_t *i16Buf  = (int16_t *)malloc(chunkSamples * sizeof(int16_t));
  if (!i32Buf || !i16Buf) {
    Serial.println("ERROR:sr_buf_alloc");
    free(i32Buf); free(i16Buf);
    vTaskDelete(NULL);
    return;
  }

  while (true) {
    size_t    bytesRead = 0;
    esp_err_t err = i2s_channel_read(rx_chan,
                                     i32Buf,
                                     2 * chunkSamples * sizeof(int32_t),
                                     &bytesRead,
                                     portMAX_DELAY);
    if (err != ESP_OK || bytesRead == 0) { vTaskDelay(1); continue; }

    int samplesRead = (bytesRead / sizeof(int32_t)) / 2;
    for (int i = 0; i < samplesRead; i++) {
      i16Buf[i] = (int16_t)(i32Buf[i * 2] >> 16);
    }

    afe_handle->feed(afe_data, i16Buf);
    afe_fetch_result_t *res = afe_handle->fetch(afe_data);
    if (!res) { vTaskDelay(1); continue; }

    if (res->vad_state == VAD_SPEECH) {
      esp_mn_state_t mn_state = multinet->detect(model_data, res->data);
      if (mn_state == ESP_MN_STATE_DETECTED) {
        esp_mn_results_t *mn_result = multinet->get_results(model_data);
        if (mn_result && mn_result->num > 0) {
          int cmd_id = mn_result->command_id[0];
          // Write before send; loop() reads after dequeue (no race)
          lastWordProb = mn_result->prob[0];
          strncpy((char *)lastWordStr, mn_result->string, sizeof(lastWordStr) - 1);
          xQueueSend(cmdQueue, &cmd_id, 0);
        }
      }
    }

    vTaskDelay(1);
  }

  free(i32Buf);
  free(i16Buf);
  vTaskDelete(NULL);
}
