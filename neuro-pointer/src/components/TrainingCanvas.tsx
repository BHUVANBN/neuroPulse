"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/style";
import type { CalibrationStage } from "@/store/useNeuroCursorStore";
import type { IntentLabel } from "@/lib/types/neurocursor";
import { INTENT_LABELS } from "@/lib/types/neurocursor";

const labelHints: Record<IntentLabel, string> = {
  left: "Shift gaze fully to the left",
  right: "Shift gaze fully to the right",
  up: "Look upward with your eyes",
  down: "Look downward with your eyes",
  blink: "Perform a single deliberate blink",
  click: "Blink twice quickly to emulate a click",
};

const cueColors: Record<IntentLabel, string> = {
  left: "bg-sky-400/40",
  right: "bg-sky-400/40",
  up: "bg-emerald-400/40",
  down: "bg-emerald-400/40",
  blink: "bg-violet-400/40",
  click: "bg-violet-400/40",
};

const arrowMap: Record<IntentLabel, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
  blink: "●",
  click: "◎",
};

export type TrainingCanvasProps = {
  stage: CalibrationStage;
  activeLabel?: IntentLabel | null;
  countdown?: number;
  cycleIndex?: number;
};

const LABEL_SEQUENCE = [...INTENT_LABELS];

export function TrainingCanvas({ stage, activeLabel, countdown = 3, cycleIndex = 0 }: TrainingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const label = activeLabel ?? LABEL_SEQUENCE[cycleIndex % LABEL_SEQUENCE.length];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = 2;
      const spacing = 36;
      for (let x = spacing / 2; x < width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = spacing / 2; y < height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const hint = useMemo(() => labelHints[label], [label]);
  const directionIcon = useMemo(() => arrowMap[label], [label]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 rounded-3xl border border-border/60 bg-panel/70 p-8 text-center shadow-[0_25px_80px_rgba(2,8,23,0.45)]">
      <canvas ref={canvasRef} width={640} height={420} className="pointer-events-none absolute inset-0 size-full opacity-50" />

      <div className="relative z-10 flex flex-col items-center gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.4em] text-primary/70">Calibration</span>
        <h2 className="text-3xl font-semibold text-primary">Follow the cues to capture intent-aligned samples</h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Maintain a neutral head pose. At each cue, move your eyes or blink as instructed. We synchronize EOG windows and gaze
          vectors to label the fusion model.
        </p>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.7, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: -12 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className={cn(
              "flex h-28 w-28 items-center justify-center rounded-2xl border border-border/50 text-4xl font-bold text-primary",
              cueColors[label],
            )}
            aria-label={`Perform ${label} cue`}
          >
            {directionIcon}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${label}-${countdown}`}
            initial={{ opacity: 0.4, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.3 }}
            className="rounded-full border border-border/60 bg-surface/70 px-6 py-2 font-mono text-lg text-primary"
          >
            {stage === "collecting" ? `Capturing in ${countdown}s` : stage === "pre-roll" ? "Get ready" : stage.toUpperCase()}
          </motion.div>
        </AnimatePresence>

        <p className="max-w-lg text-sm text-muted-foreground">{hint}</p>
      </div>

      <div className="relative z-10 grid w-full grid-cols-1 gap-4 text-left text-xs text-muted-foreground sm:grid-cols-3">
        <span className="rounded-2xl border border-border/50 bg-surface/60 p-4">
          <strong className="block text-sm font-semibold text-primary">Sample window</strong>
          256 samples · 4 analogue channels · 1 label
        </span>
        <span className="rounded-2xl border border-border/50 bg-surface/60 p-4">
          <strong className="block text-sm font-semibold text-primary">Storage</strong>
          IndexedDB session buffer · exportable JSON log
        </span>
        <span className="rounded-2xl border border-border/50 bg-surface/60 p-4">
          <strong className="block text-sm font-semibold text-primary">Tip</strong>
          Stay relaxed between cues to minimize baseline drift
        </span>
      </div>
    </div>
  );
}
