"""
⚡ NeuroPulse v2 - Unified Medical Backend
Main FastAPI server for data streaming, analytics and multi-user management.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import logging
import time
import os
import datetime
import asyncpg
from typing import List, Dict, Any

# Internal Core Modules
from core.dsp import ClinicalDSPEngine
from core.ml import TremorAIModel

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NeuroPulse")

app = FastAPI(title="NeuroPulse v2 API", version="2.0.0")

# CORS for Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Instances
dsp = ClinicalDSPEngine()
ml = TremorAIModel()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send to client: {e}")

manager = ConnectionManager()

# --- Database & Storage ---
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://batman:batman@localhost/neuropulse")
USE_POSTGRES = False
pool = None

async def init_db():
    global USE_POSTGRES, pool
    try:
        pool = await asyncpg.create_pool(POSTGRES_URL, timeout=5)
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS emg_records (
                    id SERIAL PRIMARY KEY,
                    device_id TEXT,
                    patient_id TEXT,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    severity TEXT,
                    confidence FLOAT,
                    rms FLOAT,
                    dominant_frequency FLOAT,
                    tremor_power FLOAT,
                    recommendations TEXT[],
                    features JSONB,
                    analysis JSONB
                )
            """)
        USE_POSTGRES = True
        logger.info("✅ Connected to PostgreSQL and initialized clinical schema.")
    except Exception as e:
        logger.warning(f"⚠️ PostgreSQL initialization failed: {e}. Falling back to JSON storage.")

asyncio.get_event_loop().create_task(init_db())

LOCAL_STORAGE = "clinical_history.json"

async def save_record(record):
    if USE_POSTGRES:
        try:
            async with pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO emg_records (
                        device_id, patient_id, timestamp, severity, confidence, 
                        rms, dominant_frequency, tremor_power, recommendations, 
                        features, analysis
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """, 
                record["deviceId"], record["patient_id"], record["timestamp"],
                record["analysis"]["severity"], record["analysis"]["confidence"],
                record["features"]["rms"], record["features"]["dominant_frequency"],
                record["features"]["tremor_power"], record["analysis"]["recommendations"],
                json.dumps(record["features"]), json.dumps(record["analysis"])
                )
            return True
        except Exception as e:
            logger.error(f"Postgres Insert Error: {e}")
    
    try:
        history = []
        if os.path.exists(LOCAL_STORAGE):
            with open(LOCAL_STORAGE, 'r') as f:
                history = json.load(f)
        record_copy = record.copy()
        if isinstance(record_copy.get("timestamp"), datetime.datetime):
            record_copy["timestamp"] = record_copy["timestamp"].isoformat()
        history.append(record_copy)
        with open(LOCAL_STORAGE, 'w') as f:
            json.dump(history[-500:], f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Local Storage Error: {e}")
        return False

@app.get("/")
async def root():
    return {"status": "online", "system": "NeuroPulse v2", "version": "2.0.0"}

# Global buffers for rolling window analysis (1 second history at 200Hz)
ROLLING_WINDOW_SIZE = 200
patient_buffers = {}

@app.websocket("/ws/emg/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    if client_id not in patient_buffers:
        patient_buffers[client_id] = []
        
    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                batch = json.loads(data_str)
                new_samples = batch.get("samples", [])
                
                # Update rolling buffer
                patient_buffers[client_id].extend(new_samples)
                if len(patient_buffers[client_id]) > ROLLING_WINDOW_SIZE:
                    patient_buffers[client_id] = patient_buffers[client_id][-ROLLING_WINDOW_SIZE:]
                
                # Only process if we have a significant window
                if len(patient_buffers[client_id]) >= 50:
                    current_window = patient_buffers[client_id]
                    
                    filtered_samples = dsp.apply_medical_filters(current_window)
                    features = dsp.extract_clinical_features(filtered_samples)
                    analysis = ml.predict_severity(features)
                    
                    timestamp = datetime.datetime.now(datetime.timezone.utc)
                    clinical_record = {
                        "deviceId": batch.get("deviceId", "Unknown"),
                        "patient_id": client_id,
                        "timestamp": timestamp,
                        "features": features,
                        "analysis": analysis,
                        "raw_preview": list(filtered_samples[:10])
                    }
                    
                    await save_record(clinical_record)
                    await manager.broadcast(json.dumps({
                        "deviceId": clinical_record["deviceId"],
                        "timestamp": timestamp.isoformat(),
                        "features": clinical_record["features"],
                        "analysis": clinical_record["analysis"]
                    }))
                
            except json.JSONDecodeError:
                logger.error("Received malformed JSON data.")
            except Exception as e:
                logger.error(f"Streaming Error: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/history/{patient_id}")
async def get_history(patient_id: str, limit: int = 100):
    if USE_POSTGRES:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT * FROM emg_records 
                    WHERE patient_id = $1 
                    ORDER BY timestamp DESC 
                    LIMIT $2
                """, patient_id, limit)
                history = []
                for row in rows:
                    history.append({
                        "id": row["id"],
                        "device_id": row["device_id"],
                        "timestamp": row["timestamp"].isoformat(),
                        "features": json.loads(row["features"]),
                        "analysis": json.loads(row["analysis"])
                    })
                return history
        except Exception as e:
            logger.error(f"Postgres Query Error: {e}")
    
    try:
        if os.path.exists(LOCAL_STORAGE):
            with open(LOCAL_STORAGE, 'r') as f:
                history = json.load(f)
                history = [r for r in history if r.get("patient_id") == patient_id]
                history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return history[:limit]
    except:
        pass
    return []

@app.post("/api/simulator/send")
async def simulate_data(patient_id: str, severity: str = "Normal"):
    mock_f = {
        "Normal": {"rms": 1.2, "dominant_frequency": 1.5, "tremor_power": 2.1},
        "Mild": {"rms": 4.5, "dominant_frequency": 4.2, "tremor_power": 12.5},
        "Moderate": {"rms": 12.1, "dominant_frequency": 5.1, "tremor_power": 32.4},
        "Severe": {"rms": 25.4, "dominant_frequency": 5.8, "tremor_power": 75.2}
    }
    f = mock_f.get(severity, mock_f["Normal"])
    f.update({"zcr": 0.12, "mobility": 0.45, "complexity": 0.67, "sample_count": 50})
    analysis = ml.predict_severity(f)
    record = {
        "deviceId": f"SIM-{patient_id}",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "features": f,
        "analysis": analysis
    }
    await manager.broadcast(json.dumps(record))
    return {"message": "Mock data broadcasted", "record": record}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
