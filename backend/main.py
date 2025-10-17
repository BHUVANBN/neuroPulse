"""
FastAPI Backend for Parkinson's Tremor Detection AI Model Training and Classification
Features:
- Train ML models on EMG data
- Classify tremor patterns in real-time
- Serve trained models for inference
- Data preprocessing and feature extraction
"""

from fastapi import FastAPI, HTTPException, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
import pandas as pd
import joblib
import json
import os
from datetime import datetime
import logging

# Import custom modules
from .models import TremorClassifier, DataPreprocessor
from .utils import load_sample_data, create_synthetic_data

# Initialize FastAPI app
app = FastAPI(
    title="Parkinson's Tremor Detection AI Backend",
    description="AI-powered backend for EMG signal processing and tremor classification",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for model management
current_model = None
model_metadata = {}

# Pydantic models for API requests/responses
class TrainingRequest(BaseModel):
    model_type: str = "random_forest"
    test_size: float = 0.2
    random_state: int = 42
    use_synthetic_data: bool = False
    data_source: str = "sample"

class ClassificationRequest(BaseModel):
    emg_data: List[float]
    sample_rate: int = 200
    metadata: Optional[Dict] = None

class ClassificationResponse(BaseModel):
    classification: str
    confidence: float
    probabilities: Dict[str, float]
    features: Dict[str, float]
    processing_time: float
    model_version: str

class TrainingResponse(BaseModel):
    model_id: str
    training_time: float
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    feature_importance: Optional[Dict[str, float]]

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Parkinson's Tremor Detection AI Backend",
        "status": "running",
        "version": "1.0.0",
        "model_loaded": current_model is not None
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_status": "loaded" if current_model else "not_loaded",
        "model_metadata": model_metadata if current_model else None
    }

@app.post("/train")
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train a new ML model on EMG data"""
    try:
        logger.info(f"Starting model training with type: {request.model_type}")

        # Load training data
        if request.use_synthetic_data:
            X, y = create_synthetic_data(n_samples=1000)
            logger.info("Using synthetic data for training")
        else:
            X, y = load_sample_data(request.data_source)
            logger.info(f"Loaded {len(X)} samples from {request.data_source}")

        # Initialize and train model
        classifier = TremorClassifier(model_type=request.model_type)

        training_results = classifier.train(
            X, y,
            test_size=request.test_size,
            random_state=request.random_state
        )

        # Save model globally
        global current_model, model_metadata
        current_model = classifier
        model_metadata = {
            "model_type": request.model_type,
            "training_time": training_results["training_time"],
            "accuracy": training_results["accuracy"],
            "created_at": datetime.now().isoformat()
        }

        # Save model to disk
        model_filename = f"tremor_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        model_path = os.path.join("models", model_filename)
        os.makedirs("models", exist_ok=True)
        joblib.dump(classifier, model_path)

        logger.info(f"Model trained and saved to {model_path}")

        return TrainingResponse(
            model_id=model_filename,
            training_time=training_results["training_time"],
            accuracy=training_results["accuracy"],
            precision=training_results.get("precision", 0),
            recall=training_results.get("recall", 0),
            f1_score=training_results.get("f1_score", 0),
            feature_importance=training_results.get("feature_importance")
        )

    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@app.post("/classify")
async def classify_tremor(request: ClassificationRequest):
    """Classify tremor pattern from EMG data"""
    if current_model is None:
        raise HTTPException(status_code=400, detail="No trained model available")

    try:
        import time
        start_time = time.time()

        # Preprocess EMG data
        preprocessor = DataPreprocessor()
        features = preprocessor.extract_features(
            np.array(request.emg_data),
            sample_rate=request.sample_rate
        )

        # Classify using trained model
        classification_result = current_model.predict([features])

        processing_time = time.time() - start_time

        return ClassificationResponse(
            classification=classification_result["class"],
            confidence=classification_result["confidence"],
            probabilities=classification_result["probabilities"],
            features=features,
            processing_time=processing_time,
            model_version=model_metadata.get("model_type", "unknown")
        )

    except Exception as e:
        logger.error(f"Classification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

@app.post("/classify/batch")
async def classify_batch(requests: List[ClassificationRequest]):
    """Classify multiple EMG samples in batch"""
    if current_model is None:
        raise HTTPException(status_code=400, detail="No trained model available")

    results = []
    for request in requests:
        try:
            result = await classify_tremor(request)
            results.append(result.dict())
        except Exception as e:
            results.append({"error": str(e)})

    return {"results": results}

@app.get("/model/info")
async def get_model_info():
    """Get information about the current model"""
    if current_model is None:
        raise HTTPException(status_code=404, detail="No model loaded")

    return {
        "model_type": model_metadata.get("model_type"),
        "training_time": model_metadata.get("training_time"),
        "accuracy": model_metadata.get("accuracy"),
        "created_at": model_metadata.get("created_at"),
        "feature_names": current_model.get_feature_names()
    }

@app.post("/model/load")
async def load_model(model_path: str):
    """Load a saved model from disk"""
    global current_model, model_metadata

    try:
        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail="Model file not found")

        current_model = joblib.load(model_path)

        # Extract metadata from model
        model_metadata = {
            "model_type": getattr(current_model, 'model_type', 'unknown'),
            "loaded_at": datetime.now().isoformat(),
            "model_path": model_path
        }

        return {"message": f"Model loaded from {model_path}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")

@app.get("/models")
async def list_models():
    """List available saved models"""
    models_dir = "models"
    if not os.path.exists(models_dir):
        return {"models": []}

    models = []
    for file in os.listdir(models_dir):
        if file.endswith('.pkl'):
            model_path = os.path.join(models_dir, file)
            stat = os.stat(model_path)
            models.append({
                "filename": file,
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat()
            })

    return {"models": models}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
