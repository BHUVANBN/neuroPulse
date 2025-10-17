"""
Backend package for Parkinson's Tremor Detection AI
"""

from .main import app
from .models import TremorClassifier, DataPreprocessor
from .utils import load_sample_data, create_synthetic_data

__version__ = "1.0.0"
__all__ = ["app", "TremorClassifier", "DataPreprocessor", "load_sample_data", "create_synthetic_data"]
