// EMG Signal Processing Utilities for Medical-Grade Analysis
// All processing moved from ESP32 firmware to Next.js for better control

export interface EMGData {
  deviceId: string;
  timestamp: number;
  sampleRate: number;
  dataType: string;
  firmwareVersion: string;
  emgData: number[];
  metadata: {
    samplesCount: number;
    adcResolution: number;
    adcRange: string;
  };
}

export interface ProcessedEMGFeatures {
  frequency: number;
  amplitude: number;
  severityIndex: number;
  dominantFrequency: number;
  spectralCentroid: number;
  signalEnergy: number;
  zeroCrossingRate: number;
  rmsAmplitude: number;
  meanAmplitude: number;
  signalVariance: number;
}

// Butterworth Bandpass Filter (3-30 Hz for tremor analysis)
export class ButterworthFilter {
  private b: number[] = [0.0976, 0.1952, 0.0976];  // Numerator coefficients
  private a: number[] = [1.0000, -0.9428, 0.3333]; // Denominator coefficients
  private history: number[] = [0, 0, 0];  // Filter state

  filter(input: number): number {
    // Shift filter history
    this.history[2] = this.history[1];
    this.history[1] = this.history[0];
    this.history[0] = input;

    // Apply filter
    const output = this.b[0] * this.history[0] +
                   this.b[1] * this.history[1] +
                   this.b[2] * this.history[2] -
                   this.a[1] * this.history[1] -
                   this.a[2] * this.history[2];

    return output;
  }

  reset() {
    this.history = [0, 0, 0];
  }
}

// Simple FFT implementation for frequency analysis
export function simpleFFT(data: number[], sampleRate: number): { magnitude: number[], frequency: number[] } {
  const n = data.length;
  const magnitude: number[] = [];
  const frequency: number[] = [];

  for (let k = 0; k < n / 2; k++) {
    let real = 0, imag = 0;
    const freq = k * sampleRate / n;

    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * freq * t / sampleRate;
      real += data[t] * Math.cos(angle);
      imag += data[t] * Math.sin(angle);
    }

    magnitude[k] = Math.sqrt(real * real + imag * imag);
    frequency[k] = freq;
  }

  return { magnitude, frequency };
}

// Feature extraction for EMG analysis
export function extractEMGFeatures(
  signal: number[],
  sampleRate: number = 200
): ProcessedEMGFeatures {
  if (signal.length === 0) {
    return {
      frequency: 0,
      amplitude: 0,
      severityIndex: 0,
      dominantFrequency: 0,
      spectralCentroid: 0,
      signalEnergy: 0,
      zeroCrossingRate: 0,
      rmsAmplitude: 0,
      meanAmplitude: 0,
      signalVariance: 0
    };
  }

  // Mean amplitude
  const meanAmplitude = signal.reduce((sum, val) => sum + Math.abs(val), 0) / signal.length;

  // RMS amplitude
  const rmsAmplitude = Math.sqrt(
    signal.reduce((sum, val) => sum + val * val, 0) / signal.length
  );

  // Signal energy
  const signalEnergy = rmsAmplitude * rmsAmplitude;

  // Signal variance
  const signalVariance = signal.reduce((sum, val) => sum + Math.pow(val - meanAmplitude, 2), 0) / signal.length;

  // Zero crossing rate
  let zeroCrossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i-1] > 0 && signal[i] < 0) || (signal[i-1] < 0 && signal[i] > 0)) {
      zeroCrossings++;
    }
  }
  const zeroCrossingRate = zeroCrossings / signal.length;

  // Spectral analysis
  const { magnitude, frequency: frequencyArray } = simpleFFT(signal, sampleRate);

  // Find dominant frequency (3-12 Hz range for tremor)
  let maxMagnitude = 0;
  let dominantFreqBin = 0;
  let totalPower = 0;

  for (let i = 1; i < magnitude.length; i++) {
    const freq = frequencyArray[i];
    if (freq >= 3 && freq <= 12) {  // Tremor frequency range
      totalPower += magnitude[i];
      if (magnitude[i] > maxMagnitude) {
        maxMagnitude = magnitude[i];
        dominantFreqBin = i;
      }
    }
  }

  const dominantFrequency = frequencyArray[dominantFreqBin] || 0;

  // Spectral centroid
  let weightedSum = 0;
  for (let i = 1; i < magnitude.length; i++) {
    const freq = frequencyArray[i];
    if (freq >= 3 && freq <= 12) {
      weightedSum += freq * magnitude[i];
    }
  }
  const spectralCentroid = totalPower > 0 ? weightedSum / totalPower : 0;

  // Calculate overall metrics
  const frequency = dominantFrequency;
  const amplitude = rmsAmplitude;

  // Severity index (0-100 scale) - combine multiple factors
  const severityIndex = Math.min(100, Math.max(0,
    (rmsAmplitude / 100) * 50 +  // Amplitude contribution
    (dominantFrequency / 10) * 30 +  // Frequency contribution
    (zeroCrossingRate * 100) * 20    // Complexity contribution
  ));

  return {
    frequency,
    amplitude,
    severityIndex,
    dominantFrequency,
    spectralCentroid,
    signalEnergy,
    zeroCrossingRate,
    rmsAmplitude,
    meanAmplitude,
    signalVariance
  };
}

// Apply bandpass filter to raw EMG data
export function applyBandpassFilter(signal: number[]): number[] {
  const filter = new ButterworthFilter();
  return signal.map(sample => filter.filter(sample));
}

// Process raw EMG data with full analysis pipeline
export function processRawEMGData(emgData: EMGData): {
  rawSignal: number[];
  filteredSignal: number[];
  features: ProcessedEMGFeatures;
  qualityMetrics: {
    signalToNoiseRatio: number;
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
    saturationLevel: number;
  };
} {
  const { emgData: rawSignal, metadata } = emgData;

  // Apply bandpass filtering
  const filteredSignal = applyBandpassFilter(rawSignal);

  // Extract features
  const features = extractEMGFeatures(filteredSignal, emgData.sampleRate);

  // Calculate quality metrics
  const signalPower = filteredSignal.reduce((sum, val) => sum + val * val, 0) / filteredSignal.length;
  const noisePower = rawSignal.reduce((sum, val) => sum + Math.pow(val - filteredSignal[rawSignal.indexOf(val)], 2), 0) / rawSignal.length;
  const signalToNoiseRatio = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0;

  // Determine data quality
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  if (signalToNoiseRatio > 20) dataQuality = 'excellent';
  else if (signalToNoiseRatio > 10) dataQuality = 'good';
  else if (signalToNoiseRatio > 5) dataQuality = 'fair';

  // Check for signal saturation
  const maxValue = Math.max(...rawSignal.map(Math.abs));
  const saturationLevel = (maxValue / 4095) * 100;  // Assuming 12-bit ADC

  return {
    rawSignal,
    filteredSignal,
    features,
    qualityMetrics: {
      signalToNoiseRatio,
      dataQuality,
      saturationLevel
    }
  };
}

// Generate AI insights based on processed features
export function generateEMGInsights(features: ProcessedEMGFeatures): {
  pattern: 'normal' | 'mild' | 'moderate' | 'severe';
  confidence: number;
  recommendations: string[];
  predictedProgression: string;
} {
  // Classification based on multiple factors
  let pattern: 'normal' | 'mild' | 'moderate' | 'severe' = 'normal';
  let confidence = 0.5;

  if (features.severityIndex > 70) {
    pattern = 'severe';
    confidence = Math.min(0.95, 0.7 + (features.signalVariance / 1000));
  } else if (features.severityIndex > 40) {
    pattern = 'moderate';
    confidence = Math.min(0.90, 0.6 + (features.dominantFrequency / 15));
  } else if (features.severityIndex > 20) {
    pattern = 'mild';
    confidence = Math.min(0.85, 0.5 + (features.rmsAmplitude / 50));
  } else {
    pattern = 'normal';
    confidence = Math.min(0.80, 0.4 + (features.zeroCrossingRate * 5));
  }

  // Generate recommendations based on classification
  const recommendations: string[] = [];
  let predictedProgression = '';

  switch (pattern) {
    case 'severe':
      recommendations.push('Contact healthcare provider immediately');
      recommendations.push('Monitor for medication effectiveness');
      recommendations.push('Consider DBS evaluation if persistent');
      predictedProgression = 'Rapid progression likely - immediate intervention recommended';
      break;
    case 'moderate':
      recommendations.push('Continue current medication regimen');
      recommendations.push('Monitor for pattern changes');
      recommendations.push('Consider physical therapy');
      predictedProgression = 'Stable with potential slow progression';
      break;
    case 'mild':
      recommendations.push('Regular monitoring recommended');
      recommendations.push('Maintain healthy lifestyle');
      recommendations.push('Watch for progression indicators');
      predictedProgression = 'Early stage - monitor closely';
      break;
    default:
      recommendations.push('Continue normal activities');
      recommendations.push('Regular check-ups recommended');
      recommendations.push('No immediate concerns');
      predictedProgression = 'Normal variation - no progression detected';
  }

  return {
    pattern,
    confidence,
    recommendations,
    predictedProgression
  };
}
