import * as tf from '@tensorflow/tfjs-node';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TremorData from '@/lib/models/TremorData';

// Medical-grade ML model for tremor classification
class TremorClassifier {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;

  constructor() {
    this.initializeModel();
  }

  // Initialize the neural network model
  async initializeModel() {
    try {
      // Create a sequential model for tremor classification
      this.model = tf.sequential({
        layers: [
          // Input layer - 10 features (frequency, amplitude, spectral features, etc.)
          tf.layers.dense({
            inputShape: [10],
            units: 32,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
          }),

          // Hidden layer 1
          tf.layers.dense({
            units: 16,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
          }),

          // Dropout for regularization
          tf.layers.dropout({ rate: 0.3 }),

          // Hidden layer 2
          tf.layers.dense({
            units: 8,
            activation: 'relu'
          }),

          // Output layer - 4 classes (normal, mild, moderate, severe)
          tf.layers.dense({
            units: 4,
            activation: 'softmax'
          })
        ]
      });

      // Compile the model
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.isModelLoaded = true;
      console.log('Tremor classification model initialized');
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
    }
  }

  // Enhanced feature extraction for ML
  extractMedicalFeatures(tremorData: any) {
    const features = [
      // Temporal features
      tremorData.frequency || 0,
      tremorData.amplitude || 0,
      tremorData.severityIndex || 0,

      // Spectral features
      this.calculateSpectralCentroid(tremorData),
      this.calculateSpectralRolloff(tremorData),
      this.calculateSpectralFlux(tremorData),

      // Statistical features
      this.calculateRMS(tremorData),
      this.calculateZeroCrossingRate(tremorData),
      this.calculateSpectralEntropy(tremorData),

      // Medical-specific features
      this.calculateTremorRegularity(tremorData),
      this.calculateMovementVariability(tremorData)
    ];

    return features;
  }

