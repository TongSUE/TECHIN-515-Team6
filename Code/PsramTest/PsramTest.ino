// PsramTest — verify PSRAM availability on XIAO ESP32-S3
// No extra libraries required; default partition scheme is fine.

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("\n===== PSRAM Diagnostics =====");

  // 1. Initialise
  bool initOk = psramInit();
  Serial.printf("psramInit()    : %s\n", initOk ? "OK" : "FAIL");

  // 2. Detect
  bool found = psramFound();
  Serial.printf("psramFound()   : %s\n", found ? "YES" : "NO");

  // 3. Capacity
  Serial.printf("Total PSRAM    : %u bytes (%.1f MB)\n",
                ESP.getPsramSize(), ESP.getPsramSize() / 1048576.0f);
  Serial.printf("Free PSRAM     : %u bytes\n", ESP.getFreePsram());

  // 4. Allocation test (512 KB)
  const size_t TEST_SIZE = 512 * 1024;
  void* ptr = ps_malloc(TEST_SIZE);
  if (ptr) {
    Serial.printf("ps_malloc 512KB: OK (addr=0x%08X)\n", (uint32_t)ptr);
    free(ptr);
  } else {
    Serial.println("ps_malloc 512KB: FAIL — cannot allocate from PSRAM");
  }

  // 5. Internal heap
  Serial.printf("Free heap      : %u bytes\n", ESP.getFreeHeap());
  Serial.printf("Min free heap  : %u bytes\n", ESP.getMinFreeHeap());

  Serial.println("\n===== Result =====");
  if (found && ESP.getPsramSize() > 0) {
    Serial.println("PASS — PSRAM available, ESP-SR can run");
  } else {
    Serial.println("FAIL — PSRAM not available");
    Serial.println("  Possible causes:");
    Serial.println("  1. Tools -> PSRAM not set to 'OPI PSRAM'");
    Serial.println("  2. Board has no PSRAM (chip must be ESP32-S3R8)");
    Serial.println("  3. Seeed board package too old (upgrade to v3.x)");
  }
}

void loop() {}
