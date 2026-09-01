from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, Response
import threading
import time
import cv2
import numpy as np
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    static_folder=str(BASE_DIR),
    static_url_path=""
)

# ==========================================
# STANDBY PLACEHOLDER FRAME
# ==========================================
def create_standby_frame():
    img = np.zeros((450, 760, 3), dtype=np.uint8)
    img[:] = (21, 19, 19)  # Dark background matching UI surface
    
    # Outer HUD border
    cv2.rectangle(img, (15, 15), (745, 435), (66, 71, 76), 1)
    
    # Title & Subtitle
    cv2.putText(img, "SMART RIDE // AI COMPUTER VISION CORE", (35, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (150, 181, 255), 2)
    
    cv2.putText(img, "STATUS: WAITING FOR YOLO DETECTION STREAM...", (35, 210),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (56, 189, 248), 2)
    
    cv2.putText(img, "Run: python yolo_camera.py.py in YOLO_test", (35, 250),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
    
    cv2.putText(img, "YOLOv11 Nano + ESP32-CAM / Webcam Ready", (35, 280),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)
    
    cv2.putText(img, "PORT: 5000 // ROUTE: /yolo_stream // HUD ACTIVE", (35, 415),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (100, 100, 100), 1)
    
    _, encoded = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return encoded.tobytes()

STANDBY_FRAME = create_standby_frame()

# ==========================================
# TELEMETRY STORAGE
# ==========================================

latest_data = {
    "distance": 0,
    "latitude": 0,
    "longitude": 0,
}

# ==========================================
# YOLO FRAME & DETECTIONS STORAGE
# ==========================================

latest_frame = None
last_frame_time = 0
frame_lock = threading.Lock()

latest_detections = {
    "camera": "camera1",
    "objects": [],
    "timestamp": 0,
    "count": 0
}
detections_lock = threading.Lock()


# ==========================================
# CORS HEADERS
# ==========================================

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Cache-Control"] = "no-store"
    return response


# ==========================================
# HOME
# ==========================================

@app.route("/")
def home():
    return send_from_directory(
        BASE_DIR,
        "index.html"
    )


# ==========================================
# TELEMETRY UPDATE & DATA
# ==========================================

@app.route("/update", methods=["GET", "POST"])
def update():
    global latest_data
    try:
        data = request.get_json(force=True, silent=True) or {}
        if not data and request.form:
            data = request.form.to_dict()
        if not data and request.args:
            data = request.args.to_dict()

        # Distance / Nearest Obstacle (in cm)
        raw_dist = data.get("distance") or data.get("dist") or data.get("obstacle") or data.get("nearest_obstacle")
        if raw_dist is not None:
            try:
                latest_data["distance"] = round(float(raw_dist), 2)
            except (ValueError, TypeError):
                pass

        # GPS & Speed & Battery
        if "lat" in data or "latitude" in data:
            latest_data["latitude"] = float(data.get("lat") or data.get("latitude"))
        if "lng" in data or "longitude" in data:
            latest_data["longitude"] = float(data.get("lng") or data.get("longitude"))
        if "speed" in data:
            latest_data["speed"] = float(data["speed"])
        if "battery" in data:
            latest_data["battery"] = int(data["battery"])

        latest_data["last_update"] = time.time()
        print(f"[TELEMETRY] Ultrasonic Distance: {latest_data['distance']} cm | Battery: {latest_data.get('battery', 90)}%")

        return jsonify({
            "status": "OK",
            "data": latest_data
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/data", methods=["GET"])
def data():
    return jsonify(latest_data)


# ==========================================
# YOLO FRAME UPDATE (RECEIVE ANNOTATED JPEG)
# ==========================================

@app.route("/yolo_frame", methods=["POST"])
def yolo_frame():
    global latest_frame, last_frame_time

    if not request.data:
        return jsonify({
            "status": "error",
            "message": "No frame received"
        }), 400

    with frame_lock:
        latest_frame = request.data
        last_frame_time = time.time()

    return jsonify({
        "status": "ok"
    })


# ==========================================
# DYNAMIC CAMERA IP MANAGEMENT & DISCOVERY
# ==========================================

active_camera_info = {
    "ip": "10.228.132.35",
    "stream_url": "http://10.228.132.35/stream",
    "source": "esp32",
    "source_name": "ESP32-CAM (10.228.132.35)",
    "last_updated": time.time()
}
camera_info_lock = threading.Lock()

def quick_probe_ip(ip):
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.25)
        if s.connect_ex((ip, 80)) == 0:
            s.close()
            test_url = f"http://{ip}/stream"
            r = requests.get(test_url, stream=True, timeout=0.8)
            if r.status_code == 200:
                r.close()
                return test_url
        s.close()
    except Exception:
        pass
    return None

def run_subnet_scan():
    import socket
    import concurrent.futures

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

    all_ips = []
    for sub in subnets:
        for i in range(1, 255):
            all_ips.append(f"{sub}.{i}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=60) as executor:
        for found_url in executor.map(quick_probe_ip, all_ips):
            if found_url:
                return found_url
    return None


@app.route("/get_camera_ip", methods=["GET"])
def get_camera_ip():
    with camera_info_lock:
        return jsonify(active_camera_info)


@app.route("/set_camera_ip", methods=["POST", "GET"])
def set_camera_ip():
    global active_camera_info
    try:
        data = request.get_json(force=True, silent=True) or {}
        if not data and request.form:
            data = request.form.to_dict()
        if not data and request.args:
            data = request.args.to_dict()

        ip = str(data.get("ip") or "").strip()
        stream_url = str(data.get("stream_url") or "").strip()
        source = str(data.get("source") or "esp32")
        source_name = str(data.get("source_name") or f"ESP32-CAM ({ip})")

        if ip:
            if not stream_url:
                stream_url = f"http://{ip}/stream" if not ip.startswith("http") else ip
            
            clean_ip = ip.replace("http://", "").replace("/stream", "").split(":")[0]

            with camera_info_lock:
                active_camera_info = {
                    "ip": clean_ip,
                    "stream_url": stream_url,
                    "source": source,
                    "source_name": source_name,
                    "last_updated": time.time()
                }
            print(f"[CAMERA] Updated Active Camera IP to: {clean_ip} ({stream_url})")
            return jsonify({"status": "ok", "data": active_camera_info})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

    return jsonify({"status": "error", "message": "Missing IP parameter"}), 400


@app.route("/scan_camera_ip", methods=["POST", "GET"])
def scan_camera_ip():
    global active_camera_info
    found_url = run_subnet_scan()
    if found_url:
        import re
        clean_ip = re.sub(r"^http://|/stream|/.*$", "", found_url).split(":")[0]
        with camera_info_lock:
            active_camera_info = {
                "ip": clean_ip,
                "stream_url": found_url,
                "source": "esp32",
                "source_name": f"ESP32-CAM ({clean_ip})",
                "last_updated": time.time()
            }
        return jsonify({"status": "found", "data": active_camera_info})
    return jsonify({"status": "not_found", "message": "No active ESP32-CAM discovered on subnet"})


# ==========================================
# YOLO DETECTIONS METADATA UPDATE & GET
# ==========================================

@app.route("/camera_update", methods=["POST"])
def camera_update():
    global latest_detections, active_camera_info

    try:
        data = request.get_json(force=True, silent=True)
        if data:
            with detections_lock:
                latest_detections = {
                    "camera": data.get("camera", "camera1"),
                    "source_type": data.get("source_type", "esp32"),
                    "objects": data.get("objects", []),
                    "timestamp": data.get("timestamp", time.time()),
                    "count": len(data.get("objects", []))
                }
            
            # Sync source info
            if "camera" in data:
                with camera_info_lock:
                    active_camera_info["source_name"] = data["camera"]
                    if "source_type" in data:
                        active_camera_info["source"] = data["source_type"]

            return jsonify({
                "status": "ok",
                "count": latest_detections["count"]
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

    return jsonify({
        "status": "error",
        "message": "Invalid JSON payload"
    }), 400


@app.route("/detections", methods=["GET"])
@app.route("/camera_data", methods=["GET"])
def detections():
    with detections_lock:
        is_active = (time.time() - latest_detections.get("timestamp", 0)) < 3.0
        with camera_info_lock:
            cam_info = dict(active_camera_info)

        return jsonify({
            "status": "online" if is_active else "idle",
            "active": is_active,
            "data": latest_detections,
            "camera_info": cam_info,
            "yolo_connected": latest_frame is not None and (time.time() - last_frame_time) < 5.0
        })


# ==========================================
# YOLO WEBSITE STREAM
# ==========================================

def generate_yolo_stream():
    global latest_frame, last_frame_time

    while True:
        with frame_lock:
            if latest_frame is not None and (time.time() - last_frame_time) < 5.0:
                frame = latest_frame
            else:
                frame = STANDBY_FRAME

        if frame is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: "
                + str(len(frame)).encode()
                + b"\r\n\r\n"
                + frame
                + b"\r\n"
            )

        time.sleep(0.033)


@app.route("/yolo_stream")
def yolo_stream():
    return Response(
        generate_yolo_stream(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


# ==========================================
# HEALTH
# ==========================================

@app.route("/health")
def health():
    return jsonify({
        "status": "online",
        "yolo_stream_active": latest_frame is not None and (time.time() - last_frame_time) < 5.0,
        "yolo_detections_count": latest_detections.get("count", 0),
        "telemetry": latest_data,
        "time": time.time()
    })


# ==========================================
# STATIC FILES
# ==========================================

@app.route("/<path:filename>")
def static_files(filename):
    file_path = BASE_DIR / filename

    if file_path.is_file():
        return send_from_directory(
            BASE_DIR,
            filename
        )

    return jsonify({
        "error": "Not Found",
        "path": f"/{filename}"
    }), 404


# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SMART RIDE BACKEND + YOLO CV INTEGRATION")
    print("=" * 60)
    print("Website       : http://127.0.0.1:5000")
    print("YOLO Stream   : http://127.0.0.1:5000/yolo_stream")
    print("Detections API: http://127.0.0.1:5000/detections")
    print("Telemetry API : http://127.0.0.1:5000/data")
    print("Health Check  : http://127.0.0.1:5000/health")
    print("=" * 60)

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True
    )