#!/usr/bin/env python3
"""
Generate sample EMG data for Parkinson's tremor detection training
Creates realistic synthetic EMG signals for different tremor severities
"""

import numpy as np
import pandas as pd
import json
import os
from datetime import datetime

def generate_emg_signal(duration=1.0, sample_rate=200, tremor_freq=5.0, amplitude=30.0, noise_level=0.1):
    """
    Generate a synthetic EMG signal with tremor characteristics

    Args:
        duration: Signal duration in seconds
        sample_rate: Sampling rate in Hz
        tremor_freq: Tremor frequency in Hz
        amplitude: Signal amplitude
        noise_level: Noise level relative to amplitude
    """
    t = np.linspace(0, duration, int(duration * sample_rate))

    # Base tremor signal
    signal = amplitude * np.sin(2 * np.pi * tremor_freq * t)

    # Add harmonics (typical in EMG signals)
    signal += 0.3 * amplitude * np.sin(2 * np.pi * tremor_freq * 2 * t)  # 2nd harmonic
    signal += 0.1 * amplitude * np.sin(2 * np.pi * tremor_freq * 3 * t)  # 3rd harmonic

    # Add EMG bursts (characteristic of muscle activity)
    burst_times = np.random.choice(len(t), size=max(1, len(t)//50), replace=False)
    for burst_time in burst_times:
        burst_duration = np.random.randint(10, 30)  # 10-30 samples
        burst_amp = np.random.uniform(amplitude * 1.5, amplitude * 2.5)

        start_idx = max(0, burst_time - burst_duration//2)
        end_idx = min(len(t), burst_time + burst_duration//2)

        # Gaussian envelope for burst
        envelope = np.exp(-0.5 * ((np.arange(end_idx - start_idx) - (end_idx - start_idx)//2) / (burst_duration/4))**2)
        signal[start_idx:end_idx] += burst_amp * envelope

    # Add noise
    noise = np.random.normal(0, amplitude * noise_level, len(t))
    signal += noise

    # Add baseline drift (common in EMG recordings)
    drift = 0.1 * amplitude * np.sin(2 * np.pi * 0.1 * t)  # Slow drift
    signal += drift

    return signal

def create_sample_dataset(n_samples_per_class=250, signal_length=200):
    """
    Create a complete dataset with different tremor severities

    Returns:
        List of EMG signals and corresponding labels
    """
    np.random.seed(42)  # For reproducibility

    # Define tremor classes and their characteristics
    classes = {
        'normal': {'freq_range': (0, 3), 'amp_range': (0, 15)},
        'mild': {'freq_range': (3, 4), 'amp_range': (15, 30)},
        'moderate': {'freq_range': (4, 6), 'amp_range': (30, 60)},
        'severe': {'freq_range': (6, 12), 'amp_range': (60, 100)}
    }

    X = []
    y = []

    for class_name, params in classes.items():
        print(f"Generating {n_samples_per_class} samples for class: {class_name}")

        for i in range(n_samples_per_class):
            # Random parameters within class range
            freq = np.random.uniform(params['freq_range'][0], params['freq_range'][1])
            amp = np.random.uniform(params['amp_range'][0], params['amp_range'][1])

            # Generate signal
            signal = generate_emg_signal(
                duration=signal_length/sample_rate,
                sample_rate=200,
                tremor_freq=freq,
                amplitude=amp,
                noise_level=0.15
            )

            X.append(signal)
            y.append(class_name)

    return X, y

def save_dataset(X, y, filename="sample_emg_data.json"):
    """
    Save dataset to JSON file
    """
    dataset = {
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "n_samples": len(X),
            "signal_length": len(X[0]) if X else 0,
            "sample_rate": 200,
            "classes": list(set(y)),
            "samples_per_class": len(X) // len(set(y))
        },
        "data": [
            {
                "signal": signal.tolist(),
                "label": label,
                "sample_id": i
            }
            for i, (signal, label) in enumerate(zip(X, y))
        ]
    }

    with open(filename, 'w') as f:
        json.dump(dataset, f, indent=2)

    print(f"Dataset saved to {filename}")
    return filename

def create_csv_dataset(X, y, filename="sample_emg_data.csv"):
    """
    Save dataset to CSV file (for easier loading)
    """
    # Create DataFrame
    df_data = []
    for i, (signal, label) in enumerate(zip(X, y)):
        df_data.append({
            'sample_id': i,
            'label': label,
            'signal_length': len(signal),
            'mean_amplitude': np.mean(signal),
            'std_amplitude': np.std(signal),
            'rms_amplitude': np.sqrt(np.mean(signal**2)),
            'dominant_frequency': estimate_dominant_frequency(signal),
            'emg_signal': signal.tolist()  # Store full signal as JSON string
        })

    df = pd.DataFrame(df_data)

    # Create data directory if it doesn't exist
    os.makedirs("data", exist_ok=True)

    # Save to CSV
    csv_path = f"data/{filename}"
    df.to_csv(csv_path, index=False)

    print(f"CSV dataset saved to {csv_path}")
    return csv_path

def estimate_dominant_frequency(signal, sample_rate=200):
    """
    Estimate the dominant frequency of an EMG signal
    """
    # Simple FFT-based frequency estimation
    fft_vals = np.abs(np.fft.fft(signal))
    fft_freqs = np.fft.fftfreq(len(signal), 1/sample_rate)

    # Find peak in tremor frequency range (3-12 Hz)
    mask = (fft_freqs >= 3) & (fft_freqs <= 12)
    if np.any(mask):
        peak_idx = np.argmax(fft_vals[mask])
        return fft_freqs[mask][peak_idx]

    return 0.0

def main():
    print("Creating sample EMG dataset for Parkinson's tremor detection...")

    # Generate dataset
    X, y = create_sample_dataset(n_samples_per_class=250, signal_length=200)

    print(f"Generated {len(X)} samples")
    print(f"Classes: {set(y)}")
    print(f"Signal length: {len(X[0])} samples")

    # Save to JSON
    json_file = save_dataset(X, y, "sample_emg_data.json")

    # Save to CSV
    csv_file = create_csv_dataset(X, y, "sample_emg_data.csv")

    # Print sample statistics
    print("\nDataset Statistics:")
    for class_name in set(y):
        class_signals = [X[i] for i, label in enumerate(y) if label == class_name]
        amplitudes = [np.mean(np.abs(signal)) for signal in class_signals]

        print(f"  {class_name}:")
        print(f"    Samples: {len(class_signals)}")
        print(f"    Mean amplitude: {np.mean(amplitudes)".2f"} ± {np.std(amplitudes):".2f"")
        print(f"    RMS range: {np.min(amplitudes)".2f"} - {np.max(amplitudes)".2f"}")

    print(f"\nDataset created successfully!")
    print(f"JSON file: {json_file}")
    print(f"CSV file: {csv_file}")

if __name__ == "__main__":
    main()
