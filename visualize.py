import matplotlib
matplotlib.use('TkAgg')  # Set interactive backend for GUI display

import requests
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from collections import deque
import json
import time
import math

# ==== CONFIGURATION ====
SERVER_URL = "http://10.184.10.101:3000/api/tremor"  # same as ESP32
WINDOW_SIZE = 500   # number of samples to display at once
REFRESH_INTERVAL = 100  # ms - Faster updates for smoother visualization
MAX_DISPLAY_POINTS = 1000  # Limit display points for performance
DEVICE_ID = "ESP32_MEDICAL_001"  # Device ID to fetch data for

# ==== STORAGE ====
emg_data = deque(maxlen=WINDOW_SIZE)
timestamps = deque(maxlen=WINDOW_SIZE)

# ==== SETUP PLOT ====
plt.style.use("dark_background")
fig, ax = plt.subplots(figsize=(10, 5))
line, = ax.plot([], [], lw=1.5, color="#00ffcc")
ax.set_title("Real-Time EMG Stream", fontsize=14, color="#00ffcc")
ax.set_xlabel("Samples")
ax.set_ylabel("Amplitude (ADC Units)")
ax.set_ylim(1500, 2500)  # Focus on the relevant range for visualization
ax.grid(alpha=0.3)

# Status text for connection and data info
status_text = ax.text(0.02, 0.98, '', transform=ax.transAxes, 
                     fontsize=10, verticalalignment='top',
                     bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

# Connection status tracking
last_successful_fetch = 0
connection_lost_threshold = 3  # seconds
last_response_data = None  # Store last successful response for status display
consecutive_failures = 0  # Track consecutive failed fetches

# ==== FETCH LATEST DATA ====
def fetch_emg():
    global consecutive_failures
    try:
        # Include device ID in the request
        params = {'deviceId': DEVICE_ID}
        print(f"🔄 Fetching data from: {SERVER_URL} with params: {params}")
        response = requests.get(SERVER_URL, params=params, timeout=2)
        print(f"📡 Response status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"📦 Response data type: {type(data)}")

            # Handle API response format: {"success": true, "data": [...]}
            if isinstance(data, dict) and data.get("success") and "data" in data:
                tremor_records = data["data"]
                print(f"📊 Found {len(tremor_records)} tremor records")

                if isinstance(tremor_records, list) and len(tremor_records) > 0:
                    # Extract EMG data from the latest record
                    latest_record = tremor_records[0]
                    print(f"🔍 Latest record keys: {list(latest_record.keys())}")

                    if "rawData" in latest_record and "emg" in latest_record["rawData"]:
                        emg_values = latest_record["rawData"]["emg"]
                        print(f"💪 EMG values count: {len(emg_values) if emg_values else 0}")

                        if isinstance(emg_values, list) and len(emg_values) > 0:
                            # Validate EMG data: should be integers between 0-4095 for 12-bit ADC
                            validated_values = []
                            for value in emg_values:
                                if isinstance(value, (int, float)) and 0 <= value <= 4095:
                                    validated_values.append(int(value))
                                else:
                                    print(f"⚠️ Invalid EMG value: {value} (expected 0-4095)")
                                    return []

                            if validated_values:
                                print(f"✅ Successfully validated {len(validated_values)} EMG values")
                                global last_response_data
                                last_response_data = data  # Store for status display
                                return validated_values

                    # Also check for direct EMG data in the record (for processed data format)
                    elif "emg" in latest_record:
                        emg_values = latest_record["emg"]
                        print(f"💪 Direct EMG data: {len(emg_values) if emg_values else 0}")

                        if isinstance(emg_values, list) and len(emg_values) > 0:
                            # Validate EMG data: should be integers between 0-4095 for 12-bit ADC
                            validated_values = []
                            for value in emg_values:
                                if isinstance(value, (int, float)) and 0 <= value <= 4095:
                                    validated_values.append(int(value))
                                else:
                                    print(f"⚠️ Invalid EMG value: {value} (expected 0-4095)")
                                    return []

                            if validated_values:
                                print(f"✅ Successfully validated {len(validated_values)} EMG values from direct field")
                                last_response_data = data  # Store for status display
                                return validated_values

                    # Check if there's any raw data field that might contain EMG data
                    elif "rawData" in latest_record:
                        raw_data = latest_record["rawData"]
                        print(f"🔍 Raw data fields: {list(raw_data.keys()) if isinstance(raw_data, dict) else 'Not a dict'}")

                        # Look for any array field that might be EMG data
                        for key, value in raw_data.items():
                            if isinstance(value, list) and len(value) > 0:
                                print(f"🔍 Checking {key} field with {len(value)} values")
                                if all(isinstance(v, (int, float)) and 0 <= v <= 4095 for v in value[:5]):  # Check first 5 values
                                    print(f"💡 Found potential EMG data in {key} field")
                                    validated_values = []
                                    for v in value:
                                        if isinstance(v, (int, float)) and 0 <= v <= 4095:
                                            validated_values.append(int(v))
                                        else:
                                            print(f"⚠️ Invalid EMG value in {key}: {v}")
                                            return []

                                    if validated_values:
                                        print(f"✅ Successfully validated {len(validated_values)} EMG values from {key}")
                                        last_response_data = data  # Store for status display
                                        return validated_values

                    # If no raw EMG data found, return empty (no dummy data)
                    else:
                        print("📊 No raw EMG data found - returning empty")
                        return []

            # Handle ESP32 JSON format: data is an object with "emgData" array (for direct posting)
            elif isinstance(data, dict) and "emgData" in data:
                emg_values = data["emgData"]
                print(f"💾 Direct EMG data: {len(emg_values) if emg_values else 0} values")

                if isinstance(emg_values, list) and len(emg_values) > 0:
                    # Validate EMG data: should be integers between 0-4095 for 12-bit ADC
                    validated_values = []
                    for value in emg_values:
                        if isinstance(value, (int, float)) and 0 <= value <= 4095:
                            validated_values.append(int(value))
                        else:
                            print(f"⚠️ Invalid EMG value: {value} (expected 0-4095)")
                            return []

                    if validated_values:
                        last_response_data = data  # Store for status display
                        return validated_values

            # Handle legacy format: direct array
            elif isinstance(data, list) and len(data) > 0:
                print(f"📋 Legacy array format: {len(data)} values")
                # Validate legacy format
                validated_values = []
                for value in data:
                    if isinstance(value, (int, float)) and 0 <= value <= 4095:
                        validated_values.append(int(value))
                    else:
                        print(f"⚠️ Invalid EMG value in legacy format: {value}")
                        return []

                if validated_values:
                    last_response_data = data  # Store for status display
                    return validated_values

            print("⚠️ No valid EMG data found in response")
            consecutive_failures += 1  # Increment failure counter for no data
            return []  # Return empty instead of dummy data
        else:
            print(f"❌ Server responded with status {response.status_code}: {response.text}")
            consecutive_failures += 1  # Increment failure counter for server errors
            return []

    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        consecutive_failures += 1  # Increment failure counter for connection errors
        return []
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        consecutive_failures += 1  # Increment failure counter for JSON errors
        return []
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        consecutive_failures += 1  # Increment failure counter for unexpected errors
        return []

# ==== UPDATE PLOT ====
def update(frame):
    global last_successful_fetch, last_response_data, consecutive_failures
    current_time = time.time()

    new_samples = fetch_emg()
    if new_samples and len(new_samples) > 0:
        # Reset failure counter on successful fetch
        consecutive_failures = 0
        last_successful_fetch = current_time
        emg_data.extend(new_samples)

        # Limit display points for performance
        if len(emg_data) > MAX_DISPLAY_POINTS:
            # Show only the most recent points
            display_data = list(emg_data)[-MAX_DISPLAY_POINTS:]
            start_idx = len(emg_data) - MAX_DISPLAY_POINTS
        else:
            display_data = list(emg_data)
            start_idx = 0

        line.set_data(range(start_idx, len(emg_data)), display_data)
        ax.set_xlim(start_idx, len(emg_data))

        # Update status text
        samples_per_sec = len(new_samples) / (REFRESH_INTERVAL / 1000) if REFRESH_INTERVAL > 0 else 0
        if last_response_data:
            # Show current amplitude and frequency if we have processed data
            tremor_records = last_response_data.get("data", [])
            if tremor_records:
                latest_record = tremor_records[0]
                amp = latest_record.get("amplitude", 0)
                freq = latest_record.get("frequency", 0)
                status_text.set_text(f'🟢 Connected | Samples: {len(emg_data)} | Rate: {samples_per_sec:.1f}/s | Amp: {amp:.1f} | Freq: {freq:.1f}Hz')
            else:
                status_text.set_text(f'🟢 Connected | Samples: {len(emg_data)} | Rate: {samples_per_sec:.1f}/s')
        else:
            status_text.set_text(f'🟢 Connected | Samples: {len(emg_data)} | Rate: {samples_per_sec:.1f}/s')
    else:
        # Check if connection is lost
        if current_time - last_successful_fetch > connection_lost_threshold:
            if consecutive_failures >= 3:
                status_text.set_text(f'🔴 Disconnected | Last data: {current_time - last_successful_fetch:.1f}s ago | Failures: {consecutive_failures}')
                # Clear plot data if disconnected
                if consecutive_failures >= 5:
                    emg_data.clear()
                    line.set_data([], [])
                    ax.set_xlim(0, WINDOW_SIZE)
                    print("🔴 ESP32 disconnected - cleared plot data")
            else:
                status_text.set_text(f'🟡 Checking... | Samples: {len(emg_data)} | Failures: {consecutive_failures}')
        else:
            status_text.set_text(f'🟡 Connecting... | Samples: {len(emg_data)} | Failures: {consecutive_failures}')

    return line, status_text

ani = animation.FuncAnimation(fig, update, interval=REFRESH_INTERVAL, blit=True)

# Test connection before starting animation
print("🔧 Testing initial connection...")
test_data = fetch_emg()
if test_data:
    print(f"✅ Initial connection successful! Received {len(test_data)} samples")
    emg_data.extend(test_data)
else:
    print("⚠️ Initial connection test failed - will retry during animation")

plt.tight_layout()
print("📊 Starting real-time visualization...")
plt.show()