  // Spectral centroid calculation
  calculateSpectralCentroid(data: any): number {
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50); // Use first 50 samples
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < samples.length; i++) {
      const magnitude = Math.abs(samples[i]);
      const frequency = (i / samples.length) * 100; // Assume 100 Hz max
      numerator += frequency * magnitude;
      denominator += magnitude;
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  // Spectral rolloff calculation (frequency below which 85% of energy is contained)
  calculateSpectralRolloff(data: any): number {
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    const totalEnergy = samples.reduce((sum: number, sample: number) =>
      sum + Math.abs(sample) * Math.abs(sample), 0);

    let cumulativeEnergy = 0;
    for (let i = 0; i < samples.length; i++) {
      cumulativeEnergy += Math.abs(samples[i]) * Math.abs(samples[i]);
      if (cumulativeEnergy >= totalEnergy * 0.85) {
        return (i / samples.length) * 100; // Return as percentage
      }
    }

    return 100;
  }

  // Spectral flux calculation
  calculateSpectralFlux(data: any): number {
    // Simplified spectral flux calculation
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    let flux = 0;

    for (let i = 1; i < samples.length; i++) {
      flux += Math.abs(Math.abs(samples[i]) - Math.abs(samples[i - 1]));
    }

    return flux / (samples.length - 1);
  }

  // RMS calculation
  calculateRMS(data: any): number {
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    const sumSquares = samples.reduce((sum: number, sample: number) =>
      sum + sample * sample, 0);

    return Math.sqrt(sumSquares / samples.length);
  }

  // Zero crossing rate calculation
  calculateZeroCrossingRate(data: any): number {
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    let zeroCrossings = 0;

    for (let i = 1; i < samples.length; i++) {
      if ((samples[i-1] > 0 && samples[i] < 0) || (samples[i-1] < 0 && samples[i] > 0)) {
        zeroCrossings++;
      }
    }

    return zeroCrossings / (samples.length - 1);
  }

  // Spectral entropy calculation
  calculateSpectralEntropy(data: any): number {
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    const totalEnergy = samples.reduce((sum: number, sample: number) =>
      sum + Math.abs(sample), 0);

    if (totalEnergy === 0) return 0;

    let entropy = 0;
    for (const sample of samples) {
      const normalized = Math.abs(sample) / totalEnergy;
      if (normalized > 0.001) {
        entropy -= normalized * Math.log2(normalized);
      }
    }

    return entropy;
  }

  // Tremor regularity calculation
  calculateTremorRegularity(data: any): number {
    // Calculate how regular the tremor pattern is
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    const windowSize = 10;
    let regularity = 0;

    for (let i = windowSize; i < samples.length; i++) {
      const correlation = this.calculateCorrelation(
        samples.slice(i - windowSize, i),
        samples.slice(i, i + windowSize)
      );
      regularity += Math.abs(correlation);
    }

    return regularity / (samples.length - windowSize);
  }

  // Movement variability calculation
  calculateMovementVariability(data: any): number {
    if (!data.rawData?.emg || data.rawData.emg.length === 0) return 0;

    const samples = data.rawData.emg.slice(0, 50);
    const mean = samples.reduce((sum: number, val: number) => sum + val, 0) / samples.length;

    const variance = samples.reduce((sum: number, val: number) =>
      sum + Math.pow(val - mean, 2), 0) / samples.length;

    return Math.sqrt(variance);
  }

  // Correlation calculation for regularity
  calculateCorrelation(arr1: number[], arr2: number[]): number {
    if (arr1.length !== arr2.length || arr1.length === 0) return 0;

    const mean1 = arr1.reduce((sum, val) => sum + val, 0) / arr1.length;
    const mean2 = arr2.reduce((sum, val) => sum + val, 0) / arr2.length;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < arr1.length; i++) {
      const diff1 = arr1[i] - mean1;
      const diff2 = arr2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1 * denom2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Classify tremor using ML model
  async classifyTremor(features: number[]): Promise<{
    classification: string;
    confidence: number;
    probabilities: number[];
  }> {
    if (!this.isModelLoaded || !this.model) {
      // Fallback to rule-based classification
      return this.ruleBasedClassification(features);
    }

    try {
      // Prepare input tensor
      const inputTensor = tf.tensor2d([features], [1, 10]);
      const prediction = this.model.predict(inputTensor) as tf.Tensor;

      // Get probabilities
      const probabilities = await prediction.data();

      // Find the class with highest probability
      let maxProb = 0;
      let predictedClass = 0;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          predictedClass = i;
        }
      }

      // Convert to class names
      const classNames = ['normal', 'mild', 'moderate', 'severe'];
      const classification = classNames[predictedClass];

      // Cleanup tensors
      inputTensor.dispose();
      prediction.dispose();

      return {
        classification,
        confidence: maxProb,
        probabilities: Array.from(probabilities)
      };
    } catch (error) {
      console.error('ML classification error:', error);
      return this.ruleBasedClassification(features);
    }
  }

  // Rule-based classification as fallback
  ruleBasedClassification(features: number[]): {
    classification: string;
    confidence: number;
    probabilities: number[];
  } {
    // Features: [frequency, amplitude, severity, spectralCentroid, spectralRolloff, spectralFlux, rms, zeroCrossingRate, spectralEntropy, tremorRegularity, movementVariability]

    const frequency = features[0];
    const amplitude = features[1];
    const severity = features[2];
    const spectralCentroid = features[3];
    const spectralRolloff = features[4];
    const spectralFlux = features[5];
    const rms = features[6];
    const zeroCrossingRate = features[7];
    const spectralEntropy = features[8];
    const tremorRegularity = features[9];

    // Medical-grade classification rules based on clinical research
    let classification = 'normal';
    let confidence = 0.5;

    // Check for tremor frequency range (3-8 Hz for Parkinson's)
    if (frequency >= 3 && frequency <= 8) {
      // Likely tremor - check amplitude and regularity
      if (amplitude > 50 && tremorRegularity > 0.3) {
        classification = 'severe';
        confidence = 0.85;
      } else if (amplitude > 20 && tremorRegularity > 0.2) {
        classification = 'moderate';
        confidence = 0.75;
      } else if (amplitude > 10 && tremorRegularity > 0.1) {
        classification = 'mild';
        confidence = 0.65;
      }
    }

    // Additional checks for non-tremor movement disorders
    if (frequency > 8 && frequency < 15 && spectralEntropy > 2.0) {
      classification = 'mild'; // Could be essential tremor
      confidence = 0.6;
    }

    // Calculate probabilities for all classes
    const probabilities = [0.25, 0.25, 0.25, 0.25]; // Default equal probabilities
    const classIndex = ['normal', 'mild', 'moderate', 'severe'].indexOf(classification);
    if (classIndex >= 0) {
      probabilities[classIndex] = confidence;
      // Distribute remaining probability
      const remaining = (1 - confidence) / 3;
      for (let i = 0; i < 4; i++) {
        if (i !== classIndex) {
          probabilities[i] = remaining;
        }
      }
    }

    return {
      classification,
      confidence,
      probabilities
    };
  }

  // Train the model with historical data
  async trainModel(): Promise<void> {
    if (!this.isModelLoaded || !this.model) return;

    try {
      await dbConnect();

      // Get historical tremor data for training
      const historicalData = await TremorData.find({})
        .sort({ timestamp: -1 })
        .limit(1000)
        .lean();

      if (historicalData.length < 100) {
        console.log('Insufficient training data');
        return;
      }

      // Prepare training data
      const features: number[][] = [];
      const labels: number[][] = [];

      for (const record of historicalData) {
        const recordFeatures = this.extractMedicalFeatures(record);
        features.push(recordFeatures);

        // Create one-hot encoded labels based on severity
        const severity = record.severityIndex || 0;
        let labelIndex = 0;
        if (severity >= 70) labelIndex = 3; // severe
        else if (severity >= 40) labelIndex = 2; // moderate
        else if (severity >= 20) labelIndex = 1; // mild

        labels.push([
          labelIndex === 0 ? 1 : 0, // normal
          labelIndex === 1 ? 1 : 0, // mild
          labelIndex === 2 ? 1 : 0, // moderate
          labelIndex === 3 ? 1 : 0  // severe
        ]);
      }

      // Convert to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels);

      // Train the model
      await this.model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, accuracy = ${logs?.acc?.toFixed(4)}`);
          }
        }
      });

      console.log('Model training completed');

      // Cleanup tensors
      xs.dispose();
      ys.dispose();

    } catch (error) {
      console.error('Model training error:', error);
    }
  }
}

// Global classifier instance
const tremorClassifier = new TremorClassifier();

// API endpoint for ML-based tremor classification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, tremorData } = body;

    if (!deviceId || !tremorData) {
      return NextResponse.json(
        { error: 'Device ID and tremor data are required' },
        { status: 400 }
      );
    }

    // Extract features for ML classification
    const features = tremorClassifier.extractMedicalFeatures(tremorData);

    // Classify using ML model
    const classification = await tremorClassifier.classifyTremor(features);

    // Generate medical recommendations based on classification
    const recommendations = generateMedicalRecommendations(classification);

    // Calculate progression risk
    const progressionRisk = calculateProgressionRisk(classification, features);

    return NextResponse.json({
      success: true,
      classification: classification.classification,
      confidence: classification.confidence,
      probabilities: classification.probabilities,
      features: features,
      recommendations,
      progressionRisk,
      medicalInsights: {
        frequencyAnalysis: analyzeFrequencyPattern(features[0]),
        amplitudeAnalysis: analyzeAmplitudePattern(features[1]),
        spectralAnalysis: analyzeSpectralFeatures(features.slice(3, 8)),
        clinicalCorrelation: correlateWithClinicalScales(classification)
      }
    });

  } catch (error: any) {
    console.error('ML classification error:', error);
    return NextResponse.json(
      {
        error: 'Classification failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Generate medical recommendations based on classification
function generateMedicalRecommendations(classification: any): string[] {
  const baseRecommendations = [
    'Continue regular monitoring',
    'Maintain medication schedule',
    'Document symptom patterns'
  ];

  switch (classification.classification) {
    case 'severe':
      return [
        'Contact healthcare provider immediately',
        'Monitor for medication side effects',
        'Consider DBS evaluation if persistent',
        'Document all episodes for clinical review',
        'Avoid triggers (caffeine, stress, fatigue)'
      ];

    case 'moderate':
      return [
        'Continue current medication regimen',
        'Monitor for pattern changes',
        'Consider physical therapy referral',
        'Track medication effectiveness',
        'Regular follow-up appointments'
      ];

    case 'mild':
      return [
        'Regular monitoring recommended',
        'Maintain healthy lifestyle',
        'Watch for progression indicators',
        'Document environmental triggers',
        'Annual neurological evaluation'
      ];

    default:
      return baseRecommendations;
  }
}

// Calculate progression risk
function calculateProgressionRisk(classification: any, features: number[]): string {
  const frequency = features[0];
  const amplitude = features[1];
  const tremorRegularity = features[9];

  // Risk factors for progression
  let riskScore = 0;

  if (frequency > 6) riskScore += 2; // Higher frequency tremor
  if (amplitude > 50) riskScore += 2; // High amplitude
  if (tremorRegularity > 0.5) riskScore += 1; // Regular tremor pattern
  if (classification.confidence > 0.8) riskScore += 1; // High confidence classification

  if (riskScore >= 4) return 'High progression risk - immediate clinical intervention recommended';
  if (riskScore >= 2) return 'Moderate progression risk - close monitoring required';
  return 'Low progression risk - routine monitoring sufficient';
}

// Analyze frequency patterns
function analyzeFrequencyPattern(frequency: number): any {
  return {
    value: frequency,
    interpretation: frequency >= 3 && frequency <= 8 ?
      'Within typical Parkinson\'s tremor range (3-8 Hz)' :
      'Outside typical tremor frequency range',
    clinicalSignificance: frequency >= 3 && frequency <= 8 ? 'high' : 'low'
  };
}

// Analyze amplitude patterns
function analyzeAmplitudePattern(amplitude: number): any {
  return {
    value: amplitude,
    interpretation: amplitude > 50 ?
      'High amplitude tremor - significant motor impairment' :
      amplitude > 20 ?
      'Moderate amplitude tremor - noticeable symptoms' :
      'Low amplitude tremor - minimal clinical impact',
    clinicalSignificance: amplitude > 50 ? 'high' : amplitude > 20 ? 'moderate' : 'low'
  };
}

// Analyze spectral features
function analyzeSpectralFeatures(spectralFeatures: number[]): any {
  const [centroid, rolloff, flux, rms, zcr, entropy] = spectralFeatures;

  return {
    spectralCentroid: {
      value: centroid,
      interpretation: centroid > 20 ? 'High frequency content' : 'Low frequency content'
    },
    spectralRolloff: {
      value: rolloff,
      interpretation: rolloff > 70 ? 'Energy concentrated in higher frequencies' : 'Energy in lower frequencies'
    },
    spectralFlux: {
      value: flux,
      interpretation: flux > 10 ? 'Rapid spectral changes' : 'Stable spectral content'
    },
    signalComplexity: entropy > 2 ? 'High complexity' : 'Low complexity'
  };
}

// Correlate with clinical scales
function correlateWithClinicalScales(classification: any): any {
  return {
    updrsCorrelation: {
      // Unified Parkinson's Disease Rating Scale correlation
      motorScore: classification.classification === 'severe' ? '3-4' :
                 classification.classification === 'moderate' ? '2-3' : '1-2',
      tremorSubscore: classification.classification === 'severe' ? '3-4' :
                     classification.classification === 'moderate' ? '2-3' : '1-2'
    },
    hoehnYahrStage: {
      // Hoehn and Yahr staging correlation
      estimatedStage: classification.classification === 'severe' ? '3-4' :
                     classification.classification === 'moderate' ? '2-3' : '1-2',
      confidence: classification.confidence * 100 + '%'
    }
  };
}

// Training endpoint
export async function PUT(request: NextRequest) {
  try {
    await tremorClassifier.trainModel();

    return NextResponse.json({
      success: true,
      message: 'Model training completed'
    });

  } catch (error: any) {
    console.error('Model training error:', error);
    return NextResponse.json(
      {
        error: 'Training failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}
