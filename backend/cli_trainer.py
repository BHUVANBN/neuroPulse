#!/usr/bin/env python3
"""
CLI Trainer for Parkinson's Tremor Detection
Real-time EMG signal acquisition, training, and classification from ESP32

Usage:
    python cli_trainer.py --port /dev/ttyUSB0 --train
    python cli_trainer.py --record normal --duration 15
    python cli_trainer.py --live --api-url http://localhost:3000
"""

import serial
import time
import argparse
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from datetime import datetime
from collections import deque
import os
import sys
import json
import requests
from scipy import signal
from scipy.fft import fft, fftfreq
import joblib
import warnings
warnings.filterwarnings('ignore')

# Configuration
DATA_DIR = "data"
RAW_DIR = os.path.join(DATA_DIR, "raw")
FEATURES_DIR = os.path.join(DATA_DIR, "features")
MODELS_DIR = "models"

# Ensure directories exist
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(FEATURES_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

# Sampling configuration
SAMPLE_RATE = 200  # Hz
BUFFER_SIZE = 1000  # Samples for real-time plotting
WINDOW_SIZE = 5 * SAMPLE_RATE  # 5 seconds for analysis

class EMGTrainer:
    def __init__(self, port='/dev/ttyUSB0', baud_rate=115200):
        self.port = port
        self.baud_rate = baud_rate
        self.serial = None
        self.is_connected = False
        self.data_buffer = deque(maxlen=BUFFER_SIZE)
        self.recording = False
        self.recording_label = None
        self.recording_data = []

        # Live plotting setup
        self.fig, (self.ax1, self.ax2) = plt.subplots(2, 1, figsize=(12, 8))
        self.line1, = self.ax1.plot([], [], 'b-', lw=2)
        self.line2, = self.ax2.plot([], [], 'r-', lw=2)
        self.ax1.set_ylabel('EMG Signal')
        self.ax2.set_ylabel('FFT Magnitude')
        self.ax2.set_xlabel('Frequency (Hz)')

    def connect(self):
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
                        
                        # Additional filtering for extreme values
                        if abs(filtered_value) > 5.0 or abs(raw_value) > 5.0:
                            return None  # Discard noise
                        
                        # Normalize to reasonable range
                        filtered_value = max(-3.0, min(3.0, filtered_value))
                        
                        return raw_value, filtered_value
                    except ValueError:
                        pass
        except Exception as e:
            print(f"Serial read error: {e}")

        return None

    def start_recording(self, label, duration=15):
        """Start recording session for a specific label"""
        print(f"🎬 Starting recording for '{label}' - Duration: {duration}s")

        self.recording = True
        self.recording_label = label
        self.recording_data = []

        start_time = time.time()
        session_data = []

        while self.recording and (time.time() - start_time) < duration:
            data = self.read_serial_data()
            if data:
                raw, filtered = data
                session_data.append({
                    'timestamp': time.time(),
                    'raw': raw,
                    'filtered': filtered
                })

            time.sleep(0.005)  # ~200 Hz sampling

        self.recording = False
        self.save_recording(session_data, label)
        print(f"✅ Recording completed for '{label}' - {len(session_data)} samples")

    def save_recording(self, data, label):
        """Save recorded data to CSV"""
        label_dir = os.path.join(RAW_DIR, label)
        os.makedirs(label_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{label}_session_{timestamp}.csv"
        filepath = os.path.join(label_dir, filename)

        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False)

        print(f"💾 Saved recording to {filepath}")

        # Also save as JSON for easy loading
        json_filepath = filepath.replace('.csv', '.json')
        df.to_json(json_filepath, orient='records')

    def extract_features(self, signal_data):
        """Extract features from EMG signal"""
        if len(signal_data) < 100:
            return None

        signal_array = np.array(signal_data)

        # Basic features
        mean_val = np.mean(signal_array)
        rms = np.sqrt(np.mean(signal_array**2))
        variance = np.var(signal_array)
        zero_crossings = np.sum(np.diff(np.sign(signal_array)) != 0)

        # Frequency domain features
        fft_values = fft(signal_array)
        fft_freq = fftfreq(len(signal_array), 1/SAMPLE_RATE)

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

        # Frequency band analysis
        bands = {
            'normal': np.sum((freqs >= 0) & (freqs < 3)),
            'mild': np.sum((freqs >= 3) & (freqs < 7)),
            'severe': np.sum((freqs >= 7) & (freqs <= 12)),
            'noise': np.sum(freqs > 12)
        }

        return {
            'mean': mean_val,
            'rms': rms,
            'variance': variance,
            'zero_crossings': zero_crossings,
            'dominant_frequency': dominant_freq,
            'spectral_entropy': spectral_entropy,
            'signal_length': len(signal_array),
            'frequency_bands': bands
        }

    def process_recordings(self):
        """Process all recorded sessions and extract features"""
        print("🔬 Processing recordings and extracting features...")

        all_features = []

        for label in os.listdir(RAW_DIR):
            # Map old labels to new ones
            if label == 'moderate':
                label = 'mild'
            elif label not in ['normal', 'mild', 'severe']:
                continue  # Skip invalid labels
            
            label_dir = os.path.join(RAW_DIR, label)
            if not os.path.isdir(label_dir):
                continue

            print(f"Processing label: {label}")

            for filename in os.listdir(label_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(label_dir, filename)
                    try:
                        df = pd.read_json(filepath)
                        if 'filtered' in df.columns:
                            signal_data = df['filtered'].values

                            # Split into segments for better feature extraction
                            segment_size = min(500, len(signal_data))
                            for i in range(0, len(signal_data), segment_size):
                                segment = signal_data[i:i+segment_size]
                                features = self.extract_features(segment)

                                if features:
                                    features['label'] = label
                                    features['session'] = filename.replace('.json', '')
                                    features['segment'] = i // segment_size
                                    all_features.append(features)

                    except Exception as e:
                        print(f"Error processing {filepath}: {e}")

        # Save features to CSV
        if all_features:
            features_df = pd.DataFrame(all_features)
            features_file = os.path.join(FEATURES_DIR, 'features.csv')

            # Append if file exists, otherwise create new
            if os.path.exists(features_file):
                existing_df = pd.read_csv(features_file)
                combined_df = pd.concat([existing_df, features_df], ignore_index=True)
            else:
                combined_df = features_df

            combined_df.to_csv(features_file, index=False)
            print(f"✅ Features saved to {features_file} - {len(combined_df)} total samples")
            return combined_df
        else:
            print("❌ No valid features extracted")
            return None

    def train_model(self, retrain=False):
        """Train or retrain the model"""
        features_file = os.path.join(FEATURES_DIR, 'features.csv')

        if not os.path.exists(features_file):
            print("❌ No features file found. Run processing first.")
            return False

        print("🧠 Loading training data...")
        df = pd.read_csv(features_file)

        # Filter to only normal, mild, severe
        df = df[df['label'].isin(['normal', 'mild', 'severe'])]

        # Prepare data for training
        feature_columns = ['mean', 'rms', 'variance', 'zero_crossings', 'dominant_frequency', 'spectral_entropy']
        X = df[feature_columns].values
        y = df['label'].values

        print(f"📊 Training on {len(X)} samples with {len(np.unique(y))} classes: {np.unique(y)}")

        # Train model
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report, accuracy_score

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        model = RandomForestClassifier(n_estimators=100, random_state=42)

        print("🚀 Training model...")
        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        report = classification_report(y_test, y_pred)

        print(f"✅ Training completed - Accuracy: {accuracy:.3f}")
        print("📋 Classification Report:")
        print(report)

        # Save model
        model_path = os.path.join(MODELS_DIR, 'tremor_model.pkl')
        joblib.dump(model, model_path)

        # Save feature names for later use
        feature_names_path = os.path.join(MODELS_DIR, 'feature_names.json')
        with open(feature_names_path, 'w') as f:
            json.dump(feature_columns, f)

        print(f"💾 Model saved to {model_path}")
        return True

    def classify_by_frequency(self, features):
        """Classify based on frequency ranges"""
        dom_freq = features['dominant_frequency']
        
        if dom_freq < 1.0:
            return 'normal', 0.95
        elif 1.0 <= dom_freq < 3.0:
            return 'mild', 0.8
        elif 3.0 <= dom_freq <= 6.0:
            return 'severe', 0.7
        else:
            return 'normal', 0.0  # Treat high frequency as noise

    def live_classification(self, api_url=None):
        """Run live classification from serial feed"""
        print("🔴 Starting live classification mode...")

        model_path = os.path.join(MODELS_DIR, 'tremor_model.pkl')
        if not os.path.exists(model_path):
            print("❌ No trained model found. Train a model first.")
            return

        model = joblib.load(model_path)

        # Load feature names
        feature_names_path = os.path.join(MODELS_DIR, 'feature_names.json')
        if os.path.exists(feature_names_path):
            with open(feature_names_path, 'r') as f:
                feature_columns = json.load(f)
        else:
            feature_columns = ['mean', 'rms', 'variance', 'zero_crossings', 'dominant_frequency', 'spectral_entropy']

        recent_data = deque(maxlen=WINDOW_SIZE)

        def animate(frame):
            data = self.read_serial_data()
            if data:
                raw, filtered = data
                recent_data.append(filtered)

                if len(recent_data) >= 100:  # Need minimum data for features
                    # Extract features
                    features = self.extract_features(list(recent_data))
                    if features:
                        # Primary: Frequency-based classification
                        prediction, confidence = self.classify_by_frequency(features)
                        
                        # Fallback: Use ML model if frequency-based is uncertain
                        if confidence < 0.7:
                            feature_values = [features[col] for col in feature_columns]
                            prediction = model.predict([feature_values])[0]
                            confidence = np.max(model.predict_proba([feature_values]))

                        # Update plot
                        self.line1.set_data(range(len(recent_data)), list(recent_data))

                        # FFT for frequency plot
                        if len(recent_data) >= 256:
                            fft_vals = fft(list(recent_data)[:256])
                            fft_freqs = fftfreq(256, 1/SAMPLE_RATE)
                            positive_idx = fft_freqs > 0
                            self.line2.set_data(fft_freqs[positive_idx], np.abs(fft_vals[positive_idx]))

                        self.ax1.relim()
                        self.ax1.autoscale_view()
                        self.ax2.relim()
                        self.ax2.autoscale_view()

                        # Print classification
                        print(f"\r🔍 Freq: {features['dominant_frequency']:.1f} Hz | Amp: {features['rms']:.1f} | Class: {prediction} (Conf: {confidence:.2f})", end="")

                        # Send to API if URL provided
                        if api_url:
                            self.send_to_api(api_url, {
                                'classification': prediction,
                                'confidence': confidence,
                                'frequency': features['dominant_frequency'],
                                'amplitude': features['rms'],
                                'timestamp': time.time()
                            })

        ani = animation.FuncAnimation(self.fig, animate, interval=100, blit=False)
        plt.show()

    def send_to_api(self, api_url, data):
        """Send classification data to Next.js API"""
        try:
            response = requests.post(f"{api_url}/api/tremor", json=data, timeout=1)
            if response.status_code == 200:
                pass  # Success, no need to print
            else:
                print(f"API Error: {response.status_code}")
        except:
            pass  # Ignore API errors in live mode

    def run_interactive(self):
        """Run interactive CLI mode"""
        print("🎮 Interactive CLI Mode")
        print("Commands: record <label>, train, live, quit")
        print("Labels: normal, mild, severe")

        while True:
            try:
                cmd = input("cli_trainer> ").strip()

                if cmd.startswith("record "):
                    parts = cmd.split()
                    if len(parts) >= 2:
                        label = parts[1]
                        duration = int(parts[2]) if len(parts) > 2 else 15
                        self.start_recording(label, duration)
                    else:
                        print("Usage: record <label> [duration_seconds]")

                elif cmd == "train":
                    self.process_recordings()
                    self.train_model()

                elif cmd == "live":
                    api_url = input("API URL (leave empty for local only): ").strip() or None
                    self.live_classification(api_url)

                elif cmd == "quit":
                    break

                else:
                    print("Unknown command. Use: record, train, live, quit")

            except KeyboardInterrupt:
                print("\nExiting...")
                break

def main():
    parser = argparse.ArgumentParser(description='EMG Tremor Detection CLI Trainer')
    parser.add_argument('--port', default='/dev/ttyUSB0', help='Serial port for ESP32')
    parser.add_argument('--record', nargs='*', help='Record session: <label> [duration]')
    parser.add_argument('--train', action='store_true', help='Process recordings and train model')
    parser.add_argument('--interactive', action='store_true', help='Run interactive mode for recording and training')
    parser.add_argument('--live', action='store_true', help='Run live classification')
    parser.add_argument('--api-url', help='API URL for live mode')

    args = parser.parse_args()

    trainer = EMGTrainer(port=args.port)

    if not trainer.connect():
        sys.exit(1)

    if args.interactive:
        trainer.run_interactive()
    elif args.live:
        trainer.live_classification()
    elif args.record:
        # Handle recording
        label = args.record[0]
        duration = int(args.record[1]) if len(args.record) > 1 else 15
        trainer.start_recording(label, duration)
    elif args.train:
        trainer.process_recordings()
        trainer.train_model()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
