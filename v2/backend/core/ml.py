"""
🤖 NeuroPulse v2 - AI Classifier for Parkinson's
Classifies tremor severity based on clinical features.
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
import logging

logger = logging.getLogger(__name__)

class TremorAIModel:
    def __init__(self, model_path=None):
        self.model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
        
        # Mapping for clinical interpretation
        self.labels = ['Normal', 'Mild', 'Moderate', 'Severe']

    def train_with_clinical_data(self, X_features, y_labels):
        """
        Train the model using clinical features.
        Expects a list of dictionaries with features like RMS, Dominant frequency, Tremor power, etc.
        """
        # Feature Matrix
        X = np.array([list(f.values()) for f in X_features])
        y = np.array(y_labels)

        # Basic label preprocessing (0: Normal, 1: Mild, 2: Moderate, 3: Severe)
        y_encoded = []
        for label in y:
            if label.lower() == 'normal': y_encoded.append(0)
            elif label.lower() == 'mild': y_encoded.append(1)
            elif label.lower() == 'moderate': y_encoded.append(2)
            elif label.lower() == 'severe': y_encoded.append(3)
            else: y_encoded.append(0)
            
        # Fit models
        self.scaler.fit(X)
        self.model.fit(self.scaler.transform(X), y_encoded)
        self.is_trained = True
        logger.info("NeuroPulse v2 Model successfully trained with clinical data.")

    def predict_severity(self, features):
        """
        Predict tremor severity and provide clinical insights.
        """
        if not self.is_trained:
            # For demonstration, use a rule-based system if not trained yet
            return self._heuristic_classification(features)
            
        X_test = np.array(list(features.values())).reshape(1, -1)
        X_scaled = self.scaler.transform(X_test)
        
        # Predict class and probabilities
        pred_idx = self.model.predict(X_scaled)[0]
        probs = self.model.predict_proba(X_scaled)[0]
        
        confidence = float(probs[pred_idx])
        severity_label = self.labels[pred_idx]
        
        return {
            "severity": severity_label,
            "confidence": confidence,
            "probabilities": {self.labels[i]: float(probs[i]) for i in range(4)},
            "recommendations": self._generate_recommendations(severity_label)
        }

    def _heuristic_classification(self, f):
        """Rule-based interpretation for clinical tremor staging."""
        freq = f.get('dominant_frequency', 0)
        pwr = f.get('tremor_power', 0)
        rms = f.get('rms', 0)
        mobility = f.get('mobility', 0)
        
        # 1. Distinguish between contraction and tremor
        # Contractions are broadband (high mobility), tremors are rhythmic (low mobility/sharp frequency)
        is_periodic = (mobility < 1.0) # Heuristic for rhythmic signal
        
        # 2. Parkinson's or Essential Tremor Detection (3-12 Hz)
        if 3.0 <= freq <= 12.0 and pwr > 5.0 and is_periodic:
            # Staging based on normalized power density
            if pwr > 100.0 or rms > 400.0:
                sev = 'Severe'
                conf = 0.92
            elif pwr > 30.0 or rms > 150.0:
                sev = 'Moderate'
                conf = 0.88
            else:
                sev = 'Mild'
                conf = 0.82
        # 3. Handle intentional muscle contractions (e.g. making a fist)
        elif rms > 100.0 and not is_periodic:
            sev = 'Normal' # Classified as strong muscle engagement, not tremor
            conf = 0.75
        # 4. Default baseline
        else:
            sev = 'Normal'
            conf = 0.95 if rms < 30.0 else 0.7 # High confidence if clearly quiet
            
        return {
            "severity": sev,
            "confidence": conf,
            "recommendations": self._generate_recommendations(sev)
        }

    def _generate_recommendations(self, severity):
        recs = {
            'Normal': ['Maintain regular exercise', 'Monitor for change twice weekly', 'Adequate sleep'],
            'Mild': ['Hand grip strengthening exercises', 'Document trigger factors (stress/caffeine)', 'Routine doctor visit'],
            'Moderate': ['Physical therapy session recommended', 'Review medication effectiveness', 'Assistive devices for fine-motor tasks'],
            'Severe': ['Urgent clinical evaluation', 'Adjust medication schedule under supervision', 'High-fall risk precautions']
        }
        return recs.get(severity, ['Consult your physician'])
