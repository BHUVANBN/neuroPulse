"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  CalibrationSample,
  CursorState,
  EogSample,
  FusionPrediction,
  GazePoint,
  IntentLabel,
  StreamStatus,
} from "@/lib/types/neurocursor";
import { replaceLastToken } from "@/lib/utils/suggestions";

export type CalibrationStage =
  | "idle"
  | "pre-roll"
  | "collecting"
  | "review"
  | "complete";

export type ControlMode = "calibration" | "control" | "paused";

export type FusionModelStatus = "uninitialized" | "loading" | "ready" | "training" | "error";

export type NeuroCursorState = {
  controlMode: ControlMode;
  calibrationStage: CalibrationStage;
  streamStatus: StreamStatus;
  gazeStatus: StreamStatus;
  fusionModelStatus: FusionModelStatus;
  cursor: CursorState;
  lastPrediction?: FusionPrediction;
  calibrationBuffer: CalibrationSample[];
  calibrationSamples: CalibrationSample[];
  eogStream: EogSample[];
  gazeStream: GazePoint[];
  overlayMessage?: string;
  keyboardVisible: boolean;
  currentSuggestions: string[];
  composedText: string;
  selectedSuggestionIndex: number;

  setControlMode: (mode: ControlMode) => void;
  setCalibrationStage: (stage: CalibrationStage) => void;
  setStreamStatus: (status: StreamStatus) => void;
  setGazeStatus: (status: StreamStatus) => void;
  setFusionModelStatus: (status: FusionModelStatus) => void;
  setCursor: (cursor: CursorState) => void;
  setOverlayMessage: (message?: string) => void;
  setPrediction: (prediction?: FusionPrediction) => void;
  setKeyboardVisible: (visible: boolean) => void;
  updateSuggestions: (suggestions: string[]) => void;
  appendCharacter: (character: string) => void;
  backspace: () => void;
  clearText: () => void;
  setComposedText: (text: string) => void;
  cycleSuggestion: (direction: "next" | "prev") => void;
  acceptSuggestion: (suggestion?: string) => void;
  appendSpace: () => void;

  appendCalibrationSample: (sample: CalibrationSample) => void;
  commitCalibrationBuffer: () => void;
  clearCalibrationData: () => void;
  setCalibrationSamples: (samples: CalibrationSample[]) => void;
  appendEogSample: (sample: EogSample, windowSize?: number) => void;
  appendGazePoint: (point: GazePoint, windowSize?: number) => void;
  applyCursorIntent: (label: IntentLabel) => void;
};

const MAX_STREAM_WINDOW = 600; // keep ~600 samples in-memory for visualization

function clampCursor(cursor: CursorState) {
  return {
    x: Math.min(100, Math.max(0, cursor.x)),
    y: Math.min(100, Math.max(0, cursor.y)),
    isClicking: cursor.isClicking,
  } satisfies CursorState;
}

export const useNeuroCursorStore = create<NeuroCursorState>()(
  devtools(
    (set, get) => ({
      controlMode: "calibration",
      calibrationStage: "idle",
      streamStatus: "disconnected",
      gazeStatus: "disconnected",
      fusionModelStatus: "uninitialized",
      cursor: { x: 50, y: 50, isClicking: false },
      calibrationBuffer: [],
      calibrationSamples: [],
      eogStream: [],
      gazeStream: [],
      keyboardVisible: false,
      currentSuggestions: [],
      composedText: "",
      selectedSuggestionIndex: 0,

      setControlMode: (mode) => set({ controlMode: mode }),
      setCalibrationStage: (stage) => set({ calibrationStage: stage }),
      setStreamStatus: (status) => set({ streamStatus: status }),
      setGazeStatus: (status) => set({ gazeStatus: status }),
      setFusionModelStatus: (status) => set({ fusionModelStatus: status }),
      setCursor: (cursor) => set({ cursor: clampCursor(cursor) }),
      setOverlayMessage: (overlayMessage) => set({ overlayMessage }),
      setPrediction: (lastPrediction) => set({ lastPrediction }),
      setKeyboardVisible: (visible) =>
        set((state) => ({
          keyboardVisible: visible,
          selectedSuggestionIndex: visible ? 0 : state.selectedSuggestionIndex,
        })),
      updateSuggestions: (suggestions) =>
        set(() => ({ currentSuggestions: suggestions, selectedSuggestionIndex: 0 })),
      appendCharacter: (character) =>
        set((state) => ({ composedText: `${state.composedText}${character}` })),
      backspace: () =>
        set((state) => ({ composedText: state.composedText.slice(0, -1) })),
      clearText: () => set({ composedText: "" }),
      setComposedText: (text) => set({ composedText: text }),
      cycleSuggestion: (direction) =>
        set((state) => {
          const count = state.currentSuggestions.length;
          if (!count) return {};
          const delta = direction === "next" ? 1 : -1;
          const nextIndex = (state.selectedSuggestionIndex + delta + count) % count;
          return { selectedSuggestionIndex: nextIndex };
        }),
      acceptSuggestion: (suggestion) =>
        set((state) => {
          const target = suggestion ?? state.currentSuggestions[state.selectedSuggestionIndex];
          if (!target) return {};
          const updated = replaceLastToken(state.composedText, target);
          const patched = updated.endsWith(" ") ? updated : `${updated} `;
          return { composedText: patched, selectedSuggestionIndex: 0 };
        }),
      appendSpace: () =>
        set((state) => {
          if (!state.composedText || state.composedText.endsWith(" ")) return {};
          return { composedText: `${state.composedText} ` };
        }),

      appendCalibrationSample: (sample) =>
        set((state) => ({ calibrationBuffer: [...state.calibrationBuffer, sample] })),
      commitCalibrationBuffer: () =>
        set((state) => ({
          calibrationSamples: [...state.calibrationSamples, ...state.calibrationBuffer],
          calibrationBuffer: [],
        })),
      clearCalibrationData: () =>
        set({ calibrationSamples: [], calibrationBuffer: [] }),
      setCalibrationSamples: (samples) =>
        set({ calibrationSamples: samples, calibrationBuffer: [] }),

      appendEogSample: (sample, windowSize = MAX_STREAM_WINDOW) =>
        set((state) => {
          const next = [...state.eogStream, sample];
          if (next.length > windowSize) next.splice(0, next.length - windowSize);
          return { eogStream: next };
        }),
      appendGazePoint: (point, windowSize = MAX_STREAM_WINDOW) =>
        set((state) => {
          const next = [...state.gazeStream, point];
          if (next.length > windowSize) next.splice(0, next.length - windowSize);
          return { gazeStream: next };
        }),

      applyCursorIntent: (label) => {
        const { cursor } = get();
        const velocity = 6;
        const nextCursor: CursorState = { ...cursor };

        switch (label) {
          case "left":
            nextCursor.x -= velocity;
            break;
          case "right":
            nextCursor.x += velocity;
            break;
          case "up":
            nextCursor.y -= velocity;
            break;
          case "down":
            nextCursor.y += velocity;
            break;
          case "blink":
            nextCursor.isClicking = true;
            break;
          case "click":
            nextCursor.isClicking = false;
            break;
          default:
            break;
        }

        set({ cursor: clampCursor(nextCursor) });
      },
    }),
    { name: "NeuroCursorStore" },
  ),
);
