# NeuroPulse - Parkinson's Tremor Detection Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC)](https://tailwindcss.com/)

## 🚀 Overview

NeuroPulse is an AI-powered Parkinson's disease tremor monitoring and analysis platform that uses EMG (electromyography) signals to detect and classify tremors in real-time. The system combines frequency-based analysis with machine learning for accurate, clinical-grade tremor detection.

## ✨ Features

- **🔬 Frequency-Based Classification**: Analyzes EMG signals in 0-12 Hz bands for precise tremor detection
- **📊 Real-time Monitoring**: Live dashboards with WebSocket updates for patient, caretaker, and doctor views
- **🤖 AI-Powered Insights**: Machine learning models provide personalized recommendations and progression tracking
- **🎨 Modern UI**: Glass morphism design with dark/light theme support
- **🔗 Multi-User Collaboration**: Separate dashboards for patients, caretakers, and medical professionals
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **🔒 Privacy-First**: Local processing with optional secure backend integration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ESP32 +       │    │   Python        │    │   Next.js       │
│   BioAmp EXG    │───▶│   Backend       │───▶│   Frontend      │
│   (Hardware)    │    │   (FastAPI)     │    │   (Dashboard)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   MongoDB       │
                       │   (Optional)    │
                       └─────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Data visualization library
- **Socket.io-client** - Real-time communication

### Backend
- **Python 3.10+** - Core language
- **FastAPI** - High-performance web framework
- **TensorFlow 2.15** - Machine learning framework
- **Scikit-learn** - Classical ML algorithms
- **Pandas & NumPy** - Data processing
- **Socket.io** - Real-time communication

### Hardware
- **ESP32** - Microcontroller for EMG data acquisition
- **BioAmp EXG Pill** - EMG signal amplification
- **Serial Communication** - Data streaming at 200 Hz

## 📋 Prerequisites

- **Node.js 18+** - For Next.js frontend
- **Python 3.10+** - For backend services
- **ESP32 Development Board** - With BioAmp EXG Pill
- **Arduino IDE** - For ESP32 firmware flashing
- **Git** - Version control

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/neuropulse.git
cd neuropulse
```

### 2. Setup Frontend (Next.js)
```bash
# Navigate to frontend directory
cd neuro-pointer  # or neuropulse

# Install dependencies
npm install

# Run development server
npm run dev
```
- Open [http://localhost:3000](http://localhost:3000) in your browser

### 3. Setup Backend (Python)
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv myenv
source myenv/bin/activate  # On Windows: myenv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Verify TensorFlow installation
python -c "import tensorflow as tf; print(f'TensorFlow version: {tf.__version__}')"
```

### 4. Hardware Setup (ESP32)
```bash
# Navigate to hardware directory
cd src

# Open main.cpp in Arduino IDE
# Connect ESP32 to computer
# Select correct board and port
# Upload the firmware

# The ESP32 will start streaming EMG data via Serial
```

### 5. Data Recording & Training
```bash
# In the backend directory
python cli_trainer.py --interactive

# Commands in CLI:
# record normal 15      # Record 15s of normal movement
# record mild 15        # Record 15s of mild tremor
# record severe 15      # Record 15s of severe tremor
# train                # Process and train model
# live                 # Test real-time classification
# quit                 # Exit
```

### 6. Run Full System
```bash
# Terminal 1: Backend (for data processing)
cd backend
source myenv/bin/activate
python classify.py --live --api-url http://localhost:3000

# Terminal 2: Frontend
cd neuro-pointer
npm run dev

# Terminal 3: Hardware monitoring (optional)
# Connect ESP32 and monitor Serial output
```

## 🎯 Usage Guide

### Patient Dashboard (`/dashboard/patient`)
- **Real-time Monitoring**: Live tremor classification with frequency and amplitude display
- **Historical Data**: Charts showing severity trends over time
- **Personal Insights**: AI recommendations and progression analysis
- **Data Upload**: Upload CSV files for batch analysis

