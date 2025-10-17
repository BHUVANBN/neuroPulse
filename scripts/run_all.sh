#!/bin/bash

# Parkinson's Tremor Detection - Full Stack Deployment Script
# Launches Python backend and Next.js frontend concurrently

set -e  # Exit on any error

echo "🚀 Starting Parkinson's Tremor Detection System..."

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
FRONTEND_DIR="$PROJECT_ROOT/neuropulse"
PYTHON_BACKEND_PORT=8001
NEXTJS_PORT=3000

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
        return 0
    fi
}

# Function to cleanup processes on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"

    # Kill any processes using our ports
    if [ ! -z "$PYTHON_PID" ]; then
        kill $PYTHON_PID 2>/dev/null || true
        echo -e "${BLUE}📡 Python backend stopped${NC}"
    fi

    if [ ! -z "$NEXTJS_PID" ]; then
        kill $NEXTJS_PID 2>/dev/null || true
        echo -e "${BLUE}🌐 Next.js frontend stopped${NC}"
    fi

    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}🔍 Checking system requirements...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ System requirements check passed${NC}"

# Check port availability
echo -e "${BLUE}🔌 Checking port availability...${NC}"
check_port $PYTHON_BACKEND_PORT
check_port $NEXTJS_PORT

# Check if Python dependencies are installed
echo -e "${BLUE}🐍 Checking Python dependencies...${NC}"
cd "$BACKEND_DIR"
if [ ! -d "venv" ] && [ ! -f ".venv/bin/activate" ]; then
    echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
    pip3 install -r requirements.txt
else
    echo -e "${GREEN}✅ Python dependencies already installed${NC}"
fi

# Check if Node.js dependencies are installed
echo -e "${BLUE}📦 Checking Node.js dependencies...${NC}"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✅ Node.js dependencies already installed${NC}"
fi

# Start Python backend
echo -e "${PURPLE}🚀 Starting Python FastAPI Backend...${NC}"
cd "$BACKEND_DIR"

# Check if model exists, if not run training
if [ ! -f "models/tremor_model_*.pkl" ]; then
    echo -e "${YELLOW}🤖 No trained model found, running quick training...${NC}"
    python3 train_model.py --model_type random_forest --n_samples 200 --test_size 0.3
fi

echo -e "${BLUE}📡 Starting FastAPI server on port $PYTHON_BACKEND_PORT...${NC}"
python3 main.py &
PYTHON_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo -e "${RED}❌ Python backend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python backend started (PID: $PYTHON_PID)${NC}"

# Start Next.js frontend
echo -e "${PURPLE}🚀 Starting Next.js Frontend...${NC}"
cd "$FRONTEND_DIR"

echo -e "${BLUE}🌐 Starting Next.js development server on port $NEXTJS_PORT...${NC}"
npm run dev &
NEXTJS_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if ! kill -0 $NEXTJS_PID 2>/dev/null; then
    echo -e "${RED}❌ Next.js frontend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Next.js frontend started (PID: $NEXTJS_PID)${NC}"

# Check if MongoDB is running (optional)
echo -e "${BLUE}🗄️  Checking MongoDB status...${NC}"
if pgrep mongod > /dev/null; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB is not running. Database features will be unavailable.${NC}"
    echo "   Start MongoDB with: sudo systemctl start mongod"
fi

echo ""
echo -e "${GREEN}🎉 Parkinson's Tremor Detection System is now running!${NC}"
echo ""
echo -e "${BLUE}📊 System Status:${NC}"
echo "  🌐 Frontend: http://localhost:$NEXTJS_PORT"
echo "  📡 Backend API: http://localhost:$PYTHON_BACKEND_PORT"
echo "  🗄️  Database: MongoDB (if running)"
echo ""
echo -e "${BLUE}🎯 Available Dashboards:${NC}"
echo "  👤 Patient Dashboard: http://localhost:$NEXTJS_PORT/dashboard/patient"
echo "  👨‍⚕️ Doctor Dashboard: http://localhost:$NEXTJS_PORT/dashboard/doctor"
echo "  🏥 Caretaker Dashboard: http://localhost:$NEXTJS_PORT/dashboard/caretaker"
echo ""
echo -e "${BLUE}🔗 API Endpoints:${NC}"
echo "  📊 Tremor Data: http://localhost:$PYTHON_BACKEND_PORT/classify"
echo "  🤖 Model Info: http://localhost:$PYTHON_BACKEND_PORT/model/info"
echo "  📈 Health Check: http://localhost:$PYTHON_BACKEND_PORT/health"
echo ""
echo -e "${YELLOW}💡 To stop the system, press Ctrl+C${NC}"
echo ""

# Wait for user interrupt
wait
