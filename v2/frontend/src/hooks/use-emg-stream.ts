"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ClinicalAnalysis {
    severity: "Normal" | "Mild" | "Moderate" | "Severe";
    confidence: number;
    probabilities: Record<string, number>;
    recommendations: string[];
}

export interface ClinicalFeatures {
    rms: number;
    dominant_frequency: number;
    tremor_power: number;
    mobility: number;
    complexity: number;
}

export interface EMGRecord {
    timestamp: number;
    features: ClinicalFeatures;
    analysis: ClinicalAnalysis;
    raw_preview?: number[];
}

export function useEMGStream(patientId: string = "patient-001") {
    const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
    const [latestRecord, setLatestRecord] = useState<EMGRecord | null>(null);
    const [history, setHistory] = useState<EMGRecord[]>([]);
    const socketRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        if (socketRef.current) return;

        setStatus("connecting");
        const ws = new WebSocket(`ws://localhost:8000/ws/emg/${patientId}`);

        ws.onopen = () => {
            console.log("🚀 Connected to NeuroPulse v2 Backend");
            setStatus("connected");
        };

        ws.onmessage = (event) => {
            try {
                const record: EMGRecord = JSON.parse(event.data);
                setLatestRecord(record);
                setHistory(prev => {
                    const newHistory = [...prev, record];
                    return newHistory.slice(-50); // Keep last 50 samples for charting
                });
            } catch (err) {
                console.error("Failed to parse EMG data", err);
            }
        };

        ws.onerror = () => setStatus("disconnected");
        ws.onclose = () => {
            setStatus("disconnected");
            socketRef.current = null;
            // Attempt auto-reconnect after 3s
            setTimeout(connect, 3000);
        };

        socketRef.current = ws;
    }, [patientId]);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/history/${patientId}`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.reverse()); // Set initial history
            }
        } catch (err) {
            console.error("Failed to fetch initial history", err);
        }
    }, [patientId]);

    useEffect(() => {
        fetchHistory();
        connect();
        return () => {
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, [connect, fetchHistory]);

    return { status, latestRecord, history };
}
