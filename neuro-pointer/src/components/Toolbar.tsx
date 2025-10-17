"use client";

import { Pause, Play, RotateCcw, Keyboard, X, Sparkles } from "lucide-react";
import { useNeuroCursorStore } from "@/store/useNeuroCursorStore";
import { cn } from "@/lib/utils/style";

const actions = [
  { label: "Start", icon: Play, action: "start" },
  { label: "Pause", icon: Pause, action: "pause" },
  { label: "Recalibrate", icon: RotateCcw, action: "recalibrate" },
  { label: "Keyboard", icon: Keyboard, action: "keyboard" },
  { label: "Exit", icon: X, action: "exit" },
] as const;

type ToolbarAction = (typeof actions)[number]["action"];

type ToolbarProps = {
  onAction?: (action: ToolbarAction) => void;
  className?: string;
};

export function Toolbar({ onAction, className }: ToolbarProps) {
  const { controlMode, setControlMode, setKeyboardVisible } = useNeuroCursorStore();

  const handleAction = (action: ToolbarAction) => {
    switch (action) {
      case "start":
        setControlMode("control");
        break;
      case "pause":
        setControlMode("paused");
        break;
      case "recalibrate":
        setControlMode("calibration");
        break;
      case "keyboard":
        setKeyboardVisible(true);
        break;
      case "exit":
        setControlMode("paused");
        setKeyboardVisible(false);
        break;
      default:
        break;
    }
    onAction?.(action);
  };

  return (
    <div
      className={cn(
        "glass pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-panel/80 p-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-primary/80">
        <Sparkles className="size-3" />
        {controlMode === "calibration" ? "Calibration" : controlMode === "control" ? "Control" : "Paused"}
      </span>

      {actions.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          onClick={() => handleAction(action)}
          className="inline-flex items-center gap-1 rounded-full border border-border/40 px-3 py-1.5 font-semibold text-primary transition hover:bg-panel"
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  );
}
