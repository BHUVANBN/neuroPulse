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
    const deviceId = searchParams.get('deviceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Build query
    const query: any = {
      deviceId,
      userId: session.user.id,
    };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const tremorData = await TremorData.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('deviceId', 'name deviceId');

    // Generate PDF content
    const htmlContent = generatePDFHTML(tremorData, deviceId);

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="tremor-report-${new Date().toISOString().split('T')[0]}.html"`,
      },
    });

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generatePDFHTML(data: any[], deviceId: string) {
  const reportDate = new Date().toLocaleDateString();
  const totalRecords = data.length;
  const avgSeverity = data.length > 0
    ? Math.round(data.reduce((acc, item) => acc + item.severityIndex, 0) / data.length)
    : 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>NeuroPulse Tremor Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
            .summary { background: #f8f9fa; padding: 20px; margin-bottom: 30px; border-radius: 8px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat { text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
            .stat-label { color: #666; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .severity-low { color: #10b981; }
            .severity-medium { color: #f59e0b; }
            .severity-high { color: #ef4444; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">NeuroPulse</div>
            <h1>Parkinson's Tremor Analysis Report</h1>
            <p>Generated on: ${reportDate}</p>
            <p>Device ID: ${deviceId}</p>
        </div>

        <div class="summary">
            <h2>Report Summary</h2>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${totalRecords}</div>
                    <div class="stat-label">Total Records</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${avgSeverity}</div>
                    <div class="stat-label">Average Severity</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${data.length > 0 ? new Date(data[0].timestamp).toLocaleDateString() : 'N/A'}</div>
                    <div class="stat-label">Latest Reading</div>
                </div>
            </div>
        </div>

        <h2>Detailed Data</h2>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Frequency (Hz)</th>
                    <th>Amplitude</th>
                    <th>Severity</th>
                    <th>Pattern</th>
                    <th>Confidence</th>
                    <th>Recommendations</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr>
                        <td>${new Date(item.timestamp).toLocaleString()}</td>
                        <td>${item.frequency.toFixed(2)}</td>
                        <td>${item.amplitude.toFixed(2)}</td>
                        <td class="${getSeverityClass(item.severityIndex)}">${item.severityIndex}</td>
                        <td>${item.aiInsights?.pattern || 'N/A'}</td>
                        <td>${item.aiInsights?.confidence ? Math.round(item.aiInsights.confidence * 100) + '%' : 'N/A'}</td>
                        <td>${item.aiInsights?.recommendations?.join(', ') || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>Report generated by NeuroPulse - AI-Driven Parkinson's Tremor Detector</p>
            <p>This report contains ${totalRecords} tremor measurements for analysis by healthcare professionals.</p>
        </div>
    </body>
    </html>
  `;
}

function getSeverityClass(severity: number): string {
  if (severity < 30) return 'severity-low';
  if (severity < 60) return 'severity-medium';
  return 'severity-high';
}
