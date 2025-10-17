"""
Utility functions for data loading, preprocessing, and synthetic data generation
"""

import numpy as np
import pandas as pd
import os
import json
import logging

logger = logging.getLogger(__name__)

def load_sample_data(data_source="sample"):
    """
    Load sample EMG data for training
    Returns X (features) and y (labels)
    """
    try:
        if data_source == "sample":
            # Generate synthetic EMG-like data for demonstration
            return create_synthetic_emg_data(n_samples=1000)
        else:
            # Try to load from file
            data_path = f"data/{data_source}.csv"
            if os.path.exists(data_path):
                df = pd.read_csv(data_path)
                # Assuming columns: emg_signal (as list/array) and label
                X = []
                y = []

                for _, row in df.iterrows():
                    # Parse EMG signal (assuming it's stored as a string representation)
                    emg_signal = eval(row['emg_signal']) if 'emg_signal' in row.columns else []
                    if len(emg_signal) > 0:
                        X.append(np.array(emg_signal))
                        y.append(row['label'])

                return X, y
            else:
                logger.warning(f"Data file {data_path} not found, using synthetic data")
                return create_synthetic_emg_data(n_samples=1000)

    except Exception as e:
        logger.error(f"Error loading sample data: {str(e)}")
        return create_synthetic_emg_data(n_samples=500)

def create_synthetic_emg_data(n_samples=1000, signal_length=200, sample_rate=200):
    """
    Create synthetic EMG-like data for training and testing
    Simulates different tremor patterns
    """
    np.random.seed(42)

    X = []
    y = []

    # Parameters for different tremor classes
    tremor_params = {
        'normal': {'freq_range': (0, 3), 'amp_range': (0, 10)},
        'mild': {'freq_range': (3, 4), 'amp_range': (10, 25)},
        'moderate': {'freq_range': (4, 6), 'amp_range': (25, 50)},
        'severe': {'freq_range': (6, 12), 'amp_range': (50, 100)}
    }

    samples_per_class = n_samples // len(tremor_params)

    for class_name, params in tremor_params.items():
        for _ in range(samples_per_class):
            # Generate synthetic EMG signal
            signal = generate_emg_signal(
                signal_length=signal_length,
                freq_range=params['freq_range'],
                amp_range=params['amp_range'],
                sample_rate=sample_rate,
                noise_level=0.1
            )

            X.append(signal)
            y.append(class_name)

    return X, y

def create_synthetic_data(n_samples=1000):
    """
    Create simple synthetic data for quick testing
    """
    np.random.seed(42)

    # Generate random features
    X = []
    y = []

    for i in range(n_samples):
        # Random feature vector (10 features)
        features = np.random.randn(10)

        # Simple classification based on some features
        if features[0] > 1.5:  # High frequency
            label = 'severe'
        elif features[0] > 0.5:
            label = 'moderate'
        elif features[0] > -0.5:
            label = 'mild'
        else:
            label = 'normal'

        X.append(features)
        y.append(label)

    return X, y

def generate_emg_signal(signal_length, freq_range, amp_range, sample_rate=200, noise_level=0.1):
    """
    Generate a synthetic EMG-like signal with specified characteristics
    """
    t = np.linspace(0, signal_length / sample_rate, signal_length)

    # Generate base tremor signal
    freq = np.random.uniform(freq_range[0], freq_range[1])
    amp = np.random.uniform(amp_range[0], amp_range[1])

    # Create signal with multiple frequency components
    signal = amp * np.sin(2 * np.pi * freq * t)

    # Add harmonics
    for harmonic in [2, 3]:
        harmonic_amp = amp * (0.3 / harmonic)
        signal += harmonic_amp * np.sin(2 * np.pi * freq * harmonic * t)

    # Add noise
    noise = np.random.normal(0, amp * noise_level, len(t))
    signal += noise

    # Add some random spikes (EMG bursts)
    spike_indices = np.random.choice(len(t), size=len(t)//20, replace=False)
    for idx in spike_indices:
        spike_duration = np.random.randint(5, 15)
        spike_amp = np.random.uniform(amp * 1.5, amp * 2.5)

        start_idx = max(0, idx - spike_duration//2)
        end_idx = min(len(t), idx + spike_duration//2)

        spike_signal = spike_amp * np.exp(-0.5 * ((np.arange(end_idx - start_idx) - (end_idx - start_idx)//2) / (spike_duration/4))**2)
        signal[start_idx:end_idx] += spike_signal

    return signal

def save_training_data(X, y, filename="training_data.json"):
    """
    Save training data to JSON file for later use
    """
    try:
        data_dict = {
            "X": [x.tolist() if hasattr(x, 'tolist') else x for x in X],
            "y": y,
            "metadata": {
                "num_samples": len(X),
                "signal_length": len(X[0]) if X else 0,
                "classes": list(set(y)),
                "created_at": pd.Timestamp.now().isoformat()
            }
        }

        with open(filename, 'w') as f:
            json.dump(data_dict, f, indent=2)

        logger.info(f"Training data saved to {filename}")
        return True

    except Exception as e:
        logger.error(f"Error saving training data: {str(e)}")
        return False

def load_training_data(filename="training_data.json"):
    """
    Load training data from JSON file
    """
    try:
        with open(filename, 'r') as f:
            data_dict = json.load(f)

        X = [np.array(x) for x in data_dict["X"]]
        y = data_dict["y"]

        logger.info(f"Loaded {len(X)} samples from {filename}")
        return X, y

    except Exception as e:
        logger.error(f"Error loading training data: {str(e)}")
        return None, None

def create_sample_csv_data(filename="sample_emg_data.csv"):
    """
    Create a sample CSV file with EMG data for testing
    """
    try:
        # Generate sample data
        X, y = create_synthetic_emg_data(n_samples=100, signal_length=100)

        # Create DataFrame
        df_data = []
        for i, (signal, label) in enumerate(zip(X, y)):
            df_data.append({
                'sample_id': i,
                'label': label,
                'emg_signal': str(signal.tolist()),
                'signal_length': len(signal)
            })

        df = pd.DataFrame(df_data)

        # Save to CSV
        os.makedirs("data", exist_ok=True)
        df.to_csv(f"data/{filename}", index=False)

        logger.info(f"Sample CSV data created: data/{filename}")
        return True

    except Exception as e:
        logger.error(f"Error creating sample CSV: {str(e)}")
        return False
