/*
 * VOCLogger — BME680 + BSEC2 IAQ data collection
 *
 * Uses Bosch BSEC2 library (ESP32-S3 compatible) for calibrated IAQ output.
 * BSEC2 uses a callback model: outputs are captured in onBsecData() and
 * stored in the `latest` struct; Firebase push reads from there.
 *
 * Board  : Seeed XIAO ESP32-S3 (native USB CDC)
 */

#include <WiFi.h>
#include <Wire.h>
#include <time.h>
#include <Preferences.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "bsec2.h"
#include "secrets.h"

// ── Pins ──────────────────────────────────────────────────────────────────────
#define PIN_SDA  5
#define PIN_SCL  6
#define PIN_LED  21

// ── Timing ────────────────────────────────────────────────────────────────────
#define PUSH_INTERVAL_MS   10000UL
#define STATE_SAVE_PERIOD  200
#define WIFI_TIMEOUT_MS    20000UL

// ── Firebase ──────────────────────────────────────────────────────────────────
FirebaseData   fbdo;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;
bool           fbReady     = false;
int            fbFailCount = 0;
const int      FB_FAIL_LIMIT = 5;

// ── BSEC2 ─────────────────────────────────────────────────────────────────────
Bsec2       iaqSensor;
Preferences prefs;
uint32_t    bsecCycleCount = 0;
bool        newBsecData    = false;
int         dbgBeginRet    = -1;
int         dbgStatus      = -1;

struct {
    float   temperature   = 0;
    float   humidity      = 0;
    float   pressure      = 0;
    float   gasResistance = 0;
    float   iaq           = 0;
    uint8_t iaqAccuracy   = 0;
    float   staticIaq     = 0;
    float   co2Equivalent = 0;
    float   breathVoc     = 0;
    bool    heaterStable  = false;
} latest;

// ── Session state ─────────────────────────────────────────────────────────────
char sessionId[32];
char sessionPath[64];
unsigned long bootMs = 0;

// ── Push timing ───────────────────────────────────────────────────────────────
unsigned long lastPushMs = 0;
bool          firstPush  = true;

// ── LED ───────────────────────────────────────────────────────────────────────
unsigned long lastLedMs  = 0;
bool          ledState   = false;
bool          errorState = false;

// ─────────────────────────────────────────────────────────────────────────────

void setError(bool err) { errorState = err; }

void blinkLED() {
  unsigned long interval = errorState ? 100UL : 500UL;
  if (millis() - lastLedMs < interval) return;
  lastLedMs = millis();
  ledState  = !ledState;
  digitalWrite(PIN_LED, ledState ? HIGH : LOW);
}

// ── BSEC2 callback ────────────────────────────────────────────────────────────
void onBsecData(const bme68xData data, const bsecOutputs outputs, const Bsec2 bsec) {
  if (!outputs.nOutputs) return;
  for (uint8_t i = 0; i < outputs.nOutputs; i++) {
    const bsecData& o = outputs.output[i];
    switch (o.sensor_id) {
      case BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_TEMPERATURE:
        latest.temperature   = o.signal; break;
      case BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_HUMIDITY:
        latest.humidity      = o.signal; break;
      case BSEC_OUTPUT_RAW_PRESSURE:
        latest.pressure      = o.signal; break;
      case BSEC_OUTPUT_RAW_GAS:
        latest.gasResistance = o.signal; break;
      case BSEC_OUTPUT_IAQ:
        latest.iaq           = o.signal;
        latest.iaqAccuracy   = o.accuracy; break;
      case BSEC_OUTPUT_STATIC_IAQ:
        latest.staticIaq     = o.signal; break;
      case BSEC_OUTPUT_CO2_EQUIVALENT:
        latest.co2Equivalent = o.signal; break;
      case BSEC_OUTPUT_BREATH_VOC_EQUIVALENT:
        latest.breathVoc     = o.signal; break;
      case BSEC_OUTPUT_STABILIZATION_STATUS:
        latest.heaterStable  = (o.signal == 1.0f); break;
      default: break;
    }
  }
  newBsecData = true;
  bsecCycleCount++;
}

// ── Wi-Fi ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  for (int attempt = 1; attempt <= 3; attempt++) {
    Serial.printf("Connecting to \"%s\" (attempt %d)", WIFI_SSID, attempt);
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(WIFI_PS_MAX_MODEM);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED) {
      if (millis() - t > WIFI_TIMEOUT_MS) break;
      delay(500);
      Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\nWiFi OK  IP=%s\n", WiFi.localIP().toString().c_str());
      delay(2000);
      return;
    }
    Serial.println("\nTimeout, retrying...");
  }
  Serial.println("ERROR: WiFi failed");
  setError(true);
}

