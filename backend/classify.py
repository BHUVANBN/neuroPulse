#!/usr/bin/env python3
"""
Real-time EMG Classification Module
Loads trained model and performs live classification from ESP32 serial feed

Usage:
    python classify.py --port /dev/ttyUSB0 --api-url http://localhost:3000
    python classify.py --live --model models/tremor_model.pkl
"""

import serial
import time
import argparse
import numpy as np
import json
import requests
from collections import deque
from datetime import datetime
import sys
import os
import joblib
import warnings
warnings.filterwarnings('ignore')

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

class EMGClassifier:
    def __init__(self, model_path=None, port='/dev/ttyUSB0', baud_rate=115200, api_url=None):
        self.model_path = model_path or self.find_latest_model()
        self.port = port
        self.baud_rate = baud_rate
        self.api_url = api_url
        self.serial = None
        self.is_connected = False
        self.model = None
        self.feature_names = None

        # Buffer for real-time data
        self.data_buffer = deque(maxlen=1000)  # 5 seconds at 200 Hz
        self.window_size = 500  # 2.5 seconds for feature extraction

        # Load model on initialization
        self.load_model()

    def find_latest_model(self, models_dir='models'):
        """Find the latest trained model"""
        if not os.path.exists(models_dir):
            return None

        import glob
        model_files = glob.glob(os.path.join(models_dir, 'tremor_model_*.pkl'))

        if not model_files:
            print("❌ No trained model found. Please train a model first.")
            return None

        latest_model = max(model_files, key=os.path.getctime)
        print(f"📁 Using latest model: {latest_model}")
        return latest_model

    def load_model(self):
        """Load the trained model and feature names"""
        if not self.model_path or not os.path.exists(self.model_path):
            print(f"❌ Model file not found: {self.model_path}")
            return False

        try:
            # Load the model
            self.model = joblib.load(self.model_path)
            print(f"✅ Model loaded: {self.model_path}")

            # Try to load feature names from metadata
            metadata_file = self.model_path.replace('.pkl', '.json').replace('tremor_model_', 'metadata_')
            if os.path.exists(metadata_file):
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    self.feature_names = metadata.get('feature_names', [
                        'mean', 'rms', 'variance', 'zero_crossings', 'dominant_frequency', 'spectral_entropy'
                    ])
            else:
                # Default feature names
                self.feature_names = ['mean', 'rms', 'variance', 'zero_crossings', 'dominant_frequency', 'spectral_entropy']

            print(f"🎯 Feature names: {self.feature_names}")
            return True

        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            return False

    def connect_serial(self):
        """Connect to ESP32 via serial"""
        try:
            self.serial = serial.Serial(self.port, self.baud_rate, timeout=1)
            time.sleep(2)  # Wait for connection
            self.is_connected = True
            print(f"✅ Connected to ESP32 on {self.port}")
            return True
        except serial.SerialException as e:
            print(f"❌ Failed to connect to {self.port}: {e}")
            return False

    def read_serial_data(self):
        """Read EMG data from serial"""
        if not self.is_connected or not self.serial:
            return None

        try:
            line = self.serial.readline().decode('utf-8').strip()
            if line and ',' in line:
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        raw_value = float(parts[0])
                        filtered_value = float(parts[1])
                        return raw_value, filtered_value
                    except ValueError:
                        pass
        except Exception as e:
            print(f"Serial read error: {e}")

        return None

    def extract_features(self, signal_data):
        """Extract features from EMG signal segment"""
        if len(signal_data) < 100:
            return None

        from scipy import signal as scipy_signal
        from scipy.fft import fft, fftfreq

        signal_array = np.array(signal_data)

        # Basic features
        mean_val = np.mean(signal_array)
        rms = np.sqrt(np.mean(signal_array**2))
        variance = np.var(signal_array)
        zero_crossings = np.sum(np.diff(np.sign(signal_array)) != 0)

        # Frequency domain features
        if len(signal_array) >= 256:
            fft_values = fft(signal_array[:256])
            fft_freq = fftfreq(256, 1/200)  # Assuming 200 Hz sample rate

            # Dominant frequency
            positive_freq_idx = fft_freq > 0
            magnitude = np.abs(fft_values[positive_freq_idx])
            freqs = fft_freq[positive_freq_idx]

            if len(magnitude) > 0:
                dominant_freq_idx = np.argmax(magnitude)
                dominant_freq = freqs[dominant_freq_idx]
            else:
                dominant_freq = 0

            # Spectral entropy
            psd = magnitude**2
            psd_norm = psd / np.sum(psd) if np.sum(psd) > 0 else psd
            spectral_entropy = -np.sum(psd_norm * np.log2(psd_norm + 1e-12))
        else:
            dominant_freq = 0
            spectral_entropy = 0

        return {
            'mean': mean_val,
            'rms': rms,
            'variance': variance,
            'zero_crossings': zero_crossings,
            'dominant_frequency': dominant_freq,
            'spectral_entropy': spectral_entropy
        }

    def classify_signal(self, features):
        """Classify signal using loaded model"""
        if not self.model or not features:
            return None, 0

        try:
            # Prepare feature vector
            feature_values = [features.get(name, 0) for name in self.feature_names]

            # Get prediction and confidence
            prediction = self.model.predict([feature_values])[0]

            # Get confidence from predict_proba if available
            if hasattr(self.model, 'predict_proba'):
                probabilities = self.model.predict_proba([feature_values])[0]
                confidence = np.max(probabilities)
            else:
                confidence = 0.8  # Default confidence for models without predict_proba

            return prediction, confidence

        except Exception as e:
            print(f"Classification error: {e}")
            return None, 0

    def send_to_api(self, classification_data):
        """Send classification result to Next.js API"""
        if not self.api_url:
            return

        try:
            response = requests.post(
                f"{self.api_url}/api/tremor",
                json=classification_data,
                timeout=1
            )

            if response.status_code == 200:
                pass  # Success, no need to print
            else:
                print(f"API Error: {response.status_code}")

        except requests.exceptions.RequestException:
            pass  # Ignore API errors in real-time mode

    def run_classification(self, duration=None):
        """Run continuous classification"""
        if not self.is_connected:
            print("❌ Not connected to ESP32")
            return

        print("🔴 Starting real-time classification...")
        print("Press Ctrl+C to stop")

        start_time = time.time()
        last_classification_time = 0

        try:
            while True:
                # Read data from serial
                data = self.read_serial_data()
                if data:
                    raw, filtered = data
                    self.data_buffer.append(filtered)

                    # Perform classification every second
                    current_time = time.time()
                    if (current_time - last_classification_time) >= 1.0 and len(self.data_buffer) >= self.window_size:

                        # Extract features from recent data
                        recent_data = list(self.data_buffer)[-self.window_size:]
                        features = self.extract_features(recent_data)

                        if features:
                            # Classify
                            prediction, confidence = self.classify_signal(features)

                            if prediction:
                                # Prepare data for API
                                classification_data = {
                                    'deviceId': 'ESP32_CLASSIFIER',
                                    'classification': prediction,
                                    'confidence': confidence,
                                    'frequency': features['dominant_frequency'],
                                    'amplitude': features['rms'],
                                    'timestamp': int(current_time * 1000),
                                    'dataType': 'realtime_classification'
                                }

                                # Print to console
                                print(f"\r🔍 Class: {prediction} | Conf: {confidence:.2f} | Freq: {features['dominant_frequency']:.1f} Hz | Amp: {features['rms']:.1f}", end="")

                                # Send to API
                                self.send_to_api(classification_data)

                                last_classification_time = current_time

                # Check duration limit
                if duration and (time.time() - start_time) >= duration:
                    break

                time.sleep(0.005)  # ~200 Hz sampling

        except KeyboardInterrupt:
            print("\n🛑 Classification stopped by user")

        except Exception as e:
            print(f"\n❌ Error during classification: {e}")

    def run_interactive(self):
        """Run interactive mode"""
        print("🎮 Interactive Classification Mode")
        print("Commands: start, stop, status, quit")

        running = False

        while True:
            try:
                cmd = input("classify> ").strip().lower()

                if cmd == "start":
                    if not running:
                        running = True
                        print("🚀 Starting classification...")
                        # Run in background thread
                        import threading
                        thread = threading.Thread(target=self.run_classification, daemon=True)
                        thread.start()
                    else:
                        print("Already running")

                elif cmd == "stop":
                    running = False
                    print("⏹️  Classification stopped")

                elif cmd == "status":
                    print(f"Connected: {self.is_connected}")
                    print(f"Model loaded: {self.model is not None}")
                    print(f"Buffer size: {len(self.data_buffer)}")

                elif cmd == "quit":
                    break

                else:
                    print("Unknown command. Use: start, stop, status, quit")

            except KeyboardInterrupt:
                break

def main():
    parser = argparse.ArgumentParser(description='Real-time EMG Classification')
    parser.add_argument('--port', default='/dev/ttyUSB0', help='Serial port for ESP32')
    parser.add_argument('--model', help='Path to trained model file')
    parser.add_argument('--api-url', help='API URL for sending results')
    parser.add_argument('--duration', type=int, help='Duration to run classification (seconds)')
    parser.add_argument('--live', action='store_true', help='Run continuous classification')
    parser.add_argument('--interactive', action='store_true', help='Run interactive mode')

    args = parser.parse_args()

    classifier = EMGClassifier(
        model_path=args.model,
        port=args.port,
        api_url=args.api_url
    )

    if not classifier.connect_serial():
        sys.exit(1)

    if not classifier.load_model():
        sys.exit(1)

    if args.live or args.duration:
        classifier.run_classification(args.duration)

    elif args.interactive:
        classifier.run_interactive()

    else:
        print("Use --live or --interactive to start classification")
        print("Example: python classify.py --live --api-url http://localhost:3000")

if __name__ == "__main__":
    main()
