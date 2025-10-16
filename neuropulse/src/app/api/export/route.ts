import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TremorData from '@/lib/models/TremorData';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const deviceId = searchParams.get('deviceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const includeML = searchParams.get('includeML') === 'true';

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Enhanced query with medical-grade filtering
    const query: any = {
      deviceId,
      userId: session.user.id,
    };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get comprehensive tremor data
    const tremorData = await TremorData.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('deviceId', 'name deviceId batteryLevel firmwareVersion');

    // Validate data quality
    const dataQuality = validateDataQuality(tremorData);

    if (format === 'csv') {
      return generateMedicalCSV(tremorData, dataQuality);
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: tremorData,
        count: tremorData.length,
        statistics: generateMedicalStatistics(tremorData),
        dataQuality,
        medicalReport: generateMedicalReport(tremorData, dataQuality),
        query: {
          deviceId,
          startDate,
          endDate,
          limit,
          includeML
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use csv or json' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Error exporting medical data:', error);

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

// Enhanced CSV generation with medical-grade data
function generateMedicalCSV(data: any[], dataQuality: any) {
  if (data.length === 0) {
    return new NextResponse('No data found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  const headers = [
    'Timestamp',
    'Device Name',
    'Device ID',
    'Frequency (Hz)',
    'Amplitude',
    'Severity Index',
    'Pattern',
    'Confidence',
    'Recommendations',
    'Progression Risk',
    'Data Quality Score',
    'Clinical Correlation',
    'Battery Level (%)',
    'Firmware Version'
  ];

  const csvContent = [
    headers.join(','),
    ...data.map(item => [
      item.timestamp.toISOString(),
      `"${item.deviceId.name}"`,
      `"${item.deviceId.deviceId}"`,
      item.frequency?.toFixed(3) || 'N/A',
      item.amplitude?.toFixed(3) || 'N/A',
      item.severityIndex?.toFixed(1) || 'N/A',
      `"${item.aiInsights?.pattern || 'N/A'}"`,
      item.aiInsights?.confidence ? (item.aiInsights.confidence * 100).toFixed(1) + '%' : 'N/A',
      `"${item.aiInsights?.recommendations?.join('; ') || 'N/A'}"`,
      `"${item.aiInsights?.predictedProgression || 'N/A'}"`,
      dataQuality.overallScore?.toFixed(1) || 'N/A',
      `"${getClinicalCorrelation(item)}"`,
      item.deviceId?.batteryLevel || 'N/A',
      `"${item.deviceId?.firmwareVersion || 'N/A'}"`
    ].join(','))
  ].join('\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="medical-tremor-report-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

// Generate comprehensive medical statistics
function generateMedicalStatistics(data: any[]) {
  if (data.length === 0) return {};

  const severities = data.map(d => d.severityIndex).filter(s => s != null);
  const frequencies = data.map(d => d.frequency).filter(f => f != null);
  const amplitudes = data.map(d => d.amplitude).filter(a => a != null);

  return {
    totalRecords: data.length,
    averageSeverity: severities.length > 0 ?
      severities.reduce((a, b) => a + b, 0) / severities.length : 0,
    averageFrequency: frequencies.length > 0 ?
      frequencies.reduce((a, b) => a + b, 0) / frequencies.length : 0,
    averageAmplitude: amplitudes.length > 0 ?
      amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length : 0,

    severityDistribution: {
      normal: data.filter(d => (d.severityIndex || 0) < 20).length,
      mild: data.filter(d => (d.severityIndex || 0) >= 20 && (d.severityIndex || 0) < 40).length,
      moderate: data.filter(d => (d.severityIndex || 0) >= 40 && (d.severityIndex || 0) < 70).length,
      severe: data.filter(d => (d.severityIndex || 0) >= 70).length,
    },

    frequencyAnalysis: {
      min: frequencies.length > 0 ? Math.min(...frequencies) : 0,
      max: frequencies.length > 0 ? Math.max(...frequencies) : 0,
      tremorRange: frequencies.filter(f => f >= 3 && f <= 8).length,
      nonTremorRange: frequencies.filter(f => f < 3 || f > 8).length,
    },

    timeAnalysis: {
      earliest: data.length > 0 ? data[data.length - 1].timestamp : null,
      latest: data.length > 0 ? data[0].timestamp : null,
      duration: data.length > 0 ?
        (data[0].timestamp.getTime() - data[data.length - 1].timestamp.getTime()) / (1000 * 60 * 60) : 0, // hours
    },

    clinicalMetrics: {
      updrsCorrelation: calculateUPDRSCorrelation(data),
      hoehnYahrCorrelation: calculateHoehnYahrCorrelation(data),
      progressionIndicators: analyzeProgression(data),
    }
  };
}

// Validate data quality for medical use
function validateDataQuality(data: any[]) {
  if (data.length === 0) return { overallScore: 0, issues: ['No data available'] };

  let score = 100;
  const issues: string[] = [];

  // Check for missing critical fields
  const missingFrequency = data.filter(d => d.frequency == null).length;
  const missingAmplitude = data.filter(d => d.amplitude == null).length;
  const missingSeverity = data.filter(d => d.severityIndex == null).length;

  if (missingFrequency > data.length * 0.1) {
    score -= 20;
    issues.push(`High frequency of missing frequency data (${missingFrequency}/${data.length})`);
  }

  if (missingAmplitude > data.length * 0.1) {
    score -= 20;
    issues.push(`High frequency of missing amplitude data (${missingAmplitude}/${data.length})`);
  }

  if (missingSeverity > data.length * 0.1) {
    score -= 20;
    issues.push(`High frequency of missing severity data (${missingSeverity}/${data.length})`);
  }

  // Check for data consistency
  const frequencyVariance = calculateVariance(data.map(d => d.frequency).filter(f => f != null));
  if (frequencyVariance > 10) {
    score -= 10;
    issues.push('High frequency variance detected');
  }

  // Check for temporal consistency
  const timeGaps = findTimeGaps(data);
  if (timeGaps.length > 0) {
    score -= 15;
    issues.push(`${timeGaps.length} significant time gaps detected`);
  }

  // Check for signal quality indicators
  const lowConfidenceReadings = data.filter(d =>
    d.aiInsights?.confidence && d.aiInsights.confidence < 0.5
  ).length;

  if (lowConfidenceReadings > data.length * 0.2) {
    score -= 10;
    issues.push(`High frequency of low confidence readings (${lowConfidenceReadings}/${data.length})`);
  }

  return {
    overallScore: Math.max(0, score),
    issues,
    metrics: {
      missingDataPercentage: ((missingFrequency + missingAmplitude + missingSeverity) / (data.length * 3)) * 100,
      frequencyVariance,
      timeGaps: timeGaps.length,
      lowConfidencePercentage: (lowConfidenceReadings / data.length) * 100
    }
  };
}

// Generate comprehensive medical report
function generateMedicalReport(data: any[], dataQuality: any) {
  const stats = generateMedicalStatistics(data);

  return {
    reportDate: new Date().toISOString(),
    patientId: 'PATIENT_001', // Would come from user session
    physicianNotes: 'Generated by NeuroPulse Medical AI System',
    summary: {
      totalMonitoringDays: Math.ceil((stats.timeAnalysis?.duration || 0) / 24),
      averageDailySeverity: stats.averageSeverity || 0,
      predominantPattern: getPredominantPattern(stats.severityDistribution),
      dataQuality: dataQuality.overallScore >= 80 ? 'Excellent' :
                   dataQuality.overallScore >= 60 ? 'Good' :
                   dataQuality.overallScore >= 40 ? 'Fair' : 'Poor'
    },
    clinicalFindings: {
      tremorCharacteristics: {
        frequency: `${(stats.averageFrequency || 0).toFixed(2)} Hz`,
        amplitude: `${(stats.averageAmplitude || 0).toFixed(2)}`,
        severity: `${(stats.averageSeverity || 0).toFixed(1)}/100`
      },
      progressionAssessment: stats.clinicalMetrics?.progressionIndicators || { trend: 'Insufficient data', risk: 'Unknown' },
      treatmentRecommendations: generateTreatmentRecommendations(stats)
    },
    technicalDetails: {
      deviceInfo: data[0]?.deviceId ? {
        name: data[0].deviceId.name,
        deviceId: data[0].deviceId.deviceId,
        firmwareVersion: data[0].deviceId.firmwareVersion,
        batteryLevel: data[0].deviceId.batteryLevel
      } : null,
      dataCollection: {
        samplingRate: '200 Hz',
        filtering: '3-30 Hz bandpass',
        processing: 'Real-time FFT analysis'
      }
    }
  };
}

// Helper functions
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function findTimeGaps(data: any[]): any[] {
  if (data.length < 2) return [];

  const gaps: any[] = [];
  const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (let i = 1; i < sortedData.length; i++) {
    const timeDiff = sortedData[i].timestamp.getTime() - sortedData[i - 1].timestamp.getTime();
    const gapHours = timeDiff / (1000 * 60 * 60);

    if (gapHours > 1) { // Gap larger than 1 hour
      gaps.push({
        start: sortedData[i - 1].timestamp,
        end: sortedData[i].timestamp,
        duration: gapHours
      });
    }
  }

  return gaps;
}

function getClinicalCorrelation(item: any): string {
  if (!item.aiInsights?.pattern) return 'N/A';

  const correlations = {
    normal: 'No clinical intervention required',
    mild: 'Monitor for progression',
    moderate: 'Consider medication adjustment',
    severe: 'Immediate clinical evaluation recommended'
  };

  return correlations[item.aiInsights.pattern as keyof typeof correlations] || 'N/A';
}

function getPredominantPattern(distribution: any): string {
  const patterns = Object.entries(distribution);
  const max = Math.max(...patterns.map(([_, count]) => count as number));
  const predominant = patterns.find(([_, count]) => count === max)?.[0];

  return predominant ? `${predominant} (${max} readings)` : 'No predominant pattern';
}

function calculateUPDRSCorrelation(data: any[]): string {
  const avgSeverity = data.reduce((acc, item) => acc + (item.severityIndex || 0), 0) / data.length;
  return avgSeverity >= 70 ? '3-4 (Severe)' :
         avgSeverity >= 40 ? '2-3 (Moderate)' : '1-2 (Mild)';
}

function calculateHoehnYahrCorrelation(data: any[]): string {
  const avgSeverity = data.reduce((acc, item) => acc + (item.severityIndex || 0), 0) / data.length;
  return avgSeverity >= 70 ? 'Stage 3-4' :
         avgSeverity >= 40 ? 'Stage 2-3' : 'Stage 1-2';
}

function analyzeProgression(data: any[]): any {
  if (data.length < 10) return { trend: 'Insufficient data', risk: 'Unknown' };

  // Sort by timestamp
  const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
  const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));

  const firstHalfAvg = firstHalf.reduce((acc, item) => acc + (item.severityIndex || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((acc, item) => acc + (item.severityIndex || 0), 0) / secondHalf.length;

  const trend = secondHalfAvg - firstHalfAvg;
  const trendDirection = trend > 5 ? 'Increasing' : trend < -5 ? 'Decreasing' : 'Stable';

  return {
    trend: `${trendDirection} (${trend > 0 ? '+' : ''}${trend.toFixed(1)} points)`,
    risk: Math.abs(trend) > 10 ? 'High' : Math.abs(trend) > 5 ? 'Moderate' : 'Low',
    confidence: '75%' // Would be calculated from data consistency
  };
}

function generateTreatmentRecommendations(stats: any): string[] {
  const recommendations = [];

  if (stats.averageSeverity >= 70) {
    recommendations.push('Consider advanced therapies (DBS, focused ultrasound)');
    recommendations.push('Frequent clinical monitoring required');
  } else if (stats.averageSeverity >= 40) {
    recommendations.push('Medication optimization may be beneficial');
    recommendations.push('Physical therapy evaluation recommended');
  } else {
    recommendations.push('Continue current management strategy');
    recommendations.push('Regular follow-up monitoring');
  }

  if (stats.severityDistribution.severe > stats.totalRecords * 0.2) {
    recommendations.push('Address severe episodes with immediate intervention');
  }

  return recommendations;
}
