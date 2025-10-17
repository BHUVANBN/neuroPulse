"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CircleCheck, Download, Eye, Keyboard, Lightbulb, Radio, Waves } from "lucide-react";
import { useNeuroCursorStore } from "@/store/useNeuroCursorStore";
import { useEogWebSocket } from "@/lib/hooks/useEogWebSocket";
import { useGazeTracking } from "@/lib/hooks/useGazeTracking";
import { useCalibrationEngine } from "@/lib/hooks/useCalibrationEngine";
import { TrainingCanvas } from "@/components/TrainingCanvas";
import { SignalStream } from "@/components/SignalStream";
import { Toolbar } from "@/components/Toolbar";
import { INTENT_LABELS } from "@/lib/types/neurocursor";

const WS_URL = "ws://localhost:8080/eog";

export default function NeuroCursorPage() {
  const [autostartStreams, setAutostartStreams] = useState(false);
  const {
    controlMode,
    streamStatus,
    gazeStatus,
    fusionModelStatus,
    calibrationStage,
    keyboardVisible,
    currentSuggestions,
    composedText,
    setKeyboardVisible,
    updateSuggestions,
    clearText,
  } = useNeuroCursorStore();

  const calibrationEnabled = controlMode === "calibration" && autostartStreams;

  useEogWebSocket({ url: WS_URL, enabled: autostartStreams });
  useGazeTracking({ enabled: autostartStreams });
  const { activeLabel, countdown, cycleIndex, cyclesRemaining } = useCalibrationEngine(calibrationEnabled);

  useEffect(() => {
    if (!keyboardVisible) return;
    updateSuggestions(["hello", "assistive", "interface"]);
  }, [keyboardVisible, updateSuggestions]);

  const statusItems = useMemo(
    () => [
      {
        label: "EOG Stream",
        value: streamStatus,
        icon: Waves,
      },
      {
        label: "Gaze Tracking",
        value: gazeStatus,
        icon: Eye,
      },
      {
        label: "Model",
        value: fusionModelStatus,
        icon: BrainCircuit,
      },
      {
        label: "Calibration",
        value: calibrationStage,
        icon: Radio,
      },
    ],
    [calibrationStage, fusionModelStatus, gazeStatus, streamStatus],
  );

  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 pb-24 pt-16">
      <header className="flex flex-col gap-4">
        <Link href="/" className="text-sm text-primary/70 hover:text-primary">← Back to overview</Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-primary/70">NeuroCursor Control Lab</p>
            <h1 className="text-3xl font-semibold text-primary">Real-time calibration and adaptive control workspace</h1>
          </div>
          <Toolbar
            onAction={(action) => {
              if (action === "start") setAutostartStreams(true);
              if (action === "pause") setAutostartStreams(false);
              if (action === "exit") {
                setAutostartStreams(false);
                clearText();
              }
            }}
            className="self-start"
          />
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-[1.2fr_0.8fr]">
        <TrainingCanvas stage={calibrationStage} activeLabel={activeLabel} countdown={countdown} cycleIndex={cycleIndex} />
        <div className="flex flex-col gap-6">
          <SignalStream />
          <div className="glass flex flex-col gap-4 rounded-3xl border border-border/60 p-6">
            <header className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h2 className="text-lg font-semibold text-primary">Calibration Progress</h2>
            </header>
            <p className="text-sm text-muted-foreground">
              Capture at least 3 labelled samples per intent. Remaining cycles: {cyclesRemaining}
            </p>
            <div className="flex flex-wrap gap-2">
              {INTENT_LABELS.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-border/40 px-3 py-1 text-xs text-muted-foreground"
                >
                  <CircleCheck className="size-3 text-primary/70" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statusItems.map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass flex flex-col gap-3 rounded-3xl border border-border/60 p-6">
            <div className="flex items-center gap-3">
              <Icon className="size-4 text-primary/80" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">{label}</p>
            </div>
            <p className="text-lg font-semibold capitalize text-primary">{value}</p>
          </div>
        ))}
      </section>

      {keyboardVisible && (
        <section className="glass flex flex-col gap-4 rounded-3xl border border-border/60 p-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Keyboard className="size-4 text-primary" />
              On-screen keyboard prototype
            </div>
            <button
              type="button"
              onClick={() => setKeyboardVisible(false)}
              className="rounded-full border border-border/50 px-3 py-1 text-xs text-primary"
            >
              Close
            </button>
          </header>
          <div className="rounded-2xl border border-border/40 bg-surface/70 p-4 text-primary">{composedText || "Start typing..."}</div>
          <div className="flex flex-wrap gap-2">
            {currentSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => updateSuggestions([suggestion])}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Download className="size-3" />
          Session data persists locally in IndexedDB. Export tools coming soon.
        </div>
        <span>WebSocket endpoint: {WS_URL}</span>
      </footer>
    </div>
  );
}
