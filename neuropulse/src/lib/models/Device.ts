import mongoose, { Document, Schema } from 'mongoose';

export interface IDevice extends Document {
  _id: mongoose.Types.ObjectId;
  deviceId: string; // ESP32 device identifier
  name: string;
  userId: mongoose.Types.ObjectId;
  isActive: boolean;
  lastSeen: Date;
  batteryLevel?: number;
  firmwareVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      maxlength: [50, 'Device name cannot be more than 50 characters'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    batteryLevel: {
      type: Number,
      min: [0, 'Battery level must be between 0 and 100'],
      max: [100, 'Battery level must be between 0 and 100'],
    },
    firmwareVersion: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Update lastSeen whenever device sends data
deviceSchema.pre('save', function (next) {
  this.lastSeen = new Date();
  next();
});

// Index for faster queries
deviceSchema.index({ userId: 1, isActive: 1 });
deviceSchema.index({ deviceId: 1 });

export default mongoose.models.Device || mongoose.model<IDevice>('Device', deviceSchema);
