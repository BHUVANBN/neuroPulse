'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, Battery, Wifi, Download, FileText, Clock, Heart, Target, User, Upload } from 'lucide-react';
import { useSocket } from '@/components/SocketProvider';

interface TremorData {
  _id: string;
  timestamp: string;
  frequency: number;
  amplitude: number;
  severityIndex: number;
  classification?: string;
  confidence?: number;
  batteryLevel?: number;
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

const SEVERITY_COLORS = {
  normal: '#10b981',
  mild: '#f59e0b',
  moderate: '#f97316',
  severe: '#ef4444'
};

export default function PatientDashboard() {
  const [tremorData, setTremorData] = useState<TremorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket, isConnected: socketConnected } = useSocket();

  // Load initial data
  useEffect(() => {
    fetchTremorData();

    if (realTimeEnabled) {
      const interval = setInterval(fetchTremorData, 15000); // Less frequent polling when WebSocket is active
      return () => clearInterval(interval);
    }
  }, [realTimeEnabled]);

  // WebSocket real-time updates
  useEffect(() => {
    if (socket && realTimeEnabled) {
      socket.on('tremor-update', (data: TremorData) => {
        console.log('Received real-time update:', data);

        // Add new data point
        const newDataPoint: TremorData = {
          _id: data._id || Date.now().toString(),
          timestamp: data.timestamp || new Date().toISOString(),
          frequency: data.frequency || 0,
          amplitude: data.amplitude || 0,
          severityIndex: data.severityIndex || 0,
          classification: data.classification,
          confidence: data.confidence,
          batteryLevel: data.batteryLevel,
          aiInsights: data.aiInsights,
          deviceId: data.deviceId ? {
            name: data.deviceId.name || 'ESP32',
            deviceId: data.deviceId.deviceId || 'ESP32_CLASSIFIER',
            batteryLevel: data.batteryLevel
          } : undefined
        };

        setTremorData(prev => {
          const updated = [...prev, newDataPoint];
          // Keep only last 100 points for performance
          return updated.slice(-100);
        });

        setLastUpdate(new Date());
      });

      return () => {
        socket.off('tremor-update');
      };
    }
  }, [socket, realTimeEnabled]);

  // Update connection status
  useEffect(() => {
    setIsConnected(socketConnected);
  }, [socketConnected]);

  const fetchTremorData = async () => {
    try {
      const response = await fetch('/api/tremor?deviceId=ESP32_MEDICAL_001&limit=100');

      if (response.ok) {
        const data = await response.json();
        const transformedData = (data.data || []).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp).toISOString(),
          frequency: Number(item.frequency),
          amplitude: Number(item.amplitude),
          severityIndex: Number(item.severityIndex)
        }));

        setTremorData(transformedData);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching tremor data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/tremor/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('EMG file uploaded successfully!');
        setSelectedFile(null);
        fetchTremorData();
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    }
  };

  const currentTremor = tremorData[tremorData.length - 1];
  const avgSeverity = tremorData.length > 0
    ? tremorData.reduce((acc, data) => acc + data.severityIndex, 0) / tremorData.length
    : 0;

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-h-screen bg-surface">
      {/* Header */}
      <div className="glass gradient-border p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <User className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-text">My Tremor Monitor</h2>
              <p className="text-sm text-muted-foreground">Personal Parkinson's Disease Tracking</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${realTimeEnabled ? (isConnected ? 'bg-success animate-pulse' : 'bg-warning') : 'bg-muted'}`}></div>
              <span className="text-xs text-muted-foreground">
                {realTimeEnabled ? (isConnected ? 'Live' : 'Connecting...') : 'Paused'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full lg:w-auto">
            <button
              onClick={() => setRealTimeEnabled(!realTimeEnabled)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                realTimeEnabled ? 'bg-success text-surface' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Activity className={`w-4 h-4 ${realTimeEnabled ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{realTimeEnabled ? 'Live Monitoring' : 'Paused'}</span>
            </button>

            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".csv,.txt"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 px-3 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors text-surface"
              >
                <Upload className="w-4 h-4" />
                <span>Upload EMG Data</span>
              </button>
              {selectedFile && (
                <button
                  onClick={handleFileUpload}
                  className="px-3 py-2 bg-success hover:bg-success/90 rounded-lg text-sm font-medium text-surface"
                >
                  Process File
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Current Severity */}
        <div className={`glass p-4 border ${getSeverityColor(currentTremor?.severityIndex || 0)}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Current Severity</p>
              <p className="text-2xl font-bold text-text">{currentTremor?.severityIndex?.toFixed(1) || '0.0'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <Heart className="w-8 h-8 text-danger" />
          </div>
          <div className="mt-3">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getSeverityBgColor(currentTremor?.severityIndex || 0)} transition-all duration-300`}
                style={{ width: `${currentTremor?.severityIndex || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Today's Average */}
        <div className="glass p-4 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Today's Average</p>
              <p className="text-2xl font-bold text-text">{avgSeverity.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tremorData.length} readings
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-success" />
          </div>
        </div>

        {/* Dominant Frequency */}
        <div className="glass p-4 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Dominant Frequency</p>
              <p className="text-2xl font-bold text-text">{currentTremor?.frequency?.toFixed(1) || '0.0'}</p>
              <p className="text-xs text-muted-foreground mt-1">Hz</p>
            </div>
            <Target className="w-8 h-8 text-warning" />
          </div>
        </div>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Severity Trend */}
        <div className="glass p-4 sm:p-6 border border-border">
          <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-primary" />
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
        <div className="glass p-4 sm:p-6 border border-border">
          <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary" />
            <span>Frequency & Amplitude</span>
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

      {/* Personal Insights */}
      {currentTremor?.aiInsights && (
        <div className="glass p-4 sm:p-6 border border-border">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="text-lg font-semibold text-text">Personal Insights</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(currentTremor.severityIndex)}`}>
              {Math.round(currentTremor.aiInsights.confidence * 100)}% Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-muted-foreground text-sm mb-2">Current Status</p>
                <span className={`px-3 py-2 rounded-full text-sm font-medium capitalize ${getSeverityColor(currentTremor.severityIndex)}`}>
                  {currentTremor.aiInsights.pattern} tremor pattern
                </span>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-2">Your Metrics</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Frequency: {currentTremor.frequency.toFixed(2)} Hz</p>
                  <p>• Amplitude: {currentTremor.amplitude.toFixed(2)}</p>
                  <p>• Severity Score: {currentTremor.severityIndex.toFixed(1)}/100</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-muted-foreground text-sm mb-2">Daily Recommendations</p>
                <ul className="space-y-2">
                  {currentTremor.aiInsights.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Summary */}
      <div className="glass p-4 sm:p-6 border border-border">
        <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-primary" />
          <span>Today's Summary</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-text">{tremorData.length}</p>
            <p className="text-sm text-muted-foreground">Total Readings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-text">{avgSeverity.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">Average Severity</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-text">{currentTremor?.frequency?.toFixed(1) || '0.0'}</p>
            <p className="text-sm text-muted-foreground">Avg Frequency (Hz)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
