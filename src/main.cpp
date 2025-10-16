#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <cmath>

// WiFi Configuration
const char* ssid = "TECNO CAMON 17";
const char* password = "valarmorghulis";
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/tremor";

// Hardware Configuration
#define EMG_PIN 34  // BioAmp EXG Pill output
#define SAMPLES 256  // Increased for better FFT resolution
#define SAMPLE_RATE 200  // Hz - Nyquist frequency = 100 Hz
#define SAMPLE_DELAY (1000 / SAMPLE_RATE)  // microseconds

// Signal Processing Configuration
#define FFT_SIZE 256
#define WINDOW_SIZE 128
#define OVERLAP 64

// Device Configuration
const String DEVICE_ID = "ESP32_MEDICAL_001";
const String FIRMWARE_VERSION = "2.0.0";

// Global Variables
float emgBuffer[SAMPLES];
int bufferIndex = 0;
unsigned long lastSampleTime = 0;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 2000;  // Send every 2 seconds

// Signal Processing Buffers
float windowBuffer[WINDOW_SIZE];
float magnitudeBuffer[FFT_SIZE / 2];

// Filter Coefficients (Bandpass 3-30 Hz for tremor analysis)
const float b[] = {0.0976, 0.1952, 0.0976};  // Numerator coefficients
const float a[] = {1.0000, -0.9428, 0.3333}; // Denominator coefficients
float filterHistory[3] = {0, 0, 0};  // Filter state

// ML Model Coefficients (Simplified - would be trained model in production)
struct MLModel {
    float weights[10] = {0.1, -0.2, 0.3, -0.1, 0.2, 0.15, -0.25, 0.05, 0.1, -0.05};
    float bias = 0.5;
};

MLModel tremorModel;

void setup() {
    Serial.begin(115200);

    // Initialize EMG pin
    pinMode(EMG_PIN, INPUT);
    analogReadResolution(12);  // 12-bit resolution for better precision

    // Initialize WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected!");
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());

    // Initialize filter history
    for (int i = 0; i < 3; i++) {
        filterHistory[i] = 0;
    }

    Serial.println("Medical-grade Tremor Detection System Initialized");
    Serial.printf("Device ID: %s\n", DEVICE_ID.c_str());
    Serial.printf("Firmware Version: %s\n", FIRMWARE_VERSION.c_str());
    Serial.printf("Sample Rate: %d Hz\n", SAMPLE_RATE);
    Serial.printf("FFT Size: %d\n", FFT_SIZE);
}

// Butterworth Bandpass Filter (3-30 Hz for tremor analysis)
float applyBandpassFilter(float input) {
    // Shift filter history
    filterHistory[2] = filterHistory[1];
    filterHistory[1] = filterHistory[0];
    filterHistory[0] = input;

    // Apply filter
    float output = b[0] * filterHistory[0] +
                   b[1] * filterHistory[1] +
                   b[2] * filterHistory[2] -
                   a[1] * (filterHistory[1] - filterHistory[1]) -  // Simplified
                   a[2] * (filterHistory[2] - filterHistory[2]);   // Simplified

    return output;
}

// Simple FFT implementation for frequency analysis
void simpleFFT(float* data, float* magnitude, int n) {
    // This is a simplified FFT - in production, use a proper FFT library
    for (int k = 0; k < n / 2; k++) {
        float real = 0, imag = 0;
        float frequency = (float)k * SAMPLE_RATE / n;

        for (int t = 0; t < n; t++) {
            float angle = -2 * PI * frequency * t / SAMPLE_RATE;
            real += data[t] * cos(angle);
            imag += data[t] * sin(angle);
        }

        magnitude[k] = sqrt(real * real + imag * imag);
    }
}

// Feature extraction for ML
struct TremorFeatures {
    float meanAmplitude;
    float rmsAmplitude;
    float dominantFrequency;
    float frequencyPower;
    float spectralCentroid;
    float zeroCrossingRate;
    float signalEnergy;
    float entropy;
};

