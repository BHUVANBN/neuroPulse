"""
ML Models for Parkinson's Tremor Detection
Contains classifier implementations and data preprocessing utilities
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, LSTM
import time
import logging

logger = logging.getLogger(__name__)

class DataPreprocessor:
    """Preprocess EMG data for ML training and inference"""

    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False

    def extract_features(self, emg_signal, sample_rate=200):
        """Extract relevant features from EMG signal"""
        if len(emg_signal) == 0:
            return self._get_default_features()

        # Basic statistical features
        mean_val = np.mean(emg_signal)
        std_val = np.std(emg_signal)
        rms = np.sqrt(np.mean(emg_signal**2))
        var = np.var(emg_signal)

        # Frequency domain features (simplified FFT)
        fft_vals = np.abs(np.fft.fft(emg_signal))
        fft_freqs = np.fft.fftfreq(len(emg_signal), 1/sample_rate)

        # Find dominant frequency in tremor range (3-12 Hz)
        tremor_mask = (fft_freqs >= 3) & (fft_freqs <= 12)
        if np.any(tremor_mask):
            dominant_freq = fft_freqs[tremor_mask][np.argmax(fft_vals[tremor_mask])]
        else:
            dominant_freq = 0

        # Spectral centroid
        total_power = np.sum(fft_vals[tremor_mask])
        if total_power > 0:
            spectral_centroid = np.sum(fft_freqs[tremor_mask] * fft_vals[tremor_mask]) / total_power
        else:
            spectral_centroid = 0

        # Zero crossing rate
        zero_crossings = np.sum(np.diff(np.sign(emg_signal)) != 0)
        zero_crossing_rate = zero_crossings / len(emg_signal)

        # Signal energy
        energy = np.sum(emg_signal**2)

        # Hjorth parameters for complexity analysis
        mobility, complexity = self._calculate_hjorth_parameters(emg_signal)

        return {
            'mean': mean_val,
            'std': std_val,
            'rms': rms,
            'variance': var,
            'dominant_frequency': dominant_freq,
            'spectral_centroid': spectral_centroid,
            'zero_crossing_rate': zero_crossing_rate,
            'signal_energy': energy,
            'mobility': mobility,
            'complexity': complexity
        }

    def _get_default_features(self):
        """Return default feature values for empty signals"""
        return {
            'mean': 0, 'std': 0, 'rms': 0, 'variance': 0,
            'dominant_frequency': 0, 'spectral_centroid': 0,
            'zero_crossing_rate': 0, 'signal_energy': 0,
            'mobility': 0, 'complexity': 0
        }

    def _calculate_hjorth_parameters(self, signal):
        """Calculate Hjorth mobility and complexity parameters"""
        try:
            # First derivative
            diff_signal = np.diff(signal)

            # Mobility (RMS of first derivative / RMS of signal)
            mobility_num = np.sqrt(np.mean(diff_signal**2))
            mobility_den = np.sqrt(np.mean(signal**2))

            if mobility_den > 0:
                mobility = mobility_num / mobility_den
            else:
                mobility = 0

            # Second derivative for complexity
            diff2_signal = np.diff(diff_signal)

            complexity_num = np.sqrt(np.mean(diff2_signal**2)) / mobility_num if mobility_num > 0 else 0
            complexity_den = mobility

            if complexity_den > 0:
                complexity = complexity_num / complexity_den
            else:
                complexity = 0

            return mobility, complexity

        except:
            return 0, 0

    def fit_scaler(self, features_list):
        """Fit scaler on training features"""
        feature_matrix = np.array([list(f.values()) for f in features_list])
        self.scaler.fit(feature_matrix)
        self.is_fitted = True

    def transform_features(self, features):
        """Scale features using fitted scaler"""
        if not self.is_fitted:
            raise ValueError("Scaler not fitted. Call fit_scaler first.")

        feature_array = np.array(list(features.values())).reshape(1, -1)
        scaled_features = self.scaler.transform(feature_array)
        return scaled_features[0]

class TremorClassifier:
    """Main classifier for Parkinson's tremor detection"""

    def __init__(self, model_type="random_forest"):
        self.model_type = model_type
        self.model = None
        self.preprocessor = DataPreprocessor()
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(['normal', 'mild', 'moderate', 'severe'])
        self.feature_names = [
            'mean', 'std', 'rms', 'variance', 'dominant_frequency',
            'spectral_centroid', 'zero_crossing_rate', 'signal_energy',
            'mobility', 'complexity'
        ]

    def train(self, X, y, test_size=0.2, random_state=42):
        """Train the classifier"""
        logger.info(f"Training {self.model_type} model with {len(X)} samples")

        # Extract features from raw EMG data
        features_list = []
        for sample in X:
            features = self.preprocessor.extract_features(sample)
            features_list.append(features)

        # Fit scaler
        self.preprocessor.fit_scaler(features_list)

        # Transform features
        X_features = np.array([self.preprocessor.transform_features(f) for f in features_list])

        # Encode labels for neural network
        if self.model_type == "neural_network":
            y_encoded = self.label_encoder.transform(y)
        else:
            y_encoded = y

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_features, y_encoded, test_size=test_size, random_state=random_state, stratify=y_encoded
        )

        # Train model based on type
        start_time = time.time()

        if self.model_type == "random_forest":
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=random_state,
                n_jobs=-1
            )
        elif self.model_type == "svm":
            self.model = SVC(
                kernel='rbf',
                C=1.0,
                probability=True,
                random_state=random_state
            )
        elif self.model_type == "neural_network":
            self.model = self._create_neural_network(X_train.shape[1])
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")

        # Train the model
        if self.model_type == "neural_network":
            # For neural networks, we need to handle differently
            self.model.fit(X_train, y_train, epochs=50, validation_split=0.2, verbose=0)
            # Get predictions for multi-class
            test_probabilities = self.model.predict(X_test)
            y_pred = np.argmax(test_probabilities, axis=1)
            # Decode back to strings for consistent metrics calculation
            y_test_str = self.label_encoder.inverse_transform(y_test)
            y_pred_str = self.label_encoder.inverse_transform(y_pred)
        else:
            self.model.fit(X_train, y_train)
            y_pred = self.model.predict(X_test)
            # For non-neural networks, use original labels
            y_test_str = y_test
            y_pred_str = y_pred

        training_time = time.time() - start_time

        # Calculate metrics using string labels for consistency
        accuracy = accuracy_score(y_test_str, y_pred_str)
        precision = precision_score(y_test_str, y_pred_str, average='weighted', zero_division=0)
        recall = recall_score(y_test_str, y_pred_str, average='weighted', zero_division=0)
        f1 = f1_score(y_test_str, y_pred_str, average='weighted', zero_division=0)

        # Feature importance (for tree-based models)
        feature_importance = None
        if hasattr(self.model, 'feature_importances_'):
            feature_importance = dict(zip(self.feature_names, self.model.feature_importances_))

        logger.info(f"Training completed in {training_time:.2f}s. Accuracy: {accuracy:.4f}")

        return {
            "training_time": training_time,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "feature_importance": feature_importance
        }

    def predict(self, X):
        """Make predictions on new data"""
        if self.model is None:
            raise ValueError("Model not trained")

        features_list = []
        for sample in X:
            features = self.preprocessor.extract_features(sample)
            scaled_features = self.preprocessor.transform_features(features)
            features_list.append(scaled_features)

        X_pred = np.array(features_list)

        if self.model_type == "neural_network":
            probabilities = self.model.predict(X_pred)
            # For multi-class, get the class with highest probability
            prediction_indices = np.argmax(probabilities, axis=1)
            predictions = prediction_indices
        else:
            probabilities = self.model.predict_proba(X_pred)
            predictions = self.model.predict(X_pred)

        # Map predictions to class names
        class_names = ['normal', 'mild', 'moderate', 'severe']
        predicted_class = class_names[predictions[0]]

        # Get confidence (max probability)
        max_prob = np.max(probabilities[0])
        all_probs = dict(zip(class_names, probabilities[0]))

        return {
            "class": predicted_class,
            "confidence": float(max_prob),
            "probabilities": {k: float(v) for k, v in all_probs.items()}
        }

    def _create_neural_network(self, input_dim):
        """Create a simple neural network for classification"""
        model = Sequential([
            Dense(32, activation='relu', input_dim=input_dim),
            Dropout(0.3),
            Dense(16, activation='relu'),
            Dropout(0.2),
            Dense(4, activation='softmax')  # 4 classes
        ])

        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )

        return model

    def get_feature_names(self):
        """Get list of feature names"""
        return self.feature_names
