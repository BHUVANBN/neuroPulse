import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TremorData from '@/lib/models/TremorData';
import Device from '@/lib/models/Device';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Validate frequency range (3-12 Hz for tremor)
    if (frequency < 0 || frequency > 20) {
      return NextResponse.json(
        { error: 'Frequency must be between 0 and 20 Hz' },
        { status: 400 }
      );
    }

    // Validate amplitude (positive values)
    if (amplitude < 0) {
      return NextResponse.json(
        { error: 'Amplitude must be positive' },
        { status: 400 }
      );
    }

    // Validate severity index (0-100)
    if (severityIndex < 0 || severityIndex > 100) {
      return NextResponse.json(
        { error: 'Severity index must be between 0 and 100' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find or create device with enhanced information
    let device = await Device.findOne({ deviceId });

    if (!device) {
      // Create new device if it doesn't exist
      device = new Device({
        deviceId,
        name: `ESP32-${deviceId.slice(-4)}`,
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
      userId: device.userId, // Assuming device is linked to a user
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

  } catch (error: any) {
    console.error('Error recording medical tremor data:', error);

    // Enhanced error reporting
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
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

    // Build advanced query
    const query: any = {
      deviceId,
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