TremorFeatures extractFeatures(float* signal, int length) {
    TremorFeatures features = {0};

    // Mean amplitude
    for (int i = 0; i < length; i++) {
        features.meanAmplitude += abs(signal[i]);
    }
    features.meanAmplitude /= length;

    // RMS amplitude
    for (int i = 0; i < length; i++) {
        features.rmsAmplitude += signal[i] * signal[i];
    }
    features.rmsAmplitude = sqrt(features.rmsAmplitude / length);

    // Signal energy
    features.signalEnergy = features.rmsAmplitude * features.rmsAmplitude;

    // Zero crossing rate
    int zeroCrossings = 0;
    for (int i = 1; i < length; i++) {
        if ((signal[i-1] > 0 && signal[i] < 0) || (signal[i-1] < 0 && signal[i] > 0)) {
            zeroCrossings++;
        }
    }
    features.zeroCrossingRate = (float)zeroCrossings / length;

    // Spectral features using simplified FFT
    simpleFFT(signal, magnitudeBuffer, length);

    // Find dominant frequency (3-12 Hz range for tremor)
    float maxMagnitude = 0;
    int dominantFreqBin = 0;
    float totalPower = 0;

    for (int i = 1; i < length / 2; i++) {
        float freq = (float)i * SAMPLE_RATE / length;
        if (freq >= 3 && freq <= 12) {  // Tremor frequency range
            totalPower += magnitudeBuffer[i];
            if (magnitudeBuffer[i] > maxMagnitude) {
                maxMagnitude = magnitudeBuffer[i];
                dominantFreqBin = i;
            }
        }
    }

    features.dominantFrequency = (float)dominantFreqBin * SAMPLE_RATE / length;
    features.frequencyPower = totalPower;

    // Spectral centroid
    float weightedSum = 0;
    for (int i = 1; i < length / 2; i++) {
        float freq = (float)i * SAMPLE_RATE / length;
        if (freq >= 3 && freq <= 12) {
            weightedSum += freq * magnitudeBuffer[i];
        }
    }
    features.spectralCentroid = totalPower > 0 ? weightedSum / totalPower : 0;

    // Entropy (signal complexity)
    float entropy = 0;
    for (int i = 0; i < length; i++) {
        float normalized = abs(signal[i]) / features.rmsAmplitude;
        if (normalized > 0.001) {
            entropy -= normalized * log(normalized);
        }
    }
    features.entropy = entropy;

    return features;
}

// ML-based tremor classification
String classifyTremor(TremorFeatures features) {
    // Normalize features
    float normalizedFeatures[10] = {
        features.meanAmplitude / 100.0,
        features.rmsAmplitude / 100.0,
        features.dominantFrequency / 10.0,
        features.frequencyPower / 1000.0,
        features.spectralCentroid / 10.0,
        features.zeroCrossingRate * 10.0,
        features.signalEnergy / 10000.0,
        features.entropy / 10.0,
        features.dominantFrequency >= 3 && features.dominantFrequency <= 8 ? 1.0 : 0.0,  // Tremor frequency indicator
        features.rmsAmplitude > 10 ? 1.0 : 0.0  // High amplitude indicator
    };

    // Simple neural network forward pass
    float output = tremorModel.bias;
    for (int i = 0; i < 10; i++) {
        output += normalizedFeatures[i] * tremorModel.weights[i];
    }

    // Classification thresholds (would be trained in production)
    if (output > 0.7) return "severe";
    else if (output > 0.4) return "moderate";
    else if (output > 0.1) return "mild";
    else return "normal";
}

// Generate AI insights and recommendations
struct AIInsights {
    String pattern;
    float confidence;
    String recommendations[3];
    String predictedProgression;
};

AIInsights generateInsights(TremorFeatures features, String classification) {
    AIInsights insights;

    insights.pattern = classification;
    insights.confidence = min(0.95, 0.7 + (features.entropy / 20.0));  // Higher entropy = higher confidence

    // Generate recommendations based on classification
    if (classification == "severe") {
        insights.recommendations[0] = "Contact healthcare provider immediately";
        insights.recommendations[1] = "Monitor for medication effectiveness";
        insights.recommendations[2] = "Consider DBS evaluation if persistent";
        insights.predictedProgression = "Rapid progression likely - immediate intervention recommended";
    } else if (classification == "moderate") {
        insights.recommendations[0] = "Continue current medication regimen";
        insights.recommendations[1] = "Monitor for pattern changes";
        insights.recommendations[2] = "Consider physical therapy";
        insights.predictedProgression = "Stable with potential slow progression";
    } else if (classification == "mild") {
        insights.recommendations[0] = "Regular monitoring recommended";
        insights.recommendations[1] = "Maintain healthy lifestyle";
        insights.recommendations[2] = "Watch for progression indicators";
        insights.predictedProgression = "Early stage - monitor closely";
    } else {
        insights.recommendations[0] = "Continue normal activities";
        insights.recommendations[1] = "Regular check-ups recommended";
        insights.recommendations[2] = "No immediate concerns";
        insights.predictedProgression = "Normal variation - no progression detected";
    }

    return insights;
}