// ── NTP ───────────────────────────────────────────────────────────────────────
void syncNTP() {
  for (int attempt = 1; attempt <= 3; attempt++) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.printf("NTP sync (attempt %d)", attempt);
    unsigned long t = millis();
    while (time(nullptr) < 1000000000UL) {
      if (millis() - t > 15000UL) break;
      delay(500);
      Serial.print(".");
    }
    if (time(nullptr) >= 1000000000UL) { Serial.println(" OK"); return; }
    Serial.println(" TIMEOUT");
  }
  Serial.println("ERROR: NTP failed — session ID will be wrong");
}

// ── Session ID ────────────────────────────────────────────────────────────────
void buildSessionId() {
  time_t now = time(nullptr);
  strftime(sessionId, sizeof(sessionId), "%Y%m%d-%H%M%S", gmtime(&now));
  snprintf(sessionPath, sizeof(sessionPath), "/voc_dataset/sessions/%s", sessionId);
  Serial.printf("Session: %s\n", sessionId);
}

// ── Firebase ──────────────────────────────────────────────────────────────────
void initFirebase() {
  fbConfig.database_url               = FIREBASE_DATABASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_DATABASE_SECRET;
  fbConfig.token_status_callback      = tokenStatusCallback;
  fbConfig.timeout.socketConnection   = 10 * 1000;
  fbConfig.timeout.serverResponse     = 10 * 1000;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  fbReady = true;
  Serial.println("Firebase initialised");
}

void pushSessionMeta() {
  if (!fbReady || !Firebase.ready()) return;
  time_t now = time(nullptr);
  char iso[32];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  char metaPath[80];
  snprintf(metaPath, sizeof(metaPath), "%s/meta", sessionPath);

  bsec_version_t ver = iaqSensor.version;
  FirebaseJson meta;
  meta.set("location",   SESSION_LOCATION);
  meta.set("device",     "ESP32S3-AuraSync-BSEC2");
  meta.set("start_iso",  iso);
  meta.set("start_unix", (double)now * 1000.0);
  meta.set("interval_s", (int)(PUSH_INTERVAL_MS / 1000));
  meta.set("bsec_version", String(ver.major) + "." + String(ver.minor) + "." +
                           String(ver.major_bugfix) + "." + String(ver.minor_bugfix));
  meta.set("notes", "");

  if (Firebase.RTDB.setJSON(&fbdo, metaPath, &meta)) {
    Serial.printf("Meta pushed → %s\n", metaPath);
  } else {
    Serial.printf("Meta push FAILED: %s\n", fbdo.errorReason().c_str());
    setError(true);
  }
}

void pushReading(unsigned long elapsedS) {
  if (!fbReady || !Firebase.ready()) return;
  time_t now = time(nullptr);
  char iso[32];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  char readingsPath[90];
  snprintf(readingsPath, sizeof(readingsPath), "%s/readings", sessionPath);

  FirebaseJson reading;
  reading.set("unix_ms",        (double)now * 1000.0);
  reading.set("iso",            iso);
  reading.set("elapsed_s",      (int)elapsedS);
  reading.set("temp_c",         latest.temperature);
  reading.set("humidity_pct",   latest.humidity);
  reading.set("pressure_hpa",   latest.pressure / 100.0f);
  reading.set("gas_ohm",        (int)latest.gasResistance);
  reading.set("heater_stable",  latest.heaterStable);
  reading.set("iaq",            latest.iaq);
  reading.set("iaq_accuracy",   (int)latest.iaqAccuracy);

  char pushPath[110];
  snprintf(pushPath, sizeof(pushPath), "%s/%ld", readingsPath, (long)now);
  bool ok = Firebase.RTDB.setJSON(&fbdo, pushPath, &reading);

  if (ok) {
    Serial.printf(
      "[%lus] T=%.1f°C H=%.1f%% Gas=%dΩ | IAQ=%.0f(acc=%d) → %ld\n",
      elapsedS,
      latest.temperature, latest.humidity, (int)latest.gasResistance,
      latest.iaq, (int)latest.iaqAccuracy, (long)now
    );
    setError(false);
    fbFailCount = 0;
  } else {
    Serial.printf("Push FAILED: %s\n", fbdo.errorReason().c_str());
    setError(true);
    Firebase.reset(&fbConfig);
    Firebase.begin(&fbConfig, &fbAuth);
    if (++fbFailCount >= FB_FAIL_LIMIT) {
      Serial.println("Too many failures — restarting...");
      delay(1000);
      ESP.restart();
    }
  }
}

// ── BSEC state persistence ────────────────────────────────────────────────────
void loadBsecState() {
  prefs.begin("bsec", true);
  size_t len = prefs.getBytesLength("state");
  if (len == BSEC_MAX_STATE_BLOB_SIZE) {
    uint8_t buf[BSEC_MAX_STATE_BLOB_SIZE];
    prefs.getBytes("state", buf, BSEC_MAX_STATE_BLOB_SIZE);
    iaqSensor.setState(buf);
    Serial.println("BSEC calibration state loaded from NVS");
  } else {
    Serial.println("No saved BSEC state — fresh calibration starting");
  }
  prefs.end();
}

