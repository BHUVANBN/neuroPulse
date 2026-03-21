"""
📊 NeuroPulse v2 - CLI Signal Monitor
A terminal-based plotter to verify incoming EMG signals from ESP32.
"""

import serial
import json
import time
import sys

def draw_bar(val, min_v=-2000, max_v=2000, width=50):
    # Normalize
    try:
        norm = (val - min_v) / (max_v - min_v)
        norm = max(0, min(1, norm))
        pos = int(norm * width)
        bar = [" "] * width
        center = width // 2
        
        if pos < center:
            for i in range(pos, center): bar[i] = "-"
        else:
            for i in range(center, pos): bar[i] = "+"
        
        bar[center] = "|"
        bar[pos] = "O"
        return "".join(bar)
    except:
        return "|"

def monitor(port):
    print(f"🕵️ Monitoring NeuroPulse Signal on {port} (115200)...")
    try:
        ser = serial.Serial(port, 115200, timeout=1)
        time.sleep(1)
        ser.reset_input_buffer()
        
        print("📈 Signal Stream (Ctrl+C to stop):")
        print("-" * 60)
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if not line: continue
                
                try:
                    data = json.loads(line)
                    samples = data.get("samples", [])
                    if samples:
                        # Print the first sample of each batch as a bar
                        val = samples[0]
                        bar = draw_bar(val)
                        sys.stdout.write(f"\r[{data.get('deviceId', 'ESP32')}] {bar}  {val:8.2f}")
                        sys.stdout.flush()
                except json.JSONDecodeError:
                    # Might be the "Firmware Started" message
                    if "NeuroPulse" in line:
                        print(f"\n✨ {line}")
                    else:
                        sys.stdout.write(f"\r⚠️ Malformed: {line[:50]}...")
            time.sleep(0.01)
            
    except KeyboardInterrupt:
        print("\n🛑 Monitor stopped.")
    except Exception as e:
        print(f"\n❌ Monitor error: {e}")

if __name__ == "__main__":
    port = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyUSB0"
    monitor(port)
