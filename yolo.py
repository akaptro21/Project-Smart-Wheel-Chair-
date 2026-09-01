from ultralytics import YOLO
import cv2
import requests
import time
import os
import sys
from pathlib import Path

# ==========================================
# SETTINGS & CONFIGURATION
# ==========================================
SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_PATH = str(SCRIPT_DIR / "yolo11n.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "yolo11n.pt"

# Priority ESP32-CAM URLs (10.228.132.35 is primary)
ESP32_URLS = [
    "http://10.228.132.35/stream",
    "http://10.101.17.202/stream",
    "http://10.101.17.201/stream"
]

# Flask Backend URLs
BACKEND_META_URL = "http://127.0.0.1:5000/camera_update"
BACKEND_FRAME_URL = "http://127.0.0.1:5000/yolo_frame"

print("=" * 65)
print("        SMART RIDE - YOLO OBJECT DETECTION")
print("=" * 65)

# ==========================================
# LOAD YOLO MODEL
# ==========================================
print(f"Loading YOLO Model from {MODEL_PATH}...")
model = YOLO(MODEL_PATH)
print("YOLO model loaded! ✅\n")


# ==========================================
# THREADED ESP32-CAM STREAM CAPTURE
# ==========================================
import socket
import concurrent.futures
import threading

class ESP32StreamCapture:
    def __init__(self, url, timeout=8):
        self.url = url
        self.timeout = timeout
        self.running = False
        self.latest_frame = None
        self.lock = threading.Lock()
        self.thread = None
        self.last_frame_time = 0
        self.is_connected = False
        self.session = requests.Session()

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._stream_loop, daemon=True)
        self.thread.start()
        t0 = time.time()
        while time.time() - t0 < 5.0:
            if self.latest_frame is not None:
                self.is_connected = True
                return True
            time.sleep(0.05)
        return False

    def _stream_loop(self):
        while self.running:
            try:
                r = self.session.get(self.url, stream=True, timeout=self.timeout)
                if r.status_code != 200:
                    time.sleep(0.5)
                    continue
                bytes_data = b""
                for chunk in r.iter_content(chunk_size=4096):
                    if not self.running:
                        break
                    if not chunk:
                        continue
                    bytes_data += chunk
                    a = bytes_data.find(b"\xff\xd8")
                    b = bytes_data.find(b"\xff\xd9")
                    if a != -1 and b != -1 and b > a:
                        jpg = bytes_data[a:b+2]
                        bytes_data = bytes_data[b+2:]
                        frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None:
                            with self.lock:
                                self.latest_frame = frame
                                self.last_frame_time = time.time()
                                self.is_connected = True
                r.close()
            except Exception:
                time.sleep(0.3)

    def read(self):
        with self.lock:
            if self.latest_frame is not None and (time.time() - self.last_frame_time) < 4.0:
                return True, self.latest_frame.copy()
            return False, None

    def release(self):
        self.running = False
        try:
            self.session.close()
        except Exception:
            pass