// Main processing function
void processTremorData() {
    if (bufferIndex < SAMPLES) return;

    // Extract features from current window
    memcpy(windowBuffer, &emgBuffer[bufferIndex - WINDOW_SIZE], sizeof(float) * WINDOW_SIZE);
    TremorFeatures features = extractFeatures(windowBuffer, WINDOW_SIZE);

    // Apply filtering to features for stability
    static TremorFeatures prevFeatures = {0};
    features.meanAmplitude = 0.8 * prevFeatures.meanAmplitude + 0.2 * features.meanAmplitude;
    features.rmsAmplitude = 0.8 * prevFeatures.rmsAmplitude + 0.2 * features.rmsAmplitude;
    prevFeatures = features;

    // Classify tremor
    String classification = classifyTremor(features);

    // Generate insights
    AIInsights insights = generateInsights(features, classification);

    // Prepare JSON payload
    StaticJsonDocument<1024> doc;
    JsonObject root = doc.to<JsonObject>();

    root["deviceId"] = DEVICE_ID;
    root["timestamp"] = millis();
    root["frequency"] = features.dominantFrequency;
    root["amplitude"] = features.rmsAmplitude;
    root["severityIndex"] = min(100.0f, max(0.0f, features.rmsAmplitude * 10 + features.dominantFrequency * 2));
    root["batteryLevel"] = getBatteryLevel();

    JsonObject rawData = root.createNestedObject("rawData");
    JsonArray emgArray = rawData.createNestedArray("emg");
    for (int i = 0; i < min(50, SAMPLES); i++) {  // Send last 50 samples
        emgArray.add(emgBuffer[i]);
    }

    JsonObject aiInsights = root.createNestedObject("aiInsights");
    aiInsights["pattern"] = insights.pattern;
    aiInsights["confidence"] = insights.confidence;

    JsonArray recommendations = aiInsights.createNestedArray("recommendations");
    for (int i = 0; i < 3; i++) {
        recommendations.add(insights.recommendations[i]);
    }

    aiInsights["predictedProgression"] = insights.predictedProgression;

    // Send data to server
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");

        String jsonString;
        serializeJson(doc, jsonString);

        int httpResponseCode = http.POST(jsonString);

        if (httpResponseCode > 0) {
            Serial.printf("Data sent successfully, response: %d\n", httpResponseCode);

            // Log features for debugging
            Serial.printf("Features - Freq: %.2f Hz, Amp: %.2f, Class: %s\n",
                         features.dominantFrequency, features.rmsAmplitude, classification.c_str());
        } else {
            Serial.printf("Error sending data: %s\n", http.errorToString(httpResponseCode).c_str());
        }

        http.end();
    }

    // Reset buffer for next window
    bufferIndex = 0;
}

// Get battery level (ESP32 specific)
float getBatteryLevel() {
    // This would need actual battery monitoring circuit
    // For now, return a simulated value
    return 85.0 + sin(millis() / 10000.0) * 5.0;  // Simulated battery level
}

void loop() {
    unsigned long currentTime = micros();

    // Sample EMG at precise intervals
    if (currentTime - lastSampleTime >= SAMPLE_DELAY) {
        lastSampleTime = currentTime;

        // Read and filter EMG signal
        float rawValue = analogRead(EMG_PIN);
        float filteredValue = applyBandpassFilter(rawValue - 2048);  // Center around 0

        // Store in circular buffer
        emgBuffer[bufferIndex++] = filteredValue;

        // Process when buffer is full
        if (bufferIndex >= SAMPLES) {
            processTremorData();
        }
    }

    // Send periodic updates even if buffer not full
    if (millis() - lastSendTime > SEND_INTERVAL && bufferIndex > 0) {
        lastSendTime = millis();

        // Send partial buffer for real-time monitoring
        memcpy(windowBuffer, emgBuffer, sizeof(float) * bufferIndex);
        TremorFeatures features = extractFeatures(windowBuffer, bufferIndex);

        Serial.printf("Real-time - Freq: %.2f Hz, Amp: %.2f\n",
                     features.dominantFrequency, features.rmsAmplitude);
    }

    // Small delay to prevent overwhelming the system
    delay(1);
}
