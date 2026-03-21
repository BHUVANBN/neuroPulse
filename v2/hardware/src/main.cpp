#include <Arduino.h>
#include <ArduinoJson.h>

// 🚀 NeuroPulse v2 - Clinical Standard Firmware
// Sampling: 200 Hz | Output: JSON over Serial (115200)

#define EMG_PIN 34
#define BATCH_SIZE 50 

void setup() {
  Serial.begin(115200);
  while(!Serial); 
  delay(1000);
  Serial.println("INIT_CLINICAL_MODE");
}

void loop() {
  StaticJsonDocument<2048> doc;
  doc["deviceId"] = "ESP32-MED-V2";
  JsonArray samples = doc.createNestedArray("samples");
  
  for(int i=0; i<BATCH_SIZE; i++) {
    samples.add(analogRead(EMG_PIN));
    delay(5); // 200 Hz sampling (approx)
  }
  
  serializeJson(doc, Serial);
  Serial.println(); 
}
