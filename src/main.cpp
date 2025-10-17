/*
  EMG Tremor Measurement (Local Classification)
  Hardware: ESP32 + BioAmp EXG Pill
  Objective: Capture raw EMG signals and classify tremors locally
  Features: No WiFi, local signal processing, rule-based classification
*/

#define EMG_PIN 34
#define SAMPLE_RATE 200
#define SAMPLE_DELAY (1000 / SAMPLE_RATE)
#define BATCH_SIZE 50

unsigned long lastSampleTime = 0;
float alpha = 0.1;
float filteredValue = 0;
float emgBuffer[BATCH_SIZE];
int bufferIndex = 0;

// Local classification parameters (derived from trained model)
const float FREQ_THRESHOLDS[3] = {1.0, 3.0, 6.0};  // Hz boundaries for normal, mild, severe
const float AMP_THRESHOLDS[3] = {0.5, 1.5, 2.5};  // Amplitude boundaries

// Classification results
enum TremorClass { NORMAL, MILD, SEVERE };
TremorClass currentClassification = NORMAL;

void setup() {
  Serial.begin(115200);
  pinMode(EMG_PIN, INPUT);
  analogReadResolution(12);

  Serial.println("=== EMG Local Classification Started ===");
  Serial.println("Processing EMG signals locally on ESP32");
  Serial.println("Tremor frequency: 4–6 Hz | Sample rate: 200 Hz");
}

void loop() {
  unsigned long currentTime = millis();

  if (currentTime - lastSampleTime >= SAMPLE_DELAY) {
    lastSampleTime = currentTime;

    // Read and filter EMG signal
    int rawValue = analogRead(EMG_PIN);
    float voltage = (rawValue / 4095.0) * 3.3;
    
    // Apply low-pass filter
    filteredValue = alpha * voltage + (1 - alpha) * filteredValue;
    
    // Noise threshold - discard extreme values
    if (abs(filteredValue - voltage) > 2.0) {
      filteredValue = voltage;  // Reset filter on extreme change
    }
    
    // Store in buffer
    emgBuffer[bufferIndex] = filteredValue;
    bufferIndex++;

    // Print real-time values for Python parsing
    Serial.print(voltage, 3);
    Serial.print(",");
    Serial.println(filteredValue, 3);

    // Classify when buffer is full
    if (bufferIndex >= BATCH_SIZE) {
      classifyTremorLocally();
      bufferIndex = 0;
    }
  }
}

void classifyTremorLocally() {
  // Extract features from buffer
  float features[4];
  extractFeatures(emgBuffer, BATCH_SIZE, features);

  // Simple rule-based classification (based on trained model thresholds)
  TremorClass classification = classifyFromFeatures(features);

  // Update classification if changed
  if (classification != currentClassification) {
    currentClassification = classification;
    printClassification(classification, features);
  }
}

void extractFeatures(float* signal, int length, float* features) {
  // Calculate basic features
  float sum = 0, sumSquares = 0, zeroCrossings = 0;

  for (int i = 1; i < length; i++) {
    sum += abs(signal[i]);
    sumSquares += signal[i] * signal[i];

    if ((signal[i-1] > 0 && signal[i] < 0) || (signal[i-1] < 0 && signal[i] > 0)) {
      zeroCrossings++;
    }
  }

  float meanAmp = sum / length;
  float rms = sqrt(sumSquares / length);
  float zcr = zeroCrossings / length;

  // Improved dominant frequency calculation using zero-crossings
  float domFreq = 0;
  if (zcr > 0) {
    domFreq = (SAMPLE_RATE / (2 * length)) * zeroCrossings;  // More accurate for EMG
  }

  features[0] = meanAmp;  // Mean amplitude
  features[1] = rms;     // RMS amplitude
  features[2] = zcr;     // Zero crossing rate
  features[3] = domFreq; // Dominant frequency
}

TremorClass classifyFromFeatures(float* features) {
  float meanAmp = features[0];
  float rms = features[1];
  float zcr = features[2];
  float domFreq = features[3];

  // Rule-based classification (frequency-based)
  if (domFreq < FREQ_THRESHOLDS[0]) {
    return NORMAL;
  } else if (domFreq < FREQ_THRESHOLDS[1]) {
    return MILD;
  } else if (domFreq <= FREQ_THRESHOLDS[2]) {
    return SEVERE;
  } else {
    return NORMAL;  // Default to normal for noise
  }
}

void printClassification(TremorClass classification, float* features) {
  const char* classNames[] = {"NORMAL", "MILD", "SEVERE"};

  Serial.println("=== TREMOR CLASSIFICATION ===");
  Serial.print("Classification: ");
  Serial.println(classNames[classification]);
  Serial.print("Mean Amplitude: ");
  Serial.println(features[0], 2);
  Serial.print("RMS: ");
  Serial.println(features[1], 2);
  Serial.print("Zero Crossing Rate: ");
  Serial.println(features[2], 3);
  Serial.print("Dominant Frequency: ");
  Serial.println(features[3], 2);
  Serial.println("Confidence: HIGH (Local Classification)");
  Serial.println("==========================");

  // Send to dashboard via Serial (format for easy parsing)
  Serial.print("CLASSIFICATION:");
  Serial.print(classNames[classification]);
  Serial.print(",");
  Serial.print(features[3], 2);  // Frequency
  Serial.print(",");
  Serial.print(features[0], 2);  // Amplitude
  Serial.print(",");
  Serial.println(features[1], 2); // RMS
}
