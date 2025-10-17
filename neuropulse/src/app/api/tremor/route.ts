import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TremorData from '@/lib/models/TremorData';
import Device from '@/lib/models/Device';
import User from '@/lib/models/User';
import mongoose from 'mongoose';
import { processRawEMGData, generateEMGInsights, EMGData } from '@/lib/emgProcessing';

// Socket.io integration for real-time updates
let io: any = null;

export function setSocketIO(socketIOInstance: any) {
  io = socketIOInstance;
}

// Helper function to emit real-time updates
function emitRealtimeUpdate(data: any) {
  if (io) {
    // Emit to all connected clients in the 'tremor-updates' room
    io.to('tremor-updates').emit('tremor-update', data);
    console.log('📡 Emitted real-time update:', data.classification);
  }
}

// Handle local classification data from ESP32
async function handleLocalClassification(body: any) {
  const {
    deviceId,
    timestamp,
    frequency,
    amplitude,
    rms,
    classification,
    firmwareVersion
  } = body;

  if (!deviceId || !classification) {
    return NextResponse.json(
      {
        error: 'Device ID and classification are required for local data',
        received: Object.keys(body)
      },
      { status: 400 }
    );
  }

  await dbConnect();

  // Find or create device for local classifier
  let device = await Device.findOne({ deviceId: deviceId });

  if (!device) {
    // Create device for local classifier
    device = new Device({
      deviceId,
      name: 'ESP32 Local Classifier',
      userId: null, // No specific user for local classification
      isActive: true,
      lastSeen: new Date(),
      batteryLevel: 100, // Assume always connected
      firmwareVersion: firmwareVersion || '3.1.0',
      deviceType: 'local_classifier'
    });
    await device.save();
  } else {
    device.lastSeen = new Date();
    device.isActive = true;
    await device.save();
  }

  // Map classification to severity index
  const severityMap = {
    'NORMAL': 10,
    'MILD': 25,
    'MODERATE': 50,
    'SEVERE': 80
  };

  const severityIndex = severityMap[classification as keyof typeof severityMap] || 0;

  // Create tremor data record
  const tremorData = new TremorData({
    deviceId: device._id,
    userId: device.userId,
    timestamp: new Date(timestamp || Date.now()),
    frequency: parseFloat(frequency) || 0,
    amplitude: parseFloat(amplitude) || 0,
    severityIndex: severityIndex,
    rawData: {
      emg: [], // No raw EMG data for local classification
      localClassification: classification,
      rms: parseFloat(rms) || 0
    },
    aiInsights: {
      pattern: classification.toLowerCase(),
      confidence: 0.95, // High confidence for local classification
      recommendations: getRecommendationsForClassification(classification),
      predictedProgression: getProgressionForClassification(classification)
    }
  });

  await tremorData.save();

  console.log(`Local Classification Received - Device: ${deviceId}, Class: ${classification}, Severity: ${severityIndex}`);

  // Emit real-time update
  const realtimeData = {
    id: tremorData._id,
    deviceId: deviceId,
    classification: classification,
    severityIndex: tremorData.severityIndex,
    frequency: tremorData.frequency,
    amplitude: tremorData.amplitude,
    confidence: 0.95,
    aiInsights: tremorData.aiInsights,
    timestamp: tremorData.timestamp,
    batteryLevel: device.batteryLevel,
  };

  emitRealtimeUpdate(realtimeData);

  return NextResponse.json({
    success: true,
    message: 'Local classification data recorded successfully',
    data: {
      id: tremorData._id,
      deviceId: deviceId,
      classification: classification,
      severityIndex: tremorData.severityIndex,
      frequency: tremorData.frequency,
      amplitude: tremorData.amplitude,
      aiInsights: tremorData.aiInsights,
      timestamp: tremorData.timestamp,
      batteryLevel: device.batteryLevel,
    },
  });
}

function getRecommendationsForClassification(classification: string): string[] {
  switch (classification) {
    case 'SEVERE':
      return [
        'Contact healthcare provider immediately',
        'Monitor for medication effectiveness',
        'Consider DBS evaluation if persistent'
      ];
    case 'MODERATE':
      return [
        'Continue current medication regimen',
        'Monitor for pattern changes',
        'Consider physical therapy'
      ];
    case 'MILD':
      return [
        'Regular monitoring recommended',
        'Maintain healthy lifestyle',
        'Watch for progression indicators'
      ];
    default:
      return [
        'Continue normal activities',
        'Regular check-ups recommended',
        'No immediate concerns'
      ];
  }
}

function getProgressionForClassification(classification: string): string {
  switch (classification) {
    case 'SEVERE':
      return 'Rapid progression likely - immediate intervention recommended';
    case 'MODERATE':
      return 'Stable with potential slow progression';
    case 'MILD':
      return 'Early stage - monitor closely';
    default:
      return 'Normal variation - no progression detected';
  }
}

