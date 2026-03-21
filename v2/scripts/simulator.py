"""
🧪 NeuroPulse v2 - Clinical Patient Simulator
Simulates a patient's EMG output for testing the medical-grade backend.
"""

import asyncio
import websockets
import json
import numpy as np
import time
import random

# Target: 0.0.0.0 (Localhost for this environment)
WS_URL = "ws://localhost:8000/ws/emg/sim-patient-001"

async def generate_emg_batch(state="Normal"):
    """Creates a batch of 50 samples with specific tremor characteristics."""
    fs = 200
    T = 0.25 # 250ms batch
    t = np.linspace(0, T, 50)
    
    if state == "Normal":
        # Low amplitude, low frequency noise
        freq = random.uniform(0.1, 2.0)
        amp = random.uniform(0.05, 0.2)
        noise = np.random.normal(0, 0.01, 50)
    elif state == "Mild":
        # Starting to see 4-6Hz oscillations
        freq = random.uniform(4.0, 5.0)
        amp = random.uniform(0.8, 1.5)
        noise = np.random.normal(0, 0.1, 50)
    elif state == "Moderate":
        # Significant 5-6Hz tremor
        freq = random.uniform(5.0, 6.0)
        amp = random.uniform(2.5, 4.5)
        noise = np.random.normal(0, 0.3, 50)
    elif state == "Severe":
        # Intense tremor
        freq = random.uniform(5.5, 7.0)
        amp = random.uniform(6.0, 10.0)
        noise = np.random.normal(0, 0.5, 50)
    else:
        freq, amp, noise = 1.0, 0.1, np.random.normal(0, 0.01, 50)

    # Base sine wave + harmonics + noise
    signal = amp * np.sin(2 * np.pi * freq * t)
    signal += (amp * 0.3) * np.sin(2 * np.pi * freq * 2 * t) # 2nd harmonic
    signal += noise
    
    return signal.tolist()

async def run_simulation():
    print("🚀 NeuroPulse v2 - Clinical Simulator Started")
    print(f"🔗 Connecting to {WS_URL}...")
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ Successfully connected to NeuroPulse Backend.")
            
            # Simulation Cycle: Normal -> Mild -> Moderate -> Severe -> Normal
            states = ["Normal", "Mild", "Moderate", "Severe"]
            state_idx = 0
            cycles = 0
            
            while True:
                current_state = states[state_idx]
                
                # Send 10 batches of current state
                for _ in range(10):
                    samples = await generate_emg_batch(current_state)
                    payload = {
                        "deviceId": "SIM-MED-99",
                        "samples": samples
                    }
                    await websocket.send(json.dumps(payload))
                    print(f"📡 Sending: {current_state} batch...")
                    await asyncio.sleep(0.25) # 250ms batch rate
                
                # Progress state
                state_idx = (state_idx + 1) % len(states)
                cycles += 1
                if cycles % 4 == 0:
                    print("🔄 Full disease progression cycle completed.")
                    
    except Exception as e:
        print(f"❌ Simulator Error: {e}")
        print("💡 Tip: Make sure the FastAPI backend is running on port 8000 first.")

if __name__ == "__main__":
    asyncio.run(run_simulation())