# ==========================================
# SMART CAMERA MANAGER
# ==========================================
class SmartCameraManager:
    def __init__(self, esp_urls, webcam_idx=0, server_base="http://127.0.0.1:5000"):
        self.esp_urls = list(esp_urls)
        self.webcam_idx = webcam_idx
        self.server_base = server_base
        self.cap = None
        self.source_type = None
        self.source_name = "None"
        self.active_url = None
        self.last_scan_time = 0
        self.scan_interval = 4.0
        self.failed_frame_count = 0

    def get_local_subnets(self):
        subnets = set()
        try:
            hostname = socket.gethostname()
            for info in socket.getaddrinfo(hostname, None):
                ip = info[4][0]
                if ":" not in ip and not ip.startswith("127."):
                    parts = ip.split(".")
                    if len(parts) == 4:
                        subnets.add(".".join(parts[:3]))
        except Exception:
            pass
        if not subnets:
            subnets.add("10.228.132")
            subnets.add("10.101.17")
            subnets.add("192.168.1")
            subnets.add("192.168.43")
        return list(subnets)

    def probe_ip(self, ip):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.3)
            if s.connect_ex((ip, 80)) == 0:
                s.close()
                stream_url = f"http://{ip}/stream"
                r = requests.get(stream_url, stream=True, timeout=1.0)
                if r.status_code == 200:
                    r.close()
                    return stream_url
            s.close()
        except Exception:
            pass
        return None

    def discover_esp32_cam(self):
        try:
            r = requests.get(f"{self.server_base}/get_camera_ip", timeout=0.5)
            if r.status_code == 200:
                data = r.json()
                web_ip = data.get("ip")
                if web_ip:
                    web_url = f"http://{web_ip}/stream" if not web_ip.startswith("http") else web_ip
                    if web_url not in self.esp_urls:
                        self.esp_urls.insert(0, web_url)
        except Exception:
            pass

        for url in self.esp_urls:
            try:
                r = requests.get(url, stream=True, timeout=1.0)
                if r.status_code == 200:
                    r.close()
                    return url
            except Exception:
                pass

        for mdns in ["http://esp32-cam.local/stream", "http://esp32.local/stream", "http://smart-ride.local/stream"]:
            try:
                r = requests.get(mdns, stream=True, timeout=0.8)
                if r.status_code == 200:
                    r.close()
                    return mdns
            except Exception:
                pass

        subnets = self.get_local_subnets()
        all_ips = []
        for sub in subnets:
            for i in range(1, 255):
                all_ips.append(f"{sub}.{i}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=60) as executor:
            for found_url in executor.map(self.probe_ip, all_ips):
                if found_url:
                    if found_url not in self.esp_urls:
                        self.esp_urls.insert(0, found_url)
                    return found_url

        return None

    def try_connect_esp32(self, stream_url=None):
        target_url = stream_url or self.discover_esp32_cam()
        if not target_url:
            return False

        print(f"📡 Connecting to ESP32-CAM: {target_url}...")
        esp_cap = ESP32StreamCapture(target_url, timeout=8)
        if esp_cap.start():
            print(f"✅ ESP32-CAM CONNECTED & STREAMING: {target_url}")
            if self.cap:
                self.cap.release()
            self.cap = esp_cap
            self.source_type = "esp32"
            self.active_url = target_url
            self.source_name = f"ESP32-CAM ({target_url})"
            self.failed_frame_count = 0

            clean_ip = target_url.replace("http://", "").replace("/stream", "").split(":")[0]
            try:
                requests.post(f"{self.server_base}/set_camera_ip", json={
                    "ip": clean_ip,
                    "stream_url": target_url,
                    "source": "esp32",
                    "source_name": self.source_name
                }, timeout=0.5)
            except Exception:
                pass
            return True
        else:
            esp_cap.release()
            print(f"⚠️ Could not read frames from: {target_url}")
            return False

    def connect_webcam(self):
        print(f"🔄 [Fallback] Shifting to local laptop webcam (Index {self.webcam_idx})...")
        try:
            if self.cap:
                self.cap.release()
            webcam_cap = cv2.VideoCapture(self.webcam_idx)
            if webcam_cap.isOpened():
                ret, frame = webcam_cap.read()
                if ret and frame is not None:
                    print(f"✅ Local Laptop Webcam CONNECTED (Index {self.webcam_idx})!")
                    self.cap = webcam_cap
                    self.source_type = "webcam"
                    self.active_url = "webcam"
                    self.source_name = f"Laptop Webcam ({self.webcam_idx})"
                    self.failed_frame_count = 0

                    try:
                        requests.post(f"{self.server_base}/set_camera_ip", json={
                            "ip": "localhost",
                            "stream_url": "webcam",
                            "source": "webcam",
                            "source_name": self.source_name
                        }, timeout=0.5)
                    except Exception:
                        pass
                    return True
                webcam_cap.release()
        except Exception as e:
            print("❌ Error opening webcam:", e)
        return False

    def initialize(self):
        print("🔍 Connecting to ESP32-CAM on Wi-Fi...")
        for attempt in range(1, 4):
            print(f"Attempt {attempt}/3 to reach ESP32-CAM...")
            if self.try_connect_esp32():
                return True
            time.sleep(1.0)
        print("⚠️ ESP32-CAM unreachable after 3 attempts.")
        if self.connect_webcam():
            return True
        print("❌ CRITICAL: No camera source found!")
        return False

    def read_frame(self):
        current_time = time.time()
        if self.source_type == "webcam" and (current_time - self.last_scan_time > self.scan_interval):
            self.last_scan_time = current_time
            found_url = self.discover_esp32_cam()
            if found_url:
                print(f"\n🎉 [Auto-Discovery] Re-connecting to ESP32-CAM at {found_url}...")
                if self.try_connect_esp32(found_url):
                    return self.cap.read()[1]

        if not self.cap:
            return None

        ret, frame = self.cap.read()
        if not ret or frame is None:
            self.failed_frame_count += 1
            if self.failed_frame_count > 6:
                print(f"\n⚠️ Frame dropped on {self.source_name}!")
                if self.source_type == "esp32":
                    if not self.try_connect_esp32(self.active_url):
                        self.connect_webcam()
                else:
                    self.initialize()
            return None

        self.failed_frame_count = 0
        return frame

    def release(self):
        if self.cap:
            self.cap.release()


cam_manager = SmartCameraManager(ESP32_URLS, 0)
if not cam_manager.initialize():
    print("Exiting...")
    sys.exit(1)

print("Starting YOLO detection & web streaming...")
print(f"Active Source: {cam_manager.source_name}")
print("=" * 65 + "\n")

last_send = 0

# ==========================================
# MAIN LOOP
# ==========================================
try:
    while True:
        frame = cam_manager.read_frame()

        if frame is None:
            time.sleep(0.02)
            continue

        h, w = frame.shape[:2]

        # ======================================
        # YOLO DETECTION & PLOT
        # ======================================
        results = model(frame, conf=0.35, verbose=False)
        annotated_frame = results[0].plot()

        objects = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = model.names[class_id]
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                bw = x2 - x1
                bh = y2 - y1

                rel_h = bh / h
                dist_est = round(max(0.4, 3.5 * (1.0 - min(1.0, rel_h * 1.2))), 2)

                objects.append({
                    "name": class_name,
                    "label": class_name,
                    "confidence": round(confidence, 2),
                    "conf": round(confidence, 2),
                    "x": int(x1),
                    "y": int(y1),
                    "w": int(bw),
                    "h": int(bh),
                    "dist": dist_est
                })

        # ======================================
        # SEND FRAME & METADATA TO FLASK
        # ======================================
        current_time = time.time()

        # Send JPEG frame
        success, encoded = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if success:
            try:
                requests.post(BACKEND_FRAME_URL, data=encoded.tobytes(), timeout=0.25)
            except requests.exceptions.RequestException:
                pass

        # Send metadata approximately every 0.2 seconds
        if current_time - last_send >= 0.2:
            payload = {
                "camera": cam_manager.source_name,
                "source_type": cam_manager.source_type,
                "objects": objects,
                "timestamp": current_time
            }
            try:
                requests.post(BACKEND_META_URL, json=payload, timeout=0.25)
            except requests.exceptions.RequestException:
                pass
            last_send = current_time

        # ======================================
        # SHOW YOLO WINDOW
        # ======================================
        status_color = (0, 255, 0) if cam_manager.source_type == "esp32" else (0, 200, 255)
        status_text = f"[{cam_manager.source_name}] | Detections: {len(objects)}"
        cv2.putText(annotated_frame, status_text, (16, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, status_color, 2)

        cv2.imshow("Smart Ride - ESP32-CAM + YOLO", annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

except KeyboardInterrupt:
    print("\nInterrupted by user.")

finally:
    cam_manager.release()
    cv2.destroyAllWindows()
    print("YOLO stopped.")