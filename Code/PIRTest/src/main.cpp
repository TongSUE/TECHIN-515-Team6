#include <Arduino.h>

#define PIR_PIN        4
#define TRAN_PIN       5
#define DETECT_HOLD    3000
#define SPRAY_DURATION 5000
#define COOLDOWN       3000

unsigned long detectedSince = 0;
unsigned long lastHighTime  = 0;
#define GRACE_PERIOD 1500  // PIR 短暂低脉冲容忍时间(ms)

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(TRAN_PIN, OUTPUT);
  digitalWrite(TRAN_PIN, LOW);
  Serial.println("ready");
}

void loop() {
  int val = digitalRead(PIR_PIN);
  Serial.println(val);

  if (val == HIGH) {
    lastHighTime = millis();
    if (detectedSince == 0) detectedSince = millis();
  }

  bool effectivelyDetected = (val == HIGH) ||
                             (millis() - lastHighTime < GRACE_PERIOD);

  if (effectivelyDetected) {
    if (millis() - detectedSince >= DETECT_HOLD) {
      Serial.println("SPRAY");
      digitalWrite(TRAN_PIN, HIGH);
      delay(SPRAY_DURATION);
      digitalWrite(TRAN_PIN, LOW);
      Serial.println("COOLDOWN");
      delay(COOLDOWN);
      detectedSince = 0;
      lastHighTime  = 0;
    }
  } else {
    detectedSince = 0;
  }

  delay(200);
}
