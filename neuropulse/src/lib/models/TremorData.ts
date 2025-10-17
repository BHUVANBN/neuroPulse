import mongoose, { Document, Schema } from 'mongoose';

export interface ITremorData extends Document {
  _id: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  timestamp: Date;
  frequency: number; // Hz
  amplitude: number; // m/s²
  severityIndex: number; // 0-100 scale
  rawData?: {
    emg?: number[];
    accelerometer?: {
      x: number;
      y: number;
      z: number;
    };
    gyroscope?: {
      x: number;
      y: number;
      z: number;
    };
  };
  aiInsights?: {
    pattern: 'normal' | 'mild' | 'moderate' | 'severe';
    confidence: number;
    recommendations: string[];
    predictedProgression?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
  createdAt: Date;
}

const tremorDataSchema = new Schema<ITremorData>(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device ID is required'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: [true, 'Timestamp is required'],
    },
    frequency: {
      type: Number,
      required: [true, 'Frequency is required'],
      min: [0, 'Frequency must be positive'],
      max: [50, 'Frequency cannot exceed 50 Hz'],
    },
    amplitude: {
      type: Number,
      required: [true, 'Amplitude is required'],
      min: [0, 'Amplitude must be positive'],
    },
    severityIndex: {
      type: Number,
      required: [true, 'Severity index is required'],
      min: [0, 'Severity index must be between 0 and 100'],
      max: [100, 'Severity index must be between 0 and 100'],
    },
    rawData: {
      emg: [Number],
      accelerometer: {
        x: Number,
        y: Number,
        z: Number,
      },
      gyroscope: {
        x: Number,
        y: Number,
        z: Number,
      },
    },
    aiInsights: {
      pattern: {
        type: String,
        enum: ['normal', 'mild', 'moderate', 'severe'],
      },
      confidence: {
        type: Number,
        min: [0, 'Confidence must be between 0 and 1'],
        max: [1, 'Confidence must be between 0 and 1'],
      },
      recommendations: [String],
      predictedProgression: String,
    },
    location: {
      latitude: Number,
      longitude: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
tremorDataSchema.index({ userId: 1, timestamp: -1 });
tremorDataSchema.index({ deviceId: 1, timestamp: -1 });
tremorDataSchema.index({ timestamp: -1 });
tremorDataSchema.index({ severityIndex: -1 });

// TTL index to automatically delete old data (optional - can be configured)
tremorDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // 1 year

export default mongoose.models.TremorData || mongoose.model<ITremorData>('TremorData', tremorDataSchema);
