"""
🔌 NeuroPulse v2 - Serial-to-WebSocket Bridge
Reads medical JSON data from ESP32 via USB and pipes it to the FastAPI WebSocket.
"""

import serial
import websocket
import json
import sys
import threading
import time

WS_URL = "ws://localhost:8000/ws/emg/esp32-clinical"

def on_message(ws, message):
    pass

def on_error(ws, error):
    print(f"❌ WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("💤 WebSocket connection closed")

def on_open(ws):
    print("🖇️ Serial Bridge: Connected to NeuroPulse Backend WebSocket")

def run_bridge(ser_port):
    try:
        ser = serial.Serial(ser_port, 115200, timeout=1)
        print(f"🔌 Connected to ESP32 on {ser_port}")
        
        # Connect to Backend WS
        ws = websocket.WebSocketApp(
            WS_URL,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close
        )
        
        def ser_to_ws():
            while True:
                if ser.in_waiting > 0:
                    try:
                        line = ser.readline().decode('utf-8').strip()
                        if line.startswith('{'):
                            # Validate JSON
                            data = json.loads(line)
                            # Pipe to WS
                            ws.send(json.dumps(data))
                    except Exception as e:
                        print(f"⚠️ Bridge warning: {e}")
                time.sleep(0.01)

        ws_thread = threading.Thread(target=ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        
        # Start piping
        ser_to_ws()
        
    except serial.SerialException as e:
        print(f"❌ Serial Error: {e}")
    except Exception as e:
        print(f"❌ Bridge failure: {e}")

if __name__ == "__main__":
    port = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyUSB0"
    print(f"🚀 NeuroPulse v2 Serial Bridge starting on {port}...")
    run_bridge(port)
