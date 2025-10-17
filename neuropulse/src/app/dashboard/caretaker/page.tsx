'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, Users, Clock, MessageCircle, Bell, UserCheck, Calendar, TrendingDown } from 'lucide-react';
import { useSocket } from '@/components/SocketProvider';

interface PatientData {
  _id: string;
  name: string;
  lastSeen: string;
  currentSeverity: number;
  trend: 'improving' | 'stable' | 'worsening';
  deviceId: string;
  recentActivity: {
    timestamp: string;
    severity: number;
    frequency: number;
  }[];
}

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'critical';
  message: string;
  timestamp: string;
  patientId: string;
  patientName: string;
}

const TREND_COLORS = {
  improving: '#10b981',
  stable: '#f59e0b',
  worsening: '#ef4444'
};

export default function CaretakerDashboard() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [isConnected, setIsConnected] = useState(false);
  const { socket, isConnected: socketConnected } = useSocket();

  useEffect(() => {
    fetchPatientsData();

    // Fetch alerts
    fetchAlerts();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchPatientsData();
      fetchAlerts();
    }, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  useEffect(() => {
    setIsConnected(socketConnected);
  }, [socketConnected]);

  useEffect(() => {
    if (socket) {
      socket.on('tremor-update', (data: any) => {
        console.log('Caretaker received tremor update:', data);

        // Update patient data if this patient exists
        setPatients(prev => prev.map(patient => {
          if (patient.deviceId === data.deviceId) {
            const newActivity = [...patient.recentActivity, {
              timestamp: data.timestamp,
              severity: data.severityIndex,
              frequency: data.frequency
            }].slice(-20); // Keep last 20 readings

            return {
              ...patient,
              currentSeverity: data.severityIndex,
              lastSeen: data.timestamp,
              recentActivity: newActivity
            };
          }
          return patient;
        }));

        // Check if we need to create an alert for high severity
        if (data.severityIndex >= 70) {
          const newAlert: Alert = {
            id: Date.now().toString(),
            type: 'critical',
            message: `Patient ${data.deviceId} has critical tremor severity (${data.severityIndex})`,
            timestamp: data.timestamp,
            patientId: data.deviceId,
            patientName: `Patient ${data.deviceId}`
          };

          setAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep last 10 alerts
        }
      });

      return () => {
        socket.off('tremor-update');
      };
    }
  }, [socket]);

  const fetchPatientsData = async () => {
    try {
      // In a real app, this would fetch from your API
      // For now, we'll simulate patient data
      const mockPatients: PatientData[] = [
        {
          _id: '1',
          name: 'John Smith',
          lastSeen: new Date().toISOString(),
          currentSeverity: 25,
          trend: 'improving',
          deviceId: 'ESP32_001',
          recentActivity: Array.from({ length: 20 }, (_, i) => ({
            timestamp: new Date(Date.now() - i * 300000).toISOString(), // Every 5 minutes
            severity: 20 + Math.random() * 10,
            frequency: 4.5 + Math.random() * 1.5
          }))
        },
        {
          _id: '2',
          name: 'Sarah Johnson',
          lastSeen: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          currentSeverity: 65,
          trend: 'worsening',
          deviceId: 'ESP32_002',
          recentActivity: Array.from({ length: 20 }, (_, i) => ({
            timestamp: new Date(Date.now() - i * 300000).toISOString(),
            severity: 60 + Math.random() * 15,
            frequency: 6.0 + Math.random() * 2.0
          }))
        }
      ];

      setPatients(mockPatients);
    } catch (error) {
      console.error('Error fetching patients data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    // Simulate alerts
    const mockAlerts: Alert[] = [
      {
        id: '1',
        type: 'warning',
        message: 'Sarah Johnson\'s tremor severity increased by 15% in the last hour',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        patientId: '2',
        patientName: 'Sarah Johnson'
      },
      {
        id: '2',
        type: 'info',
        message: 'John Smith completed daily exercises successfully',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        patientId: '1',
        patientName: 'John Smith'
      }
    ];

    setAlerts(mockAlerts);
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-400 bg-green-900/20 border-green-500';
      case 'stable': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
      case 'worsening': return 'text-red-400 bg-red-900/20 border-red-500';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info': return <Bell className="w-4 h-4 text-blue-400" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-h-screen bg-surface">
      {/* Header */}
      <div className="glass gradient-border p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-text">Patient Monitoring</h2>
              <p className="text-sm text-muted-foreground">Track and manage your patients' tremor activity</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex space-x-1">
              {(['24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setSelectedTimeRange(range)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTimeRange === range
                      ? 'bg-primary text-surface'
                      : 'bg-muted text-muted-foreground hover:bg-panel/60'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map((patient) => (
          <div key={patient._id} className="glass p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-text font-medium">{patient.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Last seen: {new Date(patient.lastSeen).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(patient.trend)}`}>
                {patient.trend}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Current Severity</span>
                <span className="text-text font-medium">{patient.currentSeverity}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    patient.trend === 'improving' ? 'bg-success' :
                    patient.trend === 'worsening' ? 'bg-danger' : 'bg-warning'
                  }`}
                  style={{ width: `${patient.currentSeverity}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Patient Severity Trends */}
        <div className="glass p-4 sm:p-6 border border-border">
          <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span>Patient Severity Trends</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
              />
              {patients.map((patient, index) => (
                <Line
                  key={patient._id}
                  type="monotone"
                  dataKey="severity"
                  data={patient.recentActivity.slice(-10)}
                  stroke={TREND_COLORS[patient.trend]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={patient.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Summary */}
        <div className="glass p-4 sm:p-6 border border-border">
          <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary" />
            <span>Activity Summary</span>
          </h3>
          <div className="space-y-4">
            {patients.map((patient) => (
              <div key={patient._id} className="flex items-center justify-between p-3 bg-panel/60 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${patient.trend === 'improving' ? 'bg-success' : patient.trend === 'worsening' ? 'bg-danger' : 'bg-warning'}`}></div>
                  <div>
                    <p className="text-text font-medium">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{patient.recentActivity.length} readings today</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-text font-medium">{patient.currentSeverity}</p>
                  <p className="text-xs text-muted-foreground">severity</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts and Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Alerts */}
        <div className="glass p-4 sm:p-6 border border-border">
          <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
            <Bell className="w-5 h-5 text-primary" />
            <span>Recent Alerts</span>
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start space-x-3 p-3 bg-panel/60 rounded-lg">
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent alerts</p>
            )}
          </div>
        </div>

        {/* Communication Hub */}
        <div className="glass p-4 sm:p-6 border border-border">
          <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <span>Communication Hub</span>
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-panel/60 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Quick Actions</p>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-primary hover:bg-primary/90 rounded text-xs font-medium text-surface">
                  Send Reminder
                </button>
                <button className="px-3 py-1 bg-success hover:bg-success/90 rounded text-xs font-medium text-surface">
                  Check In
                </button>
                <button className="px-3 py-1 bg-warning hover:bg-warning/90 rounded text-xs font-medium text-surface">
                  Schedule Call
                </button>
              </div>
            </div>

            <div className="p-3 bg-panel/60 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Recent Messages</p>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  John: "Feeling better today, thanks for checking in" - 2 hours ago
                </div>
                <div className="text-xs text-muted-foreground">
                  Sarah: "Need help with medication reminder" - 4 hours ago
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Details Table */}
      <div className="glass p-4 sm:p-6 border border-border">
        <h3 className="text-lg font-semibold text-text mb-4 flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-primary" />
          <span>Patient Overview</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground">Patient</th>
                <th className="text-left py-3 text-muted-foreground">Status</th>
                <th className="text-left py-3 text-muted-foreground">Trend</th>
                <th className="text-left py-3 text-muted-foreground">Last Reading</th>
                <th className="text-left py-3 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient._id} className="border-b border-border/50">
                  <td className="py-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-text">{patient.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(patient.trend)}`}>
                      {patient.currentSeverity < 30 ? 'Good' : patient.currentSeverity < 60 ? 'Moderate' : 'High'}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(patient.trend)}`}>
                      {patient.trend}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(patient.lastSeen).toLocaleTimeString()}
                  </td>
                  <td className="py-3">
                    <button className="text-primary hover:text-primary/80 text-sm">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
