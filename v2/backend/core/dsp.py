"""
🧠 NeuroPulse v2 - Medical-Grade DSP Engine
Provides high-order filtering and clinical feature extraction from EMG signals.
"""

import numpy as np
from scipy import signal
import logging

logger = logging.getLogger(__name__)

class ClinicalDSPEngine:
    def __init__(self, sample_rate=200):
        self.fs = sample_rate

    def apply_medical_filters(self, emg_data):
        """
        Apply a clinical signal conditioning pipeline:
        1. Mean Subtraction (Detrending)
        2. Notch Filter (50Hz) - High Q for power line interference.
        3. High-Order Butterworth Bandpass (2-15Hz) for tremor isolation.
        """
        if len(emg_data) < 30: # Need enough points for stable filtering
            return emg_data
            
        # 0. Mean Subtraction (Center the signal)
        emg_data = np.array(emg_data) - np.mean(emg_data)

        # 1. Notch Filter (50Hz)
        f0 = 50.0  
        Q = 45.0   # Higher quality for sharper rejection
        b, a = signal.iirnotch(f0, Q, self.fs)
        filtered_emg = signal.filtfilt(b, a, emg_data)

        # 2. Butterworth Bandpass (4th Order, 2.0-15Hz)
        # We focus on a slightly wider band to catch all tremor types
        lowcut = 2.0
        highcut = 15.0
        nyq = 0.5 * self.fs
        b, a = signal.butter(4, [lowcut/nyq, highcut/nyq], btype='band')
        
        # Applying zero-phase filtering
        filtered_emg = signal.filtfilt(b, a, filtered_emg)
            
        return filtered_emg

    def extract_clinical_features(self, emg_signal):
        """
        Extract features used in clinical Parkinson's research.
        - RMS: Intensity of tremor.
        - Zero Crossing Rate: Frequency indicator.
        - Dominant Frequency: Main oscillation rate (typical Parkinson's is 4-6 Hz).
        - Hjorth Mobility: Signal complexity.
        """
        if len(emg_signal) == 0:
            return self._default_features()

        # Amplitude features
        rms = np.sqrt(np.mean(emg_signal**2))
        std_val = np.std(emg_signal)
        
        # Frequency analysis (FFT)
        freqs, psd = signal.welch(emg_signal, fs=self.fs, nperseg=min(len(emg_signal), 256))
        
        # Parkinson's Tremor Range (3-7 Hz)
        tremor_mask = (freqs >= 3) & (freqs <= 10)
        if np.any(tremor_mask):
            dom_freq = freqs[tremor_mask][np.argmax(psd[tremor_mask])]
        else:
            dom_freq = 0
            
        # Total Power in 3-10Hz band
        tremor_power = np.sum(psd[tremor_mask])
        
        # Zero Crossing Rate
        zero_crossings = np.sum(np.diff(np.sign(emg_signal)) != 0)
        zcr = zero_crossings / len(emg_signal)
        
        # Hjorth Parameters
        mobility, complexity = self._hjorth_params(emg_signal)
        
        return {
            "rms": float(rms),
            "std": float(std_val),
            "dominant_frequency": float(dom_freq),
            "tremor_power": float(tremor_power),
            "zcr": float(zcr),
            "mobility": float(mobility),
            "complexity": float(complexity),
            "sample_count": len(emg_signal)
        }

    def _hjorth_params(self, x):
        """Calculate Hjorth mobility and complexity."""
        try:
            dx = np.diff(x)
            ddx = np.diff(dx)
            
            m0 = np.var(x)
            m2 = np.var(dx)
            m4 = np.var(ddx)
            
            mobility = np.sqrt(m2 / m0) if m0 > 0 else 0
            complexity = np.sqrt(m4 / m2) / mobility if (m2 > 0 and mobility > 0) else 0
            
            return mobility, complexity
        except:
            return 0, 0

    def _default_features(self):
        return {
            "rms": 0, "std": 0, "dominant_frequency": 0, 
            "tremor_power": 0, "zcr": 0, "mobility": 0, "complexity": 0,
            "sample_count": 0
        }