void saveBsecState() {
  uint8_t buf[BSEC_MAX_STATE_BLOB_SIZE];
  iaqSensor.getState(buf);
  prefs.begin("bsec", false);
  prefs.putBytes("state", buf, BSEC_MAX_STATE_BLOB_SIZE);
  prefs.end();
  Serial.println("BSEC calibration state saved to NVS");
}

// ── BSEC2 init ────────────────────────────────────────────────────────────────
bool initBSEC() {
  // I2C scan — tells us if sensor is wired correctly
  Serial.println("Scanning I2C...");
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  Found: 0x%02X\n", addr);
      found++;
    }
  }
  if (found == 0) Serial.println("  No I2C devices found!");

  bool ok = iaqSensor.begin(BME68X_I2C_ADDR_HIGH, Wire);
  dbgBeginRet = (int)ok;
  dbgStatus   = (int)iaqSensor.status;
  if (!ok) {
    ok = iaqSensor.begin(BME68X_I2C_ADDR_LOW, Wire);
    dbgBeginRet = (int)ok;
    dbgStatus   = (int)iaqSensor.status;
  }
  if (!ok || iaqSensor.status != BSEC_OK) {
    return false;
  }

  // Standard BSEC2 (free) supports: IAQ, heat-compensated T/H, raw P/gas, stab/run-in status
  // STATIC_IAQ, CO2_EQUIVALENT, BREATH_VOC_EQUIVALENT require BSEC2 Extended
  bsecSensor sensorList[] = {
    BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_TEMPERATURE,
    BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_HUMIDITY,
    BSEC_OUTPUT_RAW_PRESSURE,
    BSEC_OUTPUT_RAW_GAS,
    BSEC_OUTPUT_IAQ,
    BSEC_OUTPUT_STABILIZATION_STATUS,
    BSEC_OUTPUT_RUN_IN_STATUS,
  };
  iaqSensor.updateSubscription(sensorList, sizeof(sensorList) / sizeof(sensorList[0]),
                               BSEC_SAMPLE_RATE_LP);
  dbgBeginRet = 99;
  dbgStatus   = (int)iaqSensor.status;
  if (iaqSensor.status < BSEC_OK) {  // only hard errors (negative), warnings OK
    return false;
  }

  iaqSensor.attachCallback(onBsecData);
  loadBsecState();

  bsec_version_t ver = iaqSensor.version;
  Serial.printf("BSEC2 v%d.%d.%d.%d OK\n",
    ver.major, ver.minor, ver.major_bugfix, ver.minor_bugfix);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);  // non-blocking: drop bytes if no host, never stall
  // Native USB CDC: wait up to 5s for serial monitor before continuing headless
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 5000) delay(10);

  Serial.println("\n=== VOCLogger-BSEC2 boot ===");

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  Wire.begin(PIN_SDA, PIN_SCL);

  if (!initBSEC()) {
    setError(true);
    while (true) {
      blinkLED();
      if (millis() % 5000 < 15) {
        Serial.printf("HALTED: begin ret=%d status=%d\n", dbgBeginRet, dbgStatus);
        Serial.println("I2C scan:");
        bool any = false;
        for (uint8_t addr = 1; addr < 127; addr++) {
          Wire.beginTransmission(addr);
          if (Wire.endTransmission() == 0) {
            Serial.printf("  Found 0x%02X\n", addr);
            any = true;
          }
        }
        if (!any) Serial.println("  No I2C devices found!");
      }
      delay(10);
    }
  }

  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) {
    setError(true);
    while (true) {
      blinkLED();
      if (millis() % 3000 < 15) Serial.println("HALTED: WiFi failed — check credentials");
      delay(10);
    }
  }

  syncNTP();
  buildSessionId();
  initFirebase();
  pushSessionMeta();

  bootMs    = millis();
  firstPush = true;
  Serial.println("=== Logging started ===");
  Serial.println("    iaq_accuracy: 0=unreliable  1=low  2=medium  3=high (calibrated)");
}

void loop() {
  blinkLED();

  if (!iaqSensor.run()) {
    if (iaqSensor.status < BSEC_OK) {
      Serial.printf("BSEC2 error: status=%d\n", (int)iaqSensor.status);
      setError(true);
    }
    return;
  }

  if (!newBsecData) return;
  newBsecData = false;

  if (bsecCycleCount % STATE_SAVE_PERIOD == 0 && latest.iaqAccuracy >= 1) {
    saveBsecState();
  }

  if (firstPush || millis() - lastPushMs >= PUSH_INTERVAL_MS) {
    lastPushMs = millis();
    firstPush  = false;
    pushReading((millis() - bootMs) / 1000UL);
  }
}
