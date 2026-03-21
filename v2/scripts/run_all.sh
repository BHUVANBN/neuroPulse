#!/bin/bash

# 🚀 NeuroPulse v2 - Deployment Engine
# Launches Backend (FastAPI), Frontend (Next.js) and Serial Bridge.

# Base Directory
BASE_DIR="/home/batman/neuroPulse/v2"
VENV_PYTHON="$BASE_DIR/backend/venv/bin/python"
BACKEND_PORT=8000
FRONTEND_PORT=3000

echo "📂 Project Base: $BASE_DIR"

# 1. Setup Backend (Already done, but just in case)
echo "📦 Setting up NeuroPulse v2 Backend..."
cd "$BASE_DIR/backend"
# setup is finished
echo "✅ Backend Ready."

# 2. Launch Backend
echo "🚀 Launching FastAPI Server on port $BACKEND_PORT..."
"$VENV_PYTHON" main.py &
BACKEND_PID=$!
sleep 3 # Wait for backend to start

# 3. Launch Frontend
echo "🚀 Launching Next.js App on port $FRONTEND_PORT..."
cd "$BASE_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# 4. Launch Serial Bridge or Simulator
echo "🔌 Scanning for ESP32 on USB..."
USB_PORT=$(ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null | head -n 1)

if [ -z "$USB_PORT" ]; then
    echo "⚠️ No ESP32 found on USB. Launching Simulator instead..."
    cd "$BASE_DIR/scripts"
    "$VENV_PYTHON" simulator.py &
    OTHER_PID=$!
else
    echo "✅ Found ESP32 on $USB_PORT. Starting Serial-to-WS Bridge..."
    cd "$BASE_DIR/scripts"
    "$VENV_PYTHON" serial_bridge.py "$USB_PORT" &
    OTHER_PID=$!
fi

echo "✨ NeuroPulse v2 is now LIVE!"
echo "🔗 View Dashboard: http://localhost:$FRONTEND_PORT"

# Cleanup
trap "kill $BACKEND_PID $FRONTEND_PID $OTHER_PID" EXIT
wait
