/*
 * ============================================================
 * AuraSync v4 — Two-layer state machine + on-device ML
 * ============================================================
 * Layer 1 — System mode:  SLEEP ↔ AWAKE  (PIR-driven)
 * Layer 2 — Spray state:  IDLE → SPRAYING → COOLDOWN → IDLE
 *
 * Trigger priority (high → low):
 *   P1  Voice / App     any mode incl. SLEEP; bypass cooldown
 *   P2  IAQ MLP         any mode incl. SLEEP; queues during cooldown
 *                       (consecutive Poor readings; replaces raw gas_ohm threshold)
 *   P3  Shower CNN      any mode incl. SLEEP; fires on shower-end transition
 *   P3  VOC inflection  AWAKE + IDLE only; gas_norm ↓ then ↑ + PIR within 5 s
 *
 * ML models (on-device inference, no cloud):
 *   iaq_model.h    — MLP (64-32), StandardScaler, 3 classes (Good/Moderate/Poor)
 *   shower_model.h — 1D-CNN, threshold 0.65, 30×6 sliding window
 *
 * Build:
 *   Partition Scheme → Custom (partitions.csv)
 *   PSRAM            → OPI PSRAM
 *   Libraries        → Firebase Arduino Client (Mobizt)
 *                      Bosch BSEC2
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
#else
  #define SPRAY_CD_MS       180000UL  // 3 minutes
#endif

// Increase loop() task stack to avoid overflow during CNN inference (~15KB peak)
SET_LOOP_TASK_STACK_SIZE(32 * 1024);

// ── Includes ─────────────────────────────────────────────────
#include <WiFi.h>
#include <time.h>
#include <Wire.h>
#include <Firebase_ESP_Client.h>
#include <bsec2.h>
#include "feature_buffer.h"
#include "iaq_model.h"
#include "shower_model.h"
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

// ── Demo mode ────────────────────────────────────────────────
// Uncomment for classroom demo: ~30s warmup, faster triggers.
// Comment out for production (9-min warmup, conservative thresholds).
#define DEMO_MODE

// ── Timing ───────────────────────────────────────────────────
#define SPRAY_MS           5000UL   // atomizer on-duration
#define AWAKE_TIMEOUT_MS  60000UL   // no PIR for 60s → SLEEP
#define PIR_HOLD_MS        3000UL   // PIR hold to count as "detected"
#define PIR_GRACE_MS       1500UL
#ifdef DEMO_MODE
  #define BSEC_DECIMATE            1    // push every callback (~3s per reading)
  #define IAQ_MIN_COUNT           10    // start IAQ after 10 readings (~30s)
  #define CNN_MIN_COUNT           10    // start CNN after 10 readings (~30s)
  #define IAQ_POOR_COUNT           2    // 2 × 3s = ~6s of bad air → spray
  #define SHOWER_CONSEC_MIN        2    // 2 × 15s = ~30s shower → spray
  #define P3_PIR_WINDOW_MS    60000UL  // PIR counts as "active" for 60s (demo)
  #define P3_INFLECT_WINDOW_MS 60000UL // inflection latch valid for 60s (demo)
#else
  #define BSEC_DECIMATE            3    // push every 3rd callback (~9s per reading)
  #define IAQ_MIN_COUNT           60    // start IAQ after 60 readings (~9min)
  #define CNN_MIN_COUNT           30    // start CNN after 30 readings (~4.5min)
  #define IAQ_POOR_COUNT           5    // 5 × 9s = ~45s
  #define SHOWER_CONSEC_MIN        6    // 6 × 45s = ~270s
  #define P3_PIR_WINDOW_MS      5000UL  // PIR counts as "active" for 5s
  #define P3_INFLECT_WINDOW_MS 30000UL  // inflection latch valid for 30s
#endif
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
//  BME680 / BSEC2
// ════════════════════════════════════════════════════════════
Bsec2 bsec2;
bool  bmeReady  = false;
static int bsecCallCnt = 0;  // decimation counter (push every 3 LP callbacks ≈ 9s)

// ── Ring buffer (defined here, declared extern in feature_buffer.h) ─────────
FBReading fb_ring[BUF_SIZE] = {};
int       fb_head            = 0;
int       fb_count           = 0;

// ── ML inference state ────────────────────────────────────────────────────────
static bool          wasShower       = false;
static int           showerConsec    = 0;
static int           mlSampleCnt     = 0;
static int           iaqPoorCount    = 0;
static unsigned long lastInflectionMs = 0;  // when last VOC inflection was detected

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
static unsigned long lastFbPollMs      = 0;
static unsigned long lastSensorPushMs  = 0;
static unsigned long lastSettingsPollMs = 0;
#define SENSOR_PUSH_MS   5000UL
#define SETTINGS_POLL_MS 10000UL
static bool autoSprayEnabled = true;

// ── Forward declarations ──────────────────────────────────────
void connectWiFi();
void syncNTP();
void initFirebase();
void initI2S();
bool initESPSR();
bool initBME680();
void srProcessingTask(void *pvParam);
void pushSprayEvent(const char *trigger, unsigned long durationMs);
void pushSensorData(float gas_ohm, float temp_c, float hum);
void pollFirebaseSettings();

void enterMode(SysMode m);
void updateMode();
void enterSprayState(SprayState s);
void startSpray(const char *trigger, bool bypassCD);
void stopSpray();
void updateSpray();
void processVoiceCmd(int cmd);
void onBsecData(const bme68xData data, const bsecOutputs outputs, const Bsec2 bsec);
void pollFirebaseCommands();


// ════════════════════════════════════════════════════════════
//  setup()
// ════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(5000);  // wait for USB CDC host to reconnect after reset
  Serial.println("=== AuraSync boot ===");

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

  if (bmeReady) bsec2.run();  // P2 + P3/P4 via bsecCallback
  pollFirebaseCommands();   // App commands
  pollFirebaseSettings();   // App settings (autoSpray toggle, duration)

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
    case SPRAY_SPRAYING: {
      const char *reason = "unknown";
      if      (strcmp(activeTrigger, "voice")         == 0) reason = "Voice command (Aura->Spray)";
      else if (strcmp(activeTrigger, "app")            == 0) reason = "App command";
      else if (strcmp(activeTrigger, "iaq_poor")       == 0) reason = "Poor air quality (IAQ ML model)";
      else if (strcmp(activeTrigger, "p3_shower_end")  == 0) reason = "Shower detected (CNN model)";
      else if (strcmp(activeTrigger, "p3_inflection")  == 0) reason = "VOC inflection + PIR";
      Serial.printf("SPRAY:spraying  reason=%s\n", reason);
      break;
    }
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
          startSpray("iaq_poor", false);
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
//  BSEC2 callback — sensor data + ML inference
//  Fires at ~3s (BSEC_SAMPLE_RATE_LP); decimated 3x to ~9s for ML.
// ════════════════════════════════════════════════════════════
void onBsecData(const bme68xData data, const bsecOutputs outputs, const Bsec2 bsec) {
  float gas_ohm = 0.0f, temp_c = 0.0f, hum = 0.0f;
  for (uint8_t i = 0; i < outputs.nOutputs; i++) {
    switch (outputs.output[i].sensor_id) {
      case BSEC_OUTPUT_RAW_GAS:
        gas_ohm = outputs.output[i].signal; break;
      case BSEC_OUTPUT_RAW_TEMPERATURE:
        temp_c  = outputs.output[i].signal; break;
      case BSEC_OUTPUT_RAW_HUMIDITY:
        hum     = outputs.output[i].signal; break;
    }
  }

  // ── Decimate: push every BSEC_DECIMATE callbacks ────────────
  if (++bsecCallCnt % BSEC_DECIMATE != 0 || gas_ohm <= 0.0f) return;
  Serial.printf("[BME] gas=%.0f t=%.1f h=%.1f cnt=%d\n", gas_ohm, temp_c, hum, fb_count);
  fb_push(gas_ohm, temp_c, hum);
  pushSensorData(gas_ohm, temp_c, hum);

  // ── IAQ: MLP classifier (any mode; wakes system; queues during cooldown) ──
  // Replaces raw gas_ohm threshold — model uses gas_norm + humidity + temp features.
  if (fb_count >= IAQ_MIN_COUNT) {
    float feat[10]; computeIAQFeatures(feat);
    int cls = predictIAQ(feat);  // 0=Good, 1=Moderate, 2=Poor
    Serial.printf("[IAQ] cls=%d gn=%.3f hum=%.1f gas=%.0f\n",
                  cls, fb_get_gas_norm(0), fb_get_hum(0), fb_at(0)->gas_ohm);
    if (cls == 2) {
      if (++iaqPoorCount >= IAQ_POOR_COUNT) {
        iaqPoorCount = 0;
        if (autoSprayEnabled) {
          if (sprayState == SPRAY_COOLDOWN) {
            p2Pending = true;
          } else if (sprayState == SPRAY_IDLE) {
            if (sysMode == MODE_SLEEP) { enterMode(MODE_AWAKE); lastPirHighMs = millis(); }
            startSpray("iaq_poor", false);
          }
        }
      }
    } else {
      iaqPoorCount = 0;
    }
  }

  // ── P3: VOC inflection + PIR (AWAKE + IDLE only) ────────────────
  if (fb_count >= 3) {
    float g0 = fb_get_gas_norm(0), g1 = fb_get_gas_norm(1), g2 = fb_get_gas_norm(2);
    bool wasDeclining = (g1 < g2);
    bool nowRising    = (g0 > g1);
    if (wasDeclining && nowRising) {
      lastInflectionMs = millis();
      Serial.printf("[P3] VOC inflection latched  gn=%.3f→%.3f→%.3f\n", g2, g1, g0);
    }

    bool inflectionRecent = (lastInflectionMs > 0 &&
                             millis() - lastInflectionMs < P3_INFLECT_WINDOW_MS);
    bool pirRecent        = (millis() - lastPirHighMs   < P3_PIR_WINDOW_MS);
    if (autoSprayEnabled && sysMode == MODE_AWAKE && sprayState == SPRAY_IDLE &&
        inflectionRecent && pirRecent) {
      lastInflectionMs = 0;
      startSpray("p3_inflection", false);
    }
  }

  // ── P3: Shower CNN (any mode; triggers on shower-end transition) ─
  if (fb_count >= CNN_MIN_COUNT && (++mlSampleCnt % 5 == 0)) {
    static float win[30][6]; computeShowerWindow(win);
    float prob = predictShower(win);
    bool isShower = (prob >= CNN_THRESHOLD);
    Serial.printf("[CNN] shower_prob=%.2f\n", prob);
    if (autoSprayEnabled && wasShower && !isShower && showerConsec >= SHOWER_CONSEC_MIN)
      startSpray("p3_shower_end", true);
    showerConsec = isShower ? showerConsec + 1 : 0;
    wasShower    = isShower;
  }
}


// ════════════════════════════════════════════════════════════
//  App — Firebase command polling  (same priority as voice)
// ════════════════════════════════════════════════════════════
void pollFirebaseCommands() {
  if (!firebaseReady) return;
  if (millis() - lastFbPollMs < FB_POLL_MS) return;
  lastFbPollMs = millis();

  // App writes a JSON object: {action, source, sprayDurationS, requestedAt}
  if (!Firebase.RTDB.getJSON(&fbCmd, "/commands/action")) return;

  FirebaseJson     *json = fbCmd.to<FirebaseJson *>();
  FirebaseJsonData  actionData;
  json->get(actionData, "action");
  if (!actionData.success) return;
  String action = actionData.to<String>();

  // Acknowledge by deleting the node → app sees snap.val() === null
  Firebase.RTDB.deleteNode(&fbdo, "/commands/action");

  Serial.printf("[App] command: %s\n", action.c_str());

  if (action == "spray") {
    startSpray("app", true);
    if (sysMode == MODE_SLEEP) { enterMode(MODE_AWAKE); lastPirHighMs = millis(); }
  } else if (action == "stop") {
    if (sprayState == SPRAY_SPRAYING) stopSpray();
  }
}


// ════════════════════════════════════════════════════════════
//  connectWiFi / syncNTP / initFirebase
// ════════════════════════════════════════════════════════════
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  for (int attempt = 1; attempt <= 3; attempt++) {
    Serial.printf("WiFi: connecting to \"%s\" (attempt %d/3)...\n", WIFI_SSID, attempt);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED) {
      if (millis() - t > WIFI_TIMEOUT_MS) break;
      delay(500);
      Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      WiFi.setSleep(WIFI_PS_MIN_MODEM);
      Serial.printf("WiFi: OK  IP=%s\n", WiFi.localIP().toString().c_str());
      return;
    }
    Serial.printf("WiFi: attempt %d failed (status=%d)\n", attempt, WiFi.status());
    WiFi.disconnect(true);
    delay(1000);
  }
  Serial.println("WiFi: FAILED after 3 attempts");
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

void pushSensorData(float gas_ohm, float temp_c, float hum) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (millis() - lastSensorPushMs < SENSOR_PUSH_MS) return;
  lastSensorPushMs = millis();

  const char *ctx = "idle";
  if      (sprayState == SPRAY_SPRAYING)  ctx = "spraying";
  else if (sprayState == SPRAY_COOLDOWN)  ctx = "cooldown";
  else if (sysMode    == MODE_AWAKE)      ctx = "awake";

  FirebaseJson json;
  json.set("gas_ohm",      gas_ohm);
  json.set("temp_c",       temp_c);
  json.set("humidity_pct", hum);
  json.set("context",      ctx);
  json.set("updatedAt",    (double)((unsigned long long)time(nullptr) * 1000ULL));

  Firebase.RTDB.setJSON(&fbdo, "/sensors/latest", &json);
}

void pollFirebaseSettings() {
  if (!firebaseReady) return;
  if (millis() - lastSettingsPollMs < SETTINGS_POLL_MS) return;
  lastSettingsPollMs = millis();

  if (Firebase.RTDB.getBool(&fbCmd, "/settings/autoSprayEnabled")) {
    bool prev = autoSprayEnabled;
    autoSprayEnabled = fbCmd.boolData();
    if (autoSprayEnabled != prev)
      Serial.printf("[Settings] autoSpray=%s\n", autoSprayEnabled ? "ON" : "OFF");
  }
}


// ════════════════════════════════════════════════════════════
//  initBME680() — BSEC2
// ════════════════════════════════════════════════════════════
bool initBME680() {
  bsecSensor subs[] = {
    BSEC_OUTPUT_IAQ,
    BSEC_OUTPUT_RAW_GAS,
    BSEC_OUTPUT_RAW_TEMPERATURE,
    BSEC_OUTPUT_RAW_HUMIDITY,
  };
  if (!bsec2.begin(BME68X_I2C_ADDR_HIGH, Wire)) {
    Serial.println("ERROR:bme680_not_found");
    return false;
  }
  if (!bsec2.updateSubscription(subs, 4, BSEC_SAMPLE_RATE_LP)) {
    if (bsec2.status < 0) {
      Serial.printf("ERROR:bsec2_subscription (status=%d)\n", (int)bsec2.status);
      return false;
    }
    Serial.printf("WARN:bsec2_subscription (status=%d), continuing\n", (int)bsec2.status);
  }
  bsec2.attachCallback(onBsecData);
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
  multinet->set_det_threshold(model_data, 0.6f);
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
