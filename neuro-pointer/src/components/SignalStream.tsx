"use client";

import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNeuroCursorStore } from "@/store/useNeuroCursorStore";
import type { EogSample } from "@/lib/types/neurocursor";

const COLORS = ["#818cf8", "#34d399", "#f472b6", "#facc15"];

type StreamDatum = {
  timestamp: number;
  [key: `ch${number}`]: number;
};

export function SignalStream() {
  const eogStream = useNeuroCursorStore((state) => state.eogStream);

  const data = useMemo<StreamDatum[]>(() => {
    const latest = eogStream.slice(-180);
    return latest.map((sample: EogSample) => {
      const datum: StreamDatum = { timestamp: sample.timestamp };
      sample.channels.forEach((value, index) => {
        datum[`ch${index}`] = value;
      });
      return datum;
    });
  }, [eogStream]);

  return (
    <div className="glass flex h-full flex-col gap-4 rounded-3xl border border-border/60 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-primary/70">EOG Stream</p>
          <h3 className="text-lg font-semibold text-primary">Live biosignal telemetry</h3>
        </div>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary/90">
          256-sample window
        </span>
      </header>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, bottom: 0, left: -18, right: 16 }}>
            <XAxis dataKey="timestamp" hide />
            <YAxis domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} axisLine={false} tickLine={false} stroke="#475569" />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                borderRadius: 16,
                border: "1px solid rgba(120,133,156,0.35)",
                color: "#e2e8f0",
                fontSize: 12,
              }}
            />
            {Array.from({ length: 4 }).map((_, index) => (
              <Line
                key={`ch${index}`}
                type="monotone"
                dataKey={`ch${index}`}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <footer className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
        <span className="rounded-2xl border border-border/50 bg-surface/60 p-4">
          <strong className="block text-sm font-semibold text-primary">Normalization</strong>
          Signals rescaled to ±2 V range for stable fusion input.
        </span>
        <span className="rounded-2xl border border-border/50 bg-surface/60 p-4">
          <strong className="block text-sm font-semibold text-primary">Latency</strong>
          Stream buffers trimmed to &lt; 600 samples (≈5 seconds).
        </span>
      </footer>
    </div>
  );
}
