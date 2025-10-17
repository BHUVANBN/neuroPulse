#!/usr/bin/env python3
"""
Serial Reader for ESP32 Tremor Classification
Reads classification data from ESP32 via Serial and sends to Next.js API
"""

import serial
import time
import requests
import json
import threading
from datetime import datetime

# Configuration
SERIAL_PORT = '/dev/ttyUSB0'  # Change to your ESP32 serial port
BAUD_RATE = 115200
API_URL = 'http://localhost:3000/api/tremor'  # Next.js API endpoint

def read_serial_data():
    """Read and parse classification data from ESP32"""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"Connected to ESP32 on {SERIAL_PORT}")

        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()

                # Check for classification data
                if line.startswith("CLASSIFICATION:"):
                    parts = line.split(":")[1].split(",")
                    if len(parts) >= 4:
                        classification = parts[0].strip()
                        frequency = float(parts[1])
                        amplitude = float(parts[2])
                        rms = float(parts[3])

                        # Prepare data for API
                        data = {
                            "deviceId": "ESP32_LOCAL_CLASSIFIER",
                            "timestamp": int(time.time() * 1000),
                            "dataType": "local_classification",
                            "frequency": frequency,
                            "amplitude": amplitude,
                            "rms": rms,
                            "classification": classification,
                            "firmwareVersion": "3.1.0"
                        }

                        # Send to Next.js API
                        send_to_api(data)

            time.sleep(0.1)

    except serial.SerialException as e:
        print(f"Serial error: {e}")
        print("Make sure ESP32 is connected and serial port is correct")
    except KeyboardInterrupt:
        print("Stopping serial reader")
    finally:
        if 'ser' in locals():
            ser.close()

def send_to_api(data):
    """Send classification data to Next.js API"""
    try:
        response = requests.post(API_URL, json=data, timeout=5)

        if response.status_code == 200:
            print(f"✅ Sent classification: {data['classification']} (Freq: {data['frequency']:.2f} Hz)")
        else:
            print(f"❌ API Error: {response.status_code} - {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")

def main():
    print("🚀 Starting ESP32 Serial Reader for Tremor Classification")
    print(f"📡 API Endpoint: {API_URL}")
    print(f"🔌 Serial Port: {SERIAL_PORT}")
    print("📊 Waiting for ESP32 classification data...")
    print("Press Ctrl+C to stop")

    # Run in a separate thread to allow keyboard interrupt
    serial_thread = threading.Thread(target=read_serial_data, daemon=True)
    serial_thread.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")

if __name__ == "__main__":
    main()