// Main POST endpoint for tremor data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle local classification data from ESP32
    if (body.dataType === 'local_classification' || body.classification) {
      return await handleLocalClassification(body);
    }
    // Handle both old format (processed data) and new format (raw EMG data)
    else if (body.dataType === 'filtered_emg' || body.dataType === 'raw_emg') {
      return await handleRawEMGData(body);
    } else {
      return await handleProcessedData(body);
    }
  } catch (error: any) {
    console.error('Error in tremor API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
async function handleRawEMGData(body: EMGData) {
  const { deviceId, emgData, sampleRate, metadata } = body;

  if (!deviceId || !emgData || emgData.length === 0) {
    return NextResponse.json(
      {
        error: 'Device ID and EMG data are required',
        received: { deviceId, dataLength: emgData?.length }
      },
      { status: 400 }
    );
  }

  await dbConnect();

  // Find or create device
  let device = await Device.findOne({ deviceId });

  if (!device) {
    // Find a default user for the device (use first patient user)
    const defaultUser = await User.findOne({ role: 'patient' });

    if (!defaultUser) {
      return NextResponse.json(
        { error: 'No patient user found. Please register a patient first.' },
        { status: 400 }
      );
    }

    // Create new device
    device = new Device({
      deviceId,
      name: `ESP32-${deviceId.slice(-4)}`,
      userId: defaultUser._id,
      isActive: true,
      lastSeen: new Date(),
      batteryLevel: 85, // Default value
      firmwareVersion: body.firmwareVersion || '3.0.0',
    });
    await device.save();
  } else {
    // Update device information
    device.lastSeen = new Date();
    device.isActive = true;
    await device.save();
  }

  // Process raw EMG data
  const processingResult = processRawEMGData(body);

  // Generate AI insights
  const insights = generateEMGInsights(processingResult.features);

  // Create tremor data record
  const tremorData = new TremorData({
    deviceId: device._id,
    userId: device.userId,
    timestamp: new Date(),
    frequency: processingResult.features.frequency,
    amplitude: processingResult.features.amplitude,
    severityIndex: processingResult.features.severityIndex,
    rawData: {
      emg: emgData.slice(0, 100), // Store limited raw data for analysis
    },
    aiInsights: {
      pattern: insights.pattern,
      confidence: insights.confidence,
      recommendations: insights.recommendations,
      predictedProgression: insights.predictedProgression,
    },
    location: undefined,
  });

  await tremorData.save();

  // Enhanced logging for medical-grade system
  console.log(`Medical Data Received - Device: ${deviceId}, Type: Raw EMG, Samples: ${emgData.length}`);
  console.log(`Processing Results - Freq: ${processingResult.features.frequency.toFixed(2)} Hz, Amp: ${processingResult.features.amplitude.toFixed(2)}, Severity: ${processingResult.features.severityIndex.toFixed(1)}`);
  console.log(`Quality Metrics - SNR: ${processingResult.qualityMetrics.signalToNoiseRatio.toFixed(1)} dB, Quality: ${processingResult.qualityMetrics.dataQuality}`);

  // Return comprehensive response
  return NextResponse.json({
    success: true,
    message: 'Raw EMG data processed and recorded successfully',
    data: {
      id: tremorData._id,
      deviceId: deviceId,
      severityIndex: tremorData.severityIndex,
      frequency: tremorData.frequency,
      amplitude: tremorData.amplitude,
      aiInsights: tremorData.aiInsights,
      timestamp: tremorData.timestamp,
      batteryLevel: device.batteryLevel,
      qualityMetrics: processingResult.qualityMetrics,
    },
  });
}

// Handle legacy processed data format (for backward compatibility)
async function handleProcessedData(body: any) {
  const {
    deviceId,
    timestamp,
    frequency,
    amplitude,
    severityIndex,
    batteryLevel,
    rawData,
    aiInsights
  } = body;

  // Enhanced validation for medical-grade data
  if (!deviceId || frequency === undefined || amplitude === undefined || severityIndex === undefined) {
    return NextResponse.json(
      {
        error: 'Device ID, frequency, amplitude, and severityIndex are required',
        received: Object.keys(body)
      },
      { status: 400 }
    );
  }

  await dbConnect();

  // Find or create device with enhanced information
  let device = await Device.findOne({ deviceId });

  if (!device) {
    // Find a default user for the device (use first patient user)
    const defaultUser = await User.findOne({ role: 'patient' });

    if (!defaultUser) {
      return NextResponse.json(
        { error: 'No patient user found. Please register a patient first.' },
        { status: 400 }
      );
    }

    // Create new device if it doesn't exist
    device = new Device({
      deviceId,
      name: `ESP32-${deviceId.slice(-4)}`,
      userId: defaultUser._id,
      isActive: true,
      lastSeen: new Date(),
      batteryLevel: batteryLevel || 100,
      firmwareVersion: '2.0.0',
    });
    await device.save();
  } else {
    // Update device information
    device.lastSeen = new Date();
    device.isActive = true;
    if (batteryLevel !== undefined) {
      device.batteryLevel = batteryLevel;
    }
    await device.save();
  }

  // Validate AI insights if provided
  let validatedAIInsights = undefined;
  if (aiInsights) {
    if (aiInsights.pattern && ['normal', 'mild', 'moderate', 'severe'].includes(aiInsights.pattern)) {
      validatedAIInsights = {
        pattern: aiInsights.pattern,
        confidence: Math.max(0, Math.min(1, aiInsights.confidence || 0.5)),
        recommendations: Array.isArray(aiInsights.recommendations) ? aiInsights.recommendations : [],
        predictedProgression: aiInsights.predictedProgression || '',
      };
    }
  }

  // Create comprehensive tremor data record
  const tremorData = new TremorData({
    deviceId: device._id,
    userId: device.userId,
    timestamp: new Date(timestamp || Date.now()),
    frequency: parseFloat(frequency),
    amplitude: parseFloat(amplitude),
    severityIndex: parseFloat(severityIndex),
    rawData: {
      emg: Array.isArray(rawData?.emg) ? rawData.emg.slice(0, 100) : [], // Limit raw data for storage
    },
    aiInsights: validatedAIInsights,
    location: undefined, // Could add GPS data later
  });

  await tremorData.save();

  // Enhanced logging for medical-grade system
  console.log(`Medical Data Received - Device: ${deviceId}, Freq: ${frequency}Hz, Amp: ${amplitude}, Severity: ${severityIndex}`);

  // Return comprehensive response
  return NextResponse.json({
    success: true,
    message: 'Medical-grade tremor data recorded successfully',
    data: {
      id: tremorData._id,
      deviceId: deviceId,
      severityIndex: tremorData.severityIndex,
      frequency: tremorData.frequency,
      amplitude: tremorData.amplitude,
      aiInsights: tremorData.aiInsights,
      timestamp: tremorData.timestamp,
      batteryLevel: device.batteryLevel,
    },
  });
}

// GET endpoint for retrieving medical-grade tremor data with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeRaw = searchParams.get('includeRaw') === 'true';
    const minSeverity = parseFloat(searchParams.get('minSeverity') || '0');
    const maxSeverity = parseFloat(searchParams.get('maxSeverity') || '100');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Build advanced query - handle both ObjectId and string deviceId
    let deviceQuery: any = deviceId;

    // If deviceId is not a valid ObjectId, treat it as device string ID
    if (deviceId && !mongoose.Types.ObjectId.isValid(deviceId)) {
      // First find the device by string ID
      const device = await Device.findOne({ deviceId: deviceId });
      if (!device) {
        return NextResponse.json(
          { error: 'Device not found' },
          { status: 404 }
        );
      }
      deviceQuery = device._id;
    }

    const query: any = {
      deviceId: deviceQuery,
      severityIndex: { $gte: minSeverity, $lte: maxSeverity }
    };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const selectFields = includeRaw ? '' : '-rawData.emg';  // Exclude raw data unless requested

    const tremorData = await TremorData.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .select(selectFields)
      .populate('deviceId', 'name deviceId batteryLevel');

    // Add computed statistics for medical analysis
    const stats = {
      totalRecords: tremorData.length,
      averageSeverity: tremorData.length > 0
        ? tremorData.reduce((acc, item) => acc + item.severityIndex, 0) / tremorData.length
        : 0,
      averageFrequency: tremorData.length > 0
        ? tremorData.reduce((acc, item) => acc + item.frequency, 0) / tremorData.length
        : 0,
      averageAmplitude: tremorData.length > 0
        ? tremorData.reduce((acc, item) => acc + item.amplitude, 0) / tremorData.length
        : 0,
      severityDistribution: {
        normal: tremorData.filter(item => item.severityIndex < 20).length,
        mild: tremorData.filter(item => item.severityIndex >= 20 && item.severityIndex < 40).length,
        moderate: tremorData.filter(item => item.severityIndex >= 40 && item.severityIndex < 70).length,
        severe: tremorData.filter(item => item.severityIndex >= 70).length,
      },
      timeRange: {
        earliest: tremorData.length > 0 ? tremorData[tremorData.length - 1].timestamp : null,
        latest: tremorData.length > 0 ? tremorData[0].timestamp : null,
      }
    };

    return NextResponse.json({
      success: true,
      data: tremorData,
      statistics: stats,
      query: {
        deviceId,
        startDate,
        endDate,
        limit,
        minSeverity,
        maxSeverity,
        includeRaw
      }
    });

  } catch (error: any) {
    console.error('Error retrieving medical tremor data:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
