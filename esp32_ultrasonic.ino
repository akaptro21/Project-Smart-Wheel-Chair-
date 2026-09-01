/*
  ========================================================
  Smart Ride - ESP32 / Arduino Ultrasonic Sensor (HC-SR04)
  =======================================================
  Pin Connections:
    - VCC   -> 5V (or 3.3V)
    - GND   -> GND
    - TRIG  -> GPIO 5  (or Arduino Pin 9)
    - ECHO  -> GPIO 18 (or Arduino Pin 10)
  =======================================================
*/

#define TRIG_PIN 5
#define ECHO_PIN 18

#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://10.228.132.201:5000/update";

Unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  Serial.println("===================================================");
  Serial.println("SMART RIDE // ESP32 ULTRASONIC SENSOR ACTIVE");
  Serial.println("===================================================");

  // WiFi.begin(ssid, password);
}

float measureDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1.0;
  }

  float distance = (duration * 0.0343) / 2.0;
  return distance;
}

void loop() {
  float distance = measureDistanceCM();

  if (distance > 0 && distance <= 400) {
    // 1. Output to Serial Monitor
    Serial.print("Distance: ");
    Serial.print(distance, 1);
    Serial.println(" cm");

    // 2. Optional Wi-Fi Distance Send to Flask backend
    if (WiFi.status() == WL_CONNECTED && (millis() - lastSendTime > 250)) {
      HTTPClient http;
      String url = String(serverUrl) + "?distance=" + String(distance, 1);
      http.begin(url);
      http.GET();
      http.end();
      lastSendTime = millis();
    }
  } else {
    Serial.println("Distance: Out of Range");
  }

  delay(100);
}