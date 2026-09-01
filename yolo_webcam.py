from ultralytics import YOLO
import cv2
import requests
import time
import os
import sys
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

parser = argparse.ArgumentParser(description='Smart Ride - Direct Laptop Webcam YOLO Streamer')
parser.add_argument('--webcam-index', type=int, default=0, help='Webcam index (default: 0)')
parser.add_argument('--conf', type=float, default=0.35, help='YOLO confidence threshold (default: 0.35)')
args, _ = parser.parse_known_args()

SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_PATH = str(SCRIPT_DIR / 'yolo11n.pt')
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = 'yolo11n.pt'

SERVER_FRAME_URL = 'http://127.0.0.1:5000/yolo_frame'
SERVER_META_URL = 'http://127.0.0.1:5000/camera_update'
SERVER_IP_URL = 'http://127.0.0.1:5000/set_camera_ip'

print('=' * 65)
print('SMART RIDE // DIRECT LAPTOP WEBCAM + YOLOv11 VISION STREAMER')
print('=' * 65)
print(f'Loading YOLO Model from: {MODEL_PATH}...')

try:
    model = YOLO(MODEL_PATH)
    print('YOLO model loaded successfully!')
except Exception as e:
    print(f'Error loading local model: {e}')
    model = YOLO('yolo11n.pt')

print(f'Opening Laptop Webcam (Index {args.webcam_index})...')
cap = cv2.VideoCapture(args.webcam_index)

if not cap.isOpened():
    print(f'ERROR: Could not open webcam at index {args.webcam_index}.')
    sys.exit(1)

cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

try:
    requests.post(SERVER_IP_URL, json={
        'ip': 'localhost',
        'stream_url': 'webcam',
        'source': 'webcam',
        'source_name': f'Laptop Webcam ({args.webcam_index})'
    }, timeout=0.5)
except Exception:
    pass

print('Laptop Webcam Connected and Active!')
print(f'Streaming Live YOLO Video to : {SERVER_FRAME_URL}')
print(f'Sending Detection Telemetry to: {SERVER_META_URL}')
print('Press q in the preview window to exit.')
print('=' * 65)

last_meta_send = 0

try:
    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.02)
            continue

        h, w = frame.shape[:2]

        results = model(frame, conf=args.conf, verbose=False)
        annotated_frame = results[0].plot()

        objects = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                name = model.names[cls_id]
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                bw = x2 - x1
                bh = y2 - y1

                rel_h = bh / h
                dist_est = round(max(0.4, 3.5 * (1.0 - min(1.0, rel_h * 1.2))), 2)

                objects.append({
                    'name': name,
                    'label': name,
                    'confidence': round(conf, 2),
                    'conf': round(conf, 2),
                    'x': int(x1),
                    'y': int(y1),
                    'w': int(bw),
                    'h': int(bh),
                    'dist': dist_est
                })

        success, encoded = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if success:
            try:
                requests.post(SERVER_FRAME_URL, data=encoded.tobytes(), timeout=0.25)
            except requests.RequestException:
                pass

        current_time = time.time()
        if current_time - last_meta_send >= 0.2:
            payload = {
                'camera': f'Laptop Webcam ({args.webcam_index})',
                'source_type': 'webcam',
                'objects': objects,
                'timestamp': current_time
            }
            try:
                requests.post(SERVER_META_URL, json=payload, timeout=0.25)
            except requests.RequestException:
                pass
            last_meta_send = current_time

        status_text = f'[LAPTOP WEBCAM {args.webcam_index}] | Detections: {len(objects)}'
        cv2.putText(annotated_frame, status_text, (16, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 128), 2)

        cv2.imshow('Smart Ride - Laptop Webcam YOLO', annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print('Stopping webcam streamer...')

finally:
    cap.release()
    cv2.destroyAllWindows()
    print('Laptop webcam vision streamer stopped.')