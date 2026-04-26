#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME680.h>

Adafruit_BME680 bme;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("Starting...");

  Wire.begin();  // 默认引脚

  // 扫描确认
  Wire.beginTransmission(0x77);
  byte error = Wire.endTransmission();
  Serial.print("I2C check at 0x77: ");
  Serial.println(error == 0 ? "OK" : "FAILED");

  if (!bme.begin(0x77, &Wire)) {
    Serial.println("BME680 init failed!");
    while (1);
  }

  Serial.println("BME680 ready!");
  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150);
}

void loop() {
  if (!bme.performReading()) {
    Serial.println("Reading failed");
    delay(2000);
    return;
  }
  Serial.print("Temp: "); Serial.print(bme.temperature); Serial.println(" C");
  Serial.print("Humidity: "); Serial.print(bme.humidity); Serial.println(" %");
  Serial.print("VOC: "); Serial.print(bme.gas_resistance / 1000.0); Serial.println(" KOhms");
  Serial.println("---");
  delay(3000);
}