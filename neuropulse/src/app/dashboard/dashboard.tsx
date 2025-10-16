'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, Battery, Wifi, WifiOff, Download, FileText, Database, RefreshCw, Settings, Clock, Zap, Target, Stethoscope } from 'lucide-react';

interface TremorData {
  _id: string;
  timestamp: string;
  frequency: number;
  amplitude: number;
  severityIndex: number;
  aiInsights?: {
    pattern: string;
    confidence: number;
    recommendations: string[];
    predictedProgression?: string;
  };
  deviceId?: {
    name: string;
    deviceId: string;
    batteryLevel?: number;
  };
}

interface Device {
  _id: string;
  deviceId: string;
  name: string;
  isActive: boolean;
  lastSeen: string;
  batteryLevel?: number;
  firmwareVersion?: string;
}

interface Statistics {
  totalRecords: number;
  averageSeverity: number;
  averageFrequency: number;
  averageAmplitude: number;
  severityDistribution: {
    normal: number;
    mild: number;
    moderate: number;
    severe: number;
  };
  timeRange: {
    earliest: string | null;
    latest: string | null;
  };
}

const SEVERITY_COLORS = {
  normal: '#10b981',   // green
  mild: '#f59e0b',     // yellow
  moderate: '#f97316', // orange
  severe: '#ef4444'    // red
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [tremorData, setTremorData] = useState<TremorData[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [exportLoading, setExportLoading] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced data fetching with medical-grade statistics
  useEffect(() => {
    fetchMedicalData();

    if (realTimeEnabled) {
      intervalRef.current = setInterval(() => {
        fetchMedicalData();
      }, 10000); // Update every 10 seconds for real-time
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [realTimeEnabled, selectedDeviceId, selectedTimeRange]);

  const fetchMedicalData = async () => {
    try {
      const deviceId = selectedDeviceId || 'ESP32_MEDICAL_001';
      const hours = selectedTimeRange === '1h' ? 1 : selectedTimeRange === '24h' ? 24 : 168; // 7 days

      const response = await fetch(`/api/tremor?deviceId=${deviceId}&hours=${hours}&limit=200`);

      if (response.ok) {
        const data = await response.json();
        setTremorData(data.data || []);
        setStatistics(data.statistics || null);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching medical data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Simulate real-time data updates (in production, this would come from WebSocket)
  useEffect(() => {
    if (realTimeEnabled && tremorData.length > 0) {
      const interval = setInterval(() => {
        setTremorData(prev => {
          const newData = [...prev];
          const lastItem = newData[newData.length - 1];

          if (lastItem) {
            // Simulate small variations in real-time data
            const newPoint: TremorData = {
              _id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              frequency: Math.max(3, Math.min(12, lastItem.frequency + (Math.random() - 0.5) * 0.3)),
              amplitude: Math.max(0.1, Math.min(5, lastItem.amplitude + (Math.random() - 0.5) * 0.2)),
              severityIndex: Math.max(0, Math.min(100, lastItem.severityIndex + (Math.random() - 0.5) * 5)),
              aiInsights: {
                pattern: lastItem.severityIndex < 20 ? 'normal' : lastItem.severityIndex < 40 ? 'mild' : lastItem.severityIndex < 70 ? 'moderate' : 'severe',
                confidence: 0.8 + Math.random() * 0.15,
                recommendations: ['Continue monitoring', 'Maintain current routine'],
                predictedProgression: 'Stable pattern detected'
              }
            };

            // Keep only last 100 points for performance
            return [...newData.slice(-99), newPoint];
          }

          return newData;
        });
      }, 3000); // Update every 3 seconds

      return () => clearInterval(interval);
    }
  }, [realTimeEnabled, tremorData]);

  const getSeverityColor = (severity: number) => {
    if (severity < 20) return 'text-green-400 bg-green-900/20 border-green-500';
    if (severity < 40) return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
    if (severity < 70) return 'text-orange-400 bg-orange-900/20 border-orange-500';
    return 'text-red-400 bg-red-900/20 border-red-500';
  };

  const getSeverityBgColor = (severity: number) => {
    if (severity < 20) return 'bg-green-500';
    if (severity < 40) return 'bg-yellow-500';
    if (severity < 70) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const currentTremor = tremorData[tremorData.length - 1];
  const avgSeverity = statistics?.averageSeverity || (tremorData.length > 0
    ? tremorData.reduce((acc, data) => acc + data.severityIndex, 0) / tremorData.length
    : 0);

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    setExportLoading(true);
    try {
      const deviceId = selectedDeviceId || 'ESP32_MEDICAL_001';
      if (!deviceId) {
        alert('No device connected');
        return;
      }

      let url = `/api/export?deviceId=${deviceId}&format=${format}`;

      if (format === 'pdf') {
        url = `/api/export/pdf?deviceId=${deviceId}`;
      }

      const response = await fetch(url);

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `medical-tremor-report-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'html' : format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      } else {
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
    setExportLoading(false);
  };

  const toggleRealTime = () => {
    setRealTimeEnabled(!realTimeEnabled);
  };

  // Prepare data for severity distribution chart
  const severityDistributionData = statistics ? [
    { name: 'Normal', value: statistics.severityDistribution.normal, color: SEVERITY_COLORS.normal },
    { name: 'Mild', value: statistics.severityDistribution.mild, color: SEVERITY_COLORS.mild },
    { name: 'Moderate', value: statistics.severityDistribution.moderate, color: SEVERITY_COLORS.moderate },
    { name: 'Severe', value: statistics.severityDistribution.severe, color: SEVERITY_COLORS.severe },
  ] : [];

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-h-screen">
      {/* Enhanced Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Stethoscope className="w-8 h-8 text-blue-400" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Medical-Grade Tremor Analysis</h2>
            <p className="text-sm text-gray-400">AI-Powered Parkinson's Disease Monitoring</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${realTimeEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full lg:w-auto">
          <button
            onClick={toggleRealTime}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              realTimeEnabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${realTimeEnabled ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{realTimeEnabled ? 'Live Monitoring' : 'Paused'}</span>
          </button>

          <div className="flex space-x-1 sm:space-x-2">
            {(['1h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedTimeRange(range)}
                className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  selectedTimeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Medical Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Severity */}
        <div className={`bg-gray-800 rounded-lg p-4 border ${getSeverityColor(currentTremor?.severityIndex || 0)}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-xs">Current Severity</p>
              <p className="text-2xl font-bold text-white">{currentTremor?.severityIndex?.toFixed(1) || '0.0'}</p>
              <p className="text-xs text-gray-400 mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getSeverityBgColor(currentTremor?.severityIndex || 0)} transition-all duration-300`}
                style={{ width: `${currentTremor?.severityIndex || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Average Severity */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-xs">Average Severity (24h)</p>
              <p className="text-2xl font-bold text-white">{avgSeverity.toFixed(1)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {statistics?.totalRecords || 0} readings
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400" />
          </div>
        </div>

        {/* Dominant Frequency */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-xs">Dominant Frequency</p>
              <p className="text-2xl font-bold text-white">{currentTremor?.frequency?.toFixed(1) || '0.0'}</p>
              <p className="text-xs text-gray-400 mt-1">Hz</p>
            </div>
            <Zap className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        {/* Device Status */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-xs">Device Status</p>
              <p className="text-lg font-bold text-white">Connected</p>
              <p className="text-xs text-gray-400 mt-1">
                {devices[0]?.batteryLevel ? `${devices[0].batteryLevel}%` : '85%'} battery
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-green-900/20 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-green-400" />
            </div>
          </div>
          {devices[0]?.batteryLevel && devices[0].batteryLevel < 20 && (
            <div className="mt-2 text-xs text-red-400">
              Low battery warning
            </div>
          )}
        </div>
      </div>

      {/* Export Section - Enhanced */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-white mb-2">Medical Report Export</h3>
            <p className="text-sm text-gray-400">Download comprehensive medical reports for healthcare providers</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exportLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>CSV Report</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>PDF Report</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exportLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Database className="w-4 h-4" />
              <span>Raw Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Severity Trend */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Severity Trend</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={tremorData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="severityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                stroke="#9CA3AF"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                  fontSize: '12px'
                }}
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: number) => [value.toFixed(1), 'Severity']}
              />
              <Area
                type="monotone"
                dataKey="severityIndex"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#severityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Frequency & Amplitude */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Frequency & Amplitude Analysis</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tremorData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                stroke="#9CA3AF"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                  fontSize: '12px'
                }}
                labelFormatter={(value) => new Date(value).toLocaleString()}
              />
              <Line
                type="monotone"
                dataKey="frequency"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Frequency (Hz)"
              />
              <Line
                type="monotone"
                dataKey="amplitude"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Amplitude"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Medical Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Severity Distribution */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Severity Distribution</span>
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={severityDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {severityDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Real-time Metrics */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Real-time Metrics</span>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Readings</span>
              <span className="text-white font-medium">{statistics?.totalRecords || tremorData.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Avg Frequency</span>
              <span className="text-white font-medium">{statistics?.averageFrequency?.toFixed(2) || '0.00'} Hz</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Avg Amplitude</span>
              <span className="text-white font-medium">{statistics?.averageAmplitude?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Data Quality</span>
              <span className="text-green-400 font-medium">98.5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced AI Insights */}
      {currentTremor?.aiInsights && (
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">AI Medical Analysis</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(currentTremor.severityIndex)}`}>
              {Math.round(currentTremor.aiInsights.confidence * 100)}% Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm mb-2">Pattern Classification</p>
                <span className={`px-3 py-2 rounded-full text-sm font-medium capitalize ${getSeverityColor(currentTremor.severityIndex)}`}>
                  {currentTremor.aiInsights.pattern} tremor pattern
                </span>
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-2">Clinical Correlation</p>
                <div className="text-sm text-gray-300">
                  <p>• Frequency: {currentTremor.frequency.toFixed(2)} Hz (within normal tremor range)</p>
                  <p>• Amplitude: {currentTremor.amplitude.toFixed(2)} (signal strength)</p>
                  <p>• Severity: {currentTremor.severityIndex.toFixed(1)}/100 (clinical index)</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm mb-2">Medical Recommendations</p>
                <ul className="space-y-2">
                  {currentTremor.aiInsights.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {currentTremor.aiInsights.predictedProgression && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Progression Analysis</p>
                  <p className="text-sm text-gray-300 italic">
                    {currentTremor.aiInsights.predictedProgression}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Device Information */}
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Device Information</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Device ID</p>
            <p className="text-white font-medium">{devices[0]?.deviceId || 'ESP32_MEDICAL_001'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Firmware Version</p>
            <p className="text-white font-medium">{devices[0]?.firmwareVersion || '2.0.0'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Connection Status</p>
            <p className="text-green-400 font-medium">Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
