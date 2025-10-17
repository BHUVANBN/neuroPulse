'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, Stethoscope, Clock, TrendingDown, Calendar, FileText, Download, RefreshCw, Target, Zap } from 'lucide-react';

interface PatientData {
  _id: string;
  name: string;
  age: number;
  diagnosisDate: string;
  currentSeverity: number;
  trend: 'improving' | 'stable' | 'worsening';
  deviceId: string;
  history: {
    date: string;
    severity: number;
    frequency: number;
    notes?: string;
  }[];
  medications: string[];
  nextAppointment: string;
}

const TREND_COLORS = {
  improving: '#10b981',
  stable: '#f59e0b',
  worsening: '#ef4444'
};

export default function DoctorDashboard() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '1y'>('3m');

  useEffect(() => {
    fetchPatientsData();

    // Set up polling for real-time updates
    const interval = setInterval(fetchPatientsData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchPatientsData = async () => {
    try {
      // In a real app, this would fetch from your API
      // For now, we'll simulate patient data
      const mockPatients: PatientData[] = [
        {
          _id: '1',
          name: 'John Smith',
          age: 68,
          diagnosisDate: '2022-03-15',
          currentSeverity: 25,
          trend: 'improving',
          deviceId: 'ESP32_001',
          history: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            severity: 20 + Math.random() * 15,
            frequency: 4.0 + Math.random() * 2.0,
            notes: i === 0 ? 'Responding well to current medication' : undefined
          })),
          medications: ['Levodopa 100mg 3x daily', 'Entacapone 200mg with meals'],
          nextAppointment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          _id: '2',
          name: 'Sarah Johnson',
          age: 72,
          diagnosisDate: '2020-11-22',
          currentSeverity: 65,
          trend: 'worsening',
          deviceId: 'ESP32_002',
          history: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            severity: 55 + Math.random() * 20,
            frequency: 5.5 + Math.random() * 2.5,
            notes: i === 0 ? 'Increased tremor frequency observed' : undefined
          })),
          medications: ['Carbidopa/Levodopa 25/100mg 4x daily', 'Amantadine 100mg 2x daily'],
          nextAppointment: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      setPatients(mockPatients);

      // Set first patient as selected by default
      if (!selectedPatient && mockPatients.length > 0) {
        setSelectedPatient(mockPatients[0]);
      }
    } catch (error) {
      console.error('Error fetching patients data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-400 bg-green-900/20 border-green-500';
      case 'stable': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
      case 'worsening': return 'text-red-400 bg-red-900/20 border-red-500';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500';
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Stethoscope className="w-8 h-8 text-blue-400" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Medical Dashboard</h2>
            <p className="text-sm text-gray-400">Comprehensive patient monitoring and analysis</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex space-x-1">
            {(['1m', '3m', '6m', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
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

      {/* Patient Selection and Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Patient List */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Patients</h3>
          <div className="space-y-3">
            {patients.map((patient) => (
              <div
                key={patient._id}
                onClick={() => setSelectedPatient(patient)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedPatient?._id === patient._id
                    ? 'bg-blue-900/20 border border-blue-500'
                    : 'bg-gray-900/50 hover:bg-gray-900/70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">{patient.name}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(patient.trend)}`}>
                    {patient.trend}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  <p>Age: {patient.age} | Severity: {patient.currentSeverity}</p>
                  <p>Next appointment: {new Date(patient.nextAppointment).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patient Details */}
        {selectedPatient && (
          <>
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Patient Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Current Severity</p>
                  <p className="text-2xl font-bold text-white">{selectedPatient.currentSeverity}</p>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        selectedPatient.trend === 'improving' ? 'bg-green-500' :
                        selectedPatient.trend === 'worsening' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${selectedPatient.currentSeverity}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Age</p>
                    <p className="text-white font-medium">{selectedPatient.age}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Diagnosis</p>
                    <p className="text-white font-medium">
                      {new Date(selectedPatient.diagnosisDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-sm mb-2">Medications</p>
                  <div className="space-y-1">
                    {selectedPatient.medications.map((med, index) => (
                      <p key={index} className="text-sm text-gray-300">{med}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Trend Analysis</span>
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={selectedPatient.history.slice(-10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
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
                  />
                  <Area
                    type="monotone"
                    dataKey="severity"
                    stroke={TREND_COLORS[selectedPatient.trend]}
                    fill={`${TREND_COLORS[selectedPatient.trend]}20`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Detailed Analytics */}
      {selectedPatient && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          {/* Frequency Analysis */}
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Frequency Analysis</span>
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={selectedPatient.history.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
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
                />
                <Line
                  type="monotone"
                  dataKey="frequency"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Severity Distribution */}
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Severity Distribution</span>
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Normal (0-20)</span>
                <span className="text-green-400 font-medium">
                  {selectedPatient.history.filter(h => h.severity < 20).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Mild (20-40)</span>
                <span className="text-yellow-400 font-medium">
                  {selectedPatient.history.filter(h => h.severity >= 20 && h.severity < 40).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Moderate (40-70)</span>
                <span className="text-orange-400 font-medium">
                  {selectedPatient.history.filter(h => h.severity >= 40 && h.severity < 70).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Severe (70+)</span>
                <span className="text-red-400 font-medium">
                  {selectedPatient.history.filter(h => h.severity >= 70).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Recommendations */}
      {selectedPatient && (
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Clinical Recommendations</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm mb-2">Treatment Assessment</p>
                <div className="text-sm text-gray-300">
                  {selectedPatient.trend === 'improving' && (
                    <p>• Current medication regimen appears effective</p>
                  )}
                  {selectedPatient.trend === 'worsening' && (
                    <p>• Consider medication adjustment or additional therapy</p>
                  )}
                  {selectedPatient.trend === 'stable' && (
                    <p>• Maintain current treatment plan with regular monitoring</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-2">Next Steps</p>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li>• Schedule follow-up appointment</li>
                  <li>• Review medication compliance</li>
                  <li>• Assess need for physical therapy referral</li>
                  <li>• Monitor for side effects</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm mb-2">Prognosis</p>
                <p className="text-sm text-gray-300">
                  {selectedPatient.trend === 'improving' && (
                    'Patient showing positive response to treatment with gradual improvement in symptoms.'
                  )}
                  {selectedPatient.trend === 'worsening' && (
                    'Patient experiencing symptom progression. Consider comprehensive reassessment.'
                  )}
                  {selectedPatient.trend === 'stable' && (
                    'Patient maintaining stable condition. Continue current management strategy.'
                  )}
                </p>
              </div>

              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
                  Generate Report
                </button>
                <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium">
                  Schedule Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs">Total Patients</p>
              <p className="text-2xl font-bold text-white">{patients.length}</p>
            </div>
            <Stethoscope className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs">Improving</p>
              <p className="text-2xl font-bold text-green-400">
                {patients.filter(p => p.trend === 'improving').length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs">Stable</p>
              <p className="text-2xl font-bold text-yellow-400">
                {patients.filter(p => p.trend === 'stable').length}
              </p>
            </div>
            <Target className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs">Worsening</p>
              <p className="text-2xl font-bold text-red-400">
                {patients.filter(p => p.trend === 'worsening').length}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