### Caretaker Dashboard (`/dashboard/caretaker`)
- **Patient Overview**: Monitor multiple patients' status
- **Alerts & Notifications**: Critical tremor alerts and status updates
- **Communication Hub**: Send reminders and check-ins to patients
- **Trend Analysis**: Long-term patient progress tracking

### Doctor Dashboard (`/dashboard/doctor`)
- **Medical Insights**: Detailed analytics and clinical recommendations
- **Data Export**: Download patient data for research or records
- **Multi-Patient View**: Comprehensive overview of all patients
- **Advanced Analytics**: Statistical analysis and pattern recognition

## 🔧 Configuration

### Environment Variables
Create `.env.local` in the frontend directory:
```env
NEXT_PUBLIC_WS_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Create `.env` in the backend directory:
```env
DATABASE_URL=mongodb://localhost:27017/neuropulse
SERIAL_PORT=/dev/ttyUSB0
API_PORT=8000
```

### ESP32 Configuration
In `src/main.cpp`:
```cpp
#define EMG_PIN 34          // ADC pin for EMG signal
#define SAMPLE_RATE 200     // Hz
#define BATCH_SIZE 50       // Samples per classification
```

## 📊 Data Flow

1. **Hardware → ESP32**: EMG signals captured at 200 Hz
2. **ESP32 → Python**: Raw data streamed via Serial (200 Hz)
3. **Python → AI**: Frequency analysis and classification (0-12 Hz bands)
4. **Python → Next.js**: Real-time updates via WebSocket
5. **Next.js → UI**: Live dashboard rendering with glass morphism

## 🎨 Customization

### Theme Customization
Modify `src/app/globals.css` for color scheme:
```css
[data-theme="dark"] {
  --nc-primary: #a5b4fc;
  --nc-success: #4ade80;
  --nc-warning: #facc15;
  --nc-danger: #f87171;
}
```

### Adding New Tremor Classes
Update `cli_trainer.py` and ESP32 thresholds:
```python
# In classify_by_frequency()
if dom_freq < 1.0:
    return 'normal', 0.95
elif 1.0 <= dom_freq < 3.0:
    return 'mild', 0.8
elif 3.0 <= dom_freq <= 6.0:
    return 'severe', 0.7
```

## 🔍 Troubleshooting

### Common Issues

**ESP32 Not Connecting**
```bash
# Check serial port
ls /dev/tty*
# Update SERIAL_PORT in backend/.env
```

**TensorFlow Import Error**
```bash
# Downgrade JAX for compatibility
pip install jax==0.4.20 jaxlib==0.4.20
```

**WebSocket Connection Failed**
```bash
# Ensure backend is running on port 3000
# Check NEXT_PUBLIC_WS_URL in frontend
```

**Inaccurate Classification**
```bash
# Record more diverse training data
# Adjust frequency thresholds in ESP32 code
# Retrain model with clean data
```

### Performance Optimization

- **Reduce Buffer Size**: Lower `BATCH_SIZE` in ESP32 for faster processing
- **Optimize Charts**: Limit data points in Recharts for smooth rendering
- **Hardware Filtering**: Add capacitors to EMG circuit for noise reduction

## 📚 API Documentation

### Endpoints

**GET /api/tremor**
- Query parameters: `deviceId`, `limit`, `startDate`, `endDate`
- Returns: Array of tremor data points

**POST /api/tremor/upload**
- Body: FormData with `file` (CSV/JSON)
- Returns: Upload confirmation

**WebSocket Events**
- `tremor-update`: Real-time classification data
- `join-room`: Join specific update room

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js Team** - For the amazing framework
- **TensorFlow Team** - For ML capabilities
- **ESP32 Community** - For hardware support
- **BioAmp EXG Pill** - For EMG signal acquisition

## 📞 Support

For support, email support@neuropulse.dev or join our Discord community.

---

**Made with ❤️ for Parkinson's research and patient care**
