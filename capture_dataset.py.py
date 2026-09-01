import requests
import cv2
import numpy as np
import os
import time

# ==============================
# ESP32-CAM STREAM
# ==============================
URL = "http://10.228.132.35/stream"

# ==============================
# DATASET FOLDERS
# ==============================
folders = {
    "p": "dataset/person",
    "c": "dataset/chair",
    "t": "dataset/table",
    "w": "dataset/wall"
}

for folder in folders.values():
    os.makedirs(folder, exist_ok=True)

# ==============================
# CONNECT
# ==============================
print("Connecting to ESP32-CAM...")

try:
    stream = requests.get(URL, stream=True, timeout=10)
    stream.raise_for_status()
    print("Connected! ✅")

except Exception as e:
    print("Connection failed ❌")
    print(e)
    exit()

print()
print("CONTROLS:")
print("P = Person")
print("C = Chair")
print("T = Table")
print("W = Wall")
print("Q = Quit")
print()

buffer = b""

while True:

    chunk = stream.raw.read(1024)
    buffer += chunk

    start = buffer.find(b"\xff\xd8")
    end = buffer.find(b"\xff\xd9")

    if start != -1 and end != -1 and end > start:

        jpg = buffer[start:end + 2]
        buffer = buffer[end + 2:]

        frame = cv2.imdecode(
            np.frombuffer(jpg, dtype=np.uint8),
            cv2.IMREAD_COLOR
        )

        if frame is None:
            continue

        # Show camera
        cv2.imshow("ESP32-CAM Dataset Capture", frame)

        key = cv2.waitKey(1) & 0xFF

        # ==============================
        # SAVE IMAGE
        # ==============================
        if key in [ord("p"), ord("c"), ord("t"), ord("w")]:

            folder = folders[chr(key)]

            existing = len([
                f for f in os.listdir(folder)
                if f.lower().endswith((".jpg", ".jpeg", ".png"))
            ])

            filename = os.path.join(
                folder,
                f"{chr(key)}_{existing + 1:04d}.jpg"
            )

            cv2.imwrite(filename, frame)

            print(f"Saved: {filename} ✅")

            time.sleep(0.3)

        # Quit
        elif key == ord("q"):
            break

stream.close()
cv2.destroyAllWindows()

print("Dataset capture stopped.")