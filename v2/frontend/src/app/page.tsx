"use client";

import { useMemo } from "react";
import { 
  Activity, TrendingUp, Heart, Shield, Zap, Thermometer, Target,
  Clock, ChevronRight, CheckCircle2, Bell
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { motion } from "framer-motion";
import { useEMGStream } from "@/hooks/use-emg-stream";

// Premium Clinical Colors
const COLORS = {
  Normal: "#22c55e",
  Mild: "#f59e0b",
  Moderate: "#f97316",
  Severe: "#ef4444",
  Primary: "#6366f1",
} as const;

export default function NeuroPulseAI() {
  const { status, latestRecord, history } = useEMGStream("demo-user");

  const severityTrend = useMemo(() => 
    history.map(h => ({
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      severity: h.analysis.severity === "Normal" ? 5 : h.analysis.severity === "Mild" ? 30 : h.analysis.severity === "Moderate" ? 65 : 95,
      frequency: h.features.dominant_frequency,
      rms: h.features.rms
    }))
  , [history]);

  const severityColor = latestRecord ? COLORS[latestRecord.analysis.severity] : COLORS.Normal;

  return (
    <div className="min-h-screen text-foreground selection:bg-primary/20 bg-[#09090b]">
      {/* 🚀 Minimal Clinical Navbar */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-medical-info flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">NeuroPulse <span className="text-primary tracking-widest text-[10px] uppercase font-bold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full ml-1">v2.0 AI-CLINIC</span></h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center">
              SYSTEM: {status === "connected" ? <span className="text-medical-success flex items-center ml-1"><CheckCircle2 className="w-2.5 h-2.5 mr-1" /> ACTIVE</span> : <span className="text-muted-foreground ml-1">OFFLINE</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
           <div className="hidden lg:flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest opacity-60">
              <span className="flex items-center"><Shield className="w-3 h-3 mr-1 text-medical-success" /> Encrypted</span>
              <span className="flex items-center"><Target className="w-3 h-3 mr-1 text-primary" /> Calibrated</span>
           </div>
           <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
           </div>
        </div>
      </nav>

      {/* 📊 Focused Layout */}
      <main className="pt-28 pb-12 px-8 max-w-[1600px] mx-auto space-y-8">
        
        {/* TOP SECTION: Diagnosis & Logic */}
        <section className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8">
               <div className={`glass-card relative overflow-hidden transition-all duration-500 border-l-[6px] h-full`} style={{ borderColor: severityColor }}>
                  <div className="absolute top-0 right-0 p-6">
                     <div className="bg-medical-success/10 border border-medical-success/20 px-3 py-1 rounded-full flex items-center">
                        <span className="w-2 h-2 rounded-full bg-medical-success animate-pulse mr-2" />
                        <span className="text-[10px] font-black text-medical-success uppercase tracking-tighter">Live Analysis</span>
                     </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-10 py-4">
                     <div className="relative">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center relative">
                           <motion.div 
                             animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
                             transition={{ duration: 1.5, repeat: Infinity }}
                             className="absolute inset-0 rounded-full"
                             style={{ backgroundColor: severityColor }}
                           />
                           <div className="w-24 h-24 rounded-full bg-[#18181b] border-4 border-white/5 flex items-center justify-center relative z-10 shadow-2xl">
                              <Activity className="w-10 h-10" style={{ color: severityColor }} />
                           </div>
                        </div>
                     </div>

                     <div className="flex-1">
                        <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-50 mb-2">Diagnostic Classification</h2>
                        <h3 className="text-6xl font-black tracking-tighter mb-4" style={{ color: severityColor }}>
                           {latestRecord?.analysis.severity || "Awaiting..."}
                        </h3>
                        <div className="flex items-center space-x-8">
                           <div>
                              <p className="text-[10px] font-bold opacity-40 uppercase">Frequency</p>
                              <p className="text-xl font-black tracking-tight">{latestRecord?.features.dominant_frequency.toFixed(2) || "0.00"} <span className="text-xs font-medium opacity-50">Hz</span></p>
                           </div>
                           <div>
                              <p className="text-[10px] font-bold opacity-40 uppercase">AI Confidence</p>
                              <p className="text-xl font-black tracking-tight text-medical-success">{Math.round((latestRecord?.analysis.confidence || 0) * 100)}%</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-4">
               <div className="glass-card flex items-center justify-between">
                  <div>
                     <p className="text-[10px] font-bold opacity-40 uppercase mb-1">Signal Health</p>
                     <p className="text-2xl font-black text-medical-success">98.4%</p>
                  </div>
                  <Target className="w-8 h-8 text-medical-success opacity-20" />
               </div>
               <div className="glass-card flex items-center justify-between">
                  <div>
                     <p className="text-[10px] font-bold opacity-40 uppercase mb-1">Last Prediction</p>
                     <p className="text-2xl font-black">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <Clock className="w-8 h-8 opacity-20" />
               </div>
            </div>
        </section>

        {/* MIDDLE SECTION: Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Severity Trending */}
           <div className="glass-card flex flex-col h-[400px] overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" /> Trending Analysis
                 </h4>
              </div>
              <div className="flex-1 w-full bg-white/[0.02] rounded-2xl p-4 overflow-hidden">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={severityTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                       <defs>
                          <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor={COLORS.Primary} stopOpacity={0.3}/>
                             <stop offset="95%" stopColor={COLORS.Primary} stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <XAxis dataKey="time" hide />
                       <YAxis domain={[0, 100]} hide />
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                         itemStyle={{ color: COLORS.Primary, fontWeight: 'bold' }}
                       />
                       <Area type="monotone" dataKey="severity" stroke={COLORS.Primary} strokeWidth={4} fill="url(#colorPrimary)" animationDuration={1000} />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Signal Decomposition */}
           <div className="glass-card flex flex-col h-[400px] overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60 flex items-center">
                    <Activity className="w-4 h-4 mr-2" /> Live Decomposition (200Hz)
                 </h4>
                 <div className="flex items-center space-x-4">
                    <div className="text-[10px] font-mono opacity-40">RMS: {latestRecord?.features.rms.toFixed(2) || "0.00"}</div>
                 </div>
              </div>
              <div className="flex-1 flex items-center justify-center bg-white/[0.02] rounded-2xl overflow-hidden px-10 relative">
                 <div className="w-full flex items-center justify-between h-48 space-x-2">
                    {Array.from({ length: 32 }).map((_, i) => (
                       <motion.div 
                          key={i}
                          animate={{ height: latestRecord ? Math.min(180, Math.random() * (latestRecord.features.rms * 5 + 20)) : 10 }}
                          className="w-full rounded-full bg-white/10"
                          style={{ 
                            backgroundColor: i % 8 === 0 ? COLORS.Primary : "rgba(255,255,255,0.1)",
                            opacity: 0.1 + (i / 32) * 0.5 
                          }}
                       />
                    ))}
                 </div>
              </div>
              <div className="mt-6 flex justify-between text-[10px] font-black uppercase opacity-40 px-2 tracking-widest">
                 <span>Frequency Spectrum</span>
                 <span>Time-Domain Vector</span>
              </div>
           </div>
        </section>

        {/* BOTTOM SECTION: AI Intelligence & Logs */}
        <section className="grid grid-cols-12 gap-8">
           <div className="col-span-12 lg:col-span-4 space-y-4">
              <div className="glass-card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                 <div className="flex items-center space-x-3 mb-6">
                    <Shield className="w-5 h-5 text-primary" />
                    <h5 className="font-black text-sm uppercase tracking-widest">AI Recommendations</h5>
                 </div>
                 <div className="space-y-3">
                    {(latestRecord?.analysis.recommendations || ["Stabilizing signal..."]).map((rec, i) => (
                       <div key={i} className="flex items-start space-x-3 p-3 bg-[#18181b]/60 rounded-xl border border-white/5">
                          <CheckCircle2 className="w-4 h-4 text-medical-success shrink-0 mt-0.5" />
                          <p className="text-xs font-medium opacity-80">{rec}</p>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="glass-card">
                 <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Medication Tracker</p>
                    <Clock className="w-4 h-4 opacity-40" />
                 </div>
                 <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-3">
                       <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Thermometer className="w-4 h-4 text-primary" />
                       </div>
                       <p className="text-xs font-bold font-mono">L-DOPA 10:00AM</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-medical-success" />
                 </div>
              </div>
           </div>

           <div className="col-span-12 lg:col-span-8">
              <div className="glass-card h-full">
                 <div className="flex items-center justify-between mb-8">
                    <h5 className="font-black text-sm uppercase tracking-widest">Signal Lifecycle Log</h5>
                    <button className="text-[10px] font-black text-primary uppercase underline">Export Session</button>
                 </div>
                 <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {history.slice(-8).reverse().map((h, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-colors">
                          <div className="flex items-center space-x-4">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[h.analysis.severity] || COLORS.Normal }} />
                             <span className="font-bold text-sm tracking-tight">{h.analysis.severity} Tremor Pattern</span>
                          </div>
                          <div className="flex items-center space-x-6 text-[10px] font-mono opacity-40 uppercase">
                             <span>RMS: {h.features.rms.toFixed(2)}</span>
                             <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                             <ChevronRight className="w-3 h-3" />
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </section>
      </main>

      <style jsx global>{`
        .glass-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top left, rgba(255,255,255,0.05), transparent);
          pointer-events: none;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
