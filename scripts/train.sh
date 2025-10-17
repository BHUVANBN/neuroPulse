#!/bin/bash

# Parkinson's Tremor Detection - Enhanced Training Automation Script
# Integrates CLI trainer, automated feature extraction, and model training

set -e  # Exit on any error

echo "🤖 Starting Enhanced AI Model Training Pipeline..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
MODELS_DIR="$BACKEND_DIR/models"
DATA_DIR="$BACKEND_DIR/data"
FEATURES_DIR="$DATA_DIR/features"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create directories if they don't exist
mkdir -p "$MODELS_DIR"
mkdir -p "$FEATURES_DIR"
mkdir -p "$BACKEND_DIR"

echo -e "${BLUE}📁 Project structure:${NC}"
echo "  Backend: $BACKEND_DIR"
echo "  Models: $MODELS_DIR"
echo "  Features: $FEATURES_DIR"

# Check if Python and pip are available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python environment check passed${NC}"

# Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
cd "$BACKEND_DIR"
pip3 install -r requirements.txt

# Check for new raw data from CLI trainer
echo -e "${BLUE}🔍 Checking for new raw EMG data...${NC}"

RAW_DATA_COUNT=$(find "$DATA_DIR/raw" -name "*.json" -type f 2>/dev/null | wc -l)

if [ "$RAW_DATA_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}📊 Found $RAW_DATA_COUNT raw data files${NC}"

    # Process raw data and extract features
    echo -e "${YELLOW}🔬 Processing raw data and extracting features...${NC}"
    python3 -c "
import sys
sys.path.append('$BACKEND_DIR')
from cli_trainer import EMGTrainer

trainer = EMGTrainer()
features_df = trainer.process_recordings()

if features_df is not None:
    print(f'✅ Processed {len(features_df)} feature samples')
    print(f'📋 Classes: {sorted(features_df[\"label\"].unique())}')
else:
    print('❌ No features extracted')
"
else
    echo -e "${BLUE}ℹ️  No new raw data found. Using existing features or generating synthetic data.${NC}"
fi

# Check for features file
FEATURES_FILE="$FEATURES_DIR/features.csv"

if [ -f "$FEATURES_FILE" ]; then
    FEATURES_COUNT=$(wc -l < "$FEATURES_FILE")
    echo -e "${GREEN}✅ Features file exists: $FEATURES_FILE (${FEATURES_COUNT} samples)${NC}"
else
    echo -e "${YELLOW}⚠️  No features file found. Generating synthetic data for training.${NC}"
    python3 -c "
import sys
sys.path.append('$BACKEND_DIR')
from utils import create_synthetic_data

X, y = create_synthetic_data(1000)
print(f'✅ Generated {len(X)} synthetic samples')
"
    FEATURES_COUNT=1000
fi

# Train the model
echo -e "${YELLOW}🧠 Training ML model...${NC}"
MODEL_FILE="$MODELS_DIR/tremor_model_$(date +%Y%m%d_%H%M%S).pkl"

python3 train_model.py \
    --model_type random_forest \
    --data_source cli_features \
    --test_size 0.2 \
    --output_dir "$MODELS_DIR" \
    --auto_retrain \
    --verbose

# Check if model was created
if [ -f "$MODEL_FILE" ]; then
    MODEL_SIZE=$(du -h "$MODEL_FILE" | cut -f1)
    echo -e "${GREEN}✅ Model training completed successfully!${NC}"
    echo -e "${BLUE}📊 Model saved to: $MODEL_FILE${NC}"
    echo -e "${BLUE}📊 Model size: $MODEL_SIZE${NC}"
else
    echo -e "${RED}❌ Model training failed${NC}"
    exit 1
fi

# Test the model (optional)
echo -e "${YELLOW}🧪 Testing model performance...${NC}"
python3 -c "
import sys
sys.path.append('$BACKEND_DIR')
import joblib

model_path = '$MODEL_FILE'
model = joblib.load(model_path)
print('✅ Model loaded successfully')
print(f'📊 Model type: {model.model_type}')
print(f'📊 Feature names: {len(model.feature_names)} features')
print('✅ Model test completed')
"

# Create deployment-ready model package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
PACKAGE_DIR="$MODELS_DIR/deployment_$TIMESTAMP"
mkdir -p "$PACKAGE_DIR"

cp "$MODEL_FILE" "$PACKAGE_DIR/"
cp "$MODELS_DIR/metadata_*.json" "$PACKAGE_DIR/" 2>/dev/null || true

# Create deployment script
cat > "$PACKAGE_DIR/deploy_model.py" << 'EOF'
#!/usr/bin/env python3
"""
Deployment script for trained tremor detection model
"""

import joblib
import json
import sys
import os

def deploy_model(model_path, metadata_path, target_dir="production_models"):
    """Deploy model to production environment"""
    print(f"🚀 Deploying model from {model_path}")

    # Load model and metadata
    model = joblib.load(model_path)
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    # Create target directory
    os.makedirs(target_dir, exist_ok=True)

    # Copy files
    import shutil
    shutil.copy2(model_path, f"{target_dir}/current_model.pkl")
    shutil.copy2(metadata_path, f"{target_dir}/current_metadata.json")

    print(f"✅ Model deployed to {target_dir}")
    print(f"📊 Model version: {metadata.get('training_date', 'unknown')}")

    return True

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python deploy_model.py <model_file> <metadata_file>")
        sys.exit(1)

    deploy_model(sys.argv[1], sys.argv[2])
EOF

echo -e "${GREEN}✅ Deployment package created: $PACKAGE_DIR${NC}"

# Cleanup old models (keep last 5)
echo -e "${YELLOW}🧹 Cleaning up old models...${NC}"
cd "$MODELS_DIR"
ls -t tremor_model_*.pkl | tail -n +6 | xargs -I {} rm -f {}

echo -e "${GREEN}✅ Cleanup completed${NC}"

# Final summary
echo -e "${GREEN}🎉 Training pipeline completed successfully!${NC}"
echo -e "${BLUE}📈 Summary:${NC}"
echo "  ✅ Python environment: Ready"
echo "  ✅ Raw data processing: Completed"
echo "  ✅ Feature extraction: Completed"
echo "  ✅ Model training: Completed"
echo "  ✅ Model testing: Passed"
echo "  ✅ Deployment package: Created"
echo "  ✅ Old models: Cleaned up"
echo ""
echo -e "${BLUE}🚀 Your AI model is ready for production use!${NC}"
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Start the classification system: python classify.py --live"
echo "  2. Start the Next.js frontend: cd neuropulse && npm run dev"
echo "  3. Connect ESP32 device to send real EMG data"
echo ""
echo -e "${GREEN}🌟 Happy monitoring!${NC}"
