/*
 * VOCLogger — BME680 bathroom data collection
 *
 * Logs all four BME680 channels to Firebase every SAMPLE_INTERVAL_MS.
 * Sessions are auto-named from NTP boot time; heater_stable is false
 * for the first 120 s so the ML pipeline can filter cold-start noise.
 *
 * Board  : Seeed XIAO ESP32-S3
 * PSRAM  : OPI PSRAM
 * Part.  : Default (no ESP-SR — standard partition is fine)
 *
 * Copy secrets.h.example → secrets.h and fill in credentials before flashing.
 */

#include <WiFi.h>
#include <Wire.h>
#include <time.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include <Adafruit_BME680.h>
#include "secrets.h"

// ── Pins ──────────────────────────────────────────────────────────────────────
#define PIN_SDA  5
#define PIN_SCL  6
#define PIN_LED  21

// ── Timing ────────────────────────────────────────────────────────────────────
#define SAMPLE_INTERVAL_MS  10000UL   // 10 s between readings
#define HEATER_WARMUP_S     120       // first 120 s → heater_stable = false
#define WIFI_TIMEOUT_MS     20000UL

// ── Firebase ──────────────────────────────────────────────────────────────────
FirebaseData   fbdo;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;
bool           fbReady = false;

// ── BME680 ────────────────────────────────────────────────────────────────────
Adafruit_BME680 bme;
bool            bmeReady = false;

// ── Session state ─────────────────────────────────────────────────────────────
char   sessionId[32];   // e.g. "20260429-143022"
char   sessionPath[64]; // "/voc_dataset/sessions/<id>"
unsigned long bootMs = 0;

// ── Sampling state ────────────────────────────────────────────────────────────
unsigned long lastSampleMs = 0;

// ── LED blink state ───────────────────────────────────────────────────────────
unsigned long lastLedMs  = 0;
bool          ledState   = false;
bool          errorState = false;   // true → fast blink (error)

// ─────────────────────────────────────────────────────────────────────────────

void setError(bool err) {
  errorState = err;
}

void blinkLED() {
  unsigned long interval = errorState ? 100UL : 500UL;
  if (millis() - lastLedMs < interval) return;
  lastLedMs = millis();
  ledState  = !ledState;
  digitalWrite(PIN_LED, ledState ? HIGH : LOW);
}

// ── Wi-Fi ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("Connecting to \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(WIFI_PS_MAX_MODEM);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t > WIFI_TIMEOUT_MS) {
      Serial.println("\nERROR: WiFi timeout — check MPSK credentials");
      setError(true);
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi OK  IP=%s\n", WiFi.localIP().toString().c_str());
}

// ── NTP ───────────────────────────────────────────────────────────────────────
void syncNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("NTP sync");
  unsigned long t = millis();
  while (time(nullptr) < 1000000000UL) {
    if (millis() - t > 10000UL) {
      Serial.println(" TIMEOUT");
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println(" OK");
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
  fbConfig.database_url                  = FIREBASE_DATABASE_URL;
  fbConfig.signer.tokens.legacy_token    = FIREBASE_DATABASE_SECRET;
  fbConfig.token_status_callback         = tokenStatusCallback;
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

  FirebaseJson meta;
  meta.set("location",   SESSION_LOCATION);
  meta.set("device",     "ESP32S3-AuraSync");
  meta.set("start_iso",  iso);
  meta.set("start_unix", (int)(now * 1000LL));
  meta.set("interval_s", (int)(SAMPLE_INTERVAL_MS / 1000));
  meta.set("notes",      "");

  if (Firebase.RTDB.setJSON(&fbdo, metaPath, &meta)) {
    Serial.printf("Meta pushed → %s\n", metaPath);
  } else {
    Serial.printf("Meta push FAILED: %s\n", fbdo.errorReason().c_str());
    setError(true);
  }
}

void pushReading(unsigned long elapsedS, bool heaterStable) {
  if (!fbReady || !Firebase.ready()) return;

  time_t now = time(nullptr);
  char iso[32];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));

  char readingsPath[90];
  snprintf(readingsPath, sizeof(readingsPath), "%s/readings", sessionPath);

  FirebaseJson reading;
  reading.set("unix_ms",       (int)(now * 1000LL));
  reading.set("iso",           iso);
  reading.set("elapsed_s",     (int)elapsedS);
  reading.set("temp_c",        (float)bme.temperature);
  reading.set("humidity_pct",  (float)bme.humidity);
  reading.set("pressure_hpa",  (float)(bme.pressure / 100.0));
  reading.set("gas_ohm",       (int)bme.gas_resistance);
  reading.set("heater_stable", heaterStable);

  String pushId = Firebase.RTDB.pushJSON(&fbdo, readingsPath, &reading)
                  ? fbdo.pushName()
                  : "";

  if (pushId.length()) {
    Serial.printf(
      "[%lus] T=%.1f°C H=%.1f%% P=%.1fhPa Gas=%ldΩ stable=%s → %s\n",
      elapsedS,
      bme.temperature, bme.humidity, bme.pressure / 100.0,
      (long)bme.gas_resistance,
      heaterStable ? "yes" : "no (warmup)",
      pushId.c_str()
    );
    setError(false);
  } else {
    Serial.printf("Push FAILED: %s\n", fbdo.errorReason().c_str());
    setError(true);
  }
}

// ── BME680 ────────────────────────────────────────────────────────────────────
bool initBME680() {
  if (!bme.begin(0x77) && !bme.begin(0x76)) {
    Serial.println("ERROR: BME680 not found — check wiring");
    return false;
  }
  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);  // 320 °C, 150 ms — required for gas measurement
  Serial.println("BME680 OK");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== VOCLogger boot ===");

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  Wire.begin(PIN_SDA, PIN_SCL);

  bmeReady = initBME680();
  if (!bmeReady) setError(true);

  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Halting — fix WiFi credentials");
    while (true) { blinkLED(); delay(10); }
  }

  syncNTP();
  buildSessionId();
  initFirebase();
  pushSessionMeta();

  bootMs       = millis();
  lastSampleMs = millis() - SAMPLE_INTERVAL_MS;  // sample immediately on first loop
  Serial.println("=== Logging started ===");
}

void loop() {
  blinkLED();

  if (!bmeReady) return;
  if (millis() - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = millis();

  if (!bme.performReading()) {
    Serial.println("BME680 read failed — skipping");
    return;
  }

  unsigned long elapsedS   = (millis() - bootMs) / 1000UL;
  bool          heaterStable = (elapsedS >= HEATER_WARMUP_S);

  pushReading(elapsedS, heaterStable);
}
