import time, requests, sys, re, argparse

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

parser = argparse.ArgumentParser(description='Smart Ride - ESP32 Ultrasonic Serial Bridge')
parser.add_argument('--port', type=str, default=None, help='Serial COM port (e.g. COM3, COM4)')
parser.add_argument('--baud', type=int, default=115200, help='Baud rate (default: 115200)')
parser.add_argument('--server', type=str, default='http://127.0.0.1:5000', help='Flask backend URL')
parser.add_argument('--simulate', action='store_true', help='Simulate ultrasonic sensor distances')
args, _ = parser.parse_known_args()

BACKEND_UPDATE_URL = f'{args.server}/update'

print('=' * 65)
print('SMART RIDE // ESP DEV MODULE ULTRASONIC SENSOR BRIDGE')
print('=' * 65)

try:
    import serial
    import serial.tools.list_ports
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

def find_esp_port():
    if not HAS_SERIAL:
        return None
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None
    for p in ports:
        desc = p.description.lower()
        if 'ch340' in desc or 'cp210' in desc or 'usb' in desc or 'uart' in desc or 'esp' in desc:
            return p.device
    return ports[0].device

def send_distance_to_backend(distance_cm):
    try:
        r = requests.post(BACKEND_UPDATE_URL, json={'distance': float(distance_cm)}, timeout=0.5)
        return r.status_code == 200
    except Exception:
        return False

def extract_distance(line):
    match = re.search(r'[-+]?\d*\.?\d+', line)
    if match:
        try:
            val = float(match.group())
            if 0 <= val <= 500:
                return val
        except ValueError:
            pass
    return None

def run_simulation():
    print('
Running in SIMULATION Mode...')
    print('Sending changing ultrasonic obstacle distance to website (Ctrl+C to stop)...
')
    dist = 120.0
    direction = -2.5
    try:
        while True:
            dist += direction
            if dist <= 10.0:
                direction = 3.0
            elif dist >= 150.0:
                direction = -3.0
            d_val = round(dist, 1)
            ok = send_distance_to_backend(d_val)
            status = 'OK' if ok else 'Flask Offline'
            print(f'[SIMULATOR] Nearest Obstacle: {d_val:>5.1f} cm -> Backend: {status}', end='', flush=True)
            time.sleep(0.3)
    except KeyboardInterrupt:
        print('
Simulator stopped.')

def run_serial(port_name):
    print(f'
Connecting to Serial Port: {port_name} at {args.baud} baud...')
    try:
        ser = serial.Serial(port_name, args.baud, timeout=1.0)
        time.sleep(1.5)
        print(f'Connected to {port_name}! Reading live ultrasonic distance...
')
        while True:
            raw_line = ser.readline().decode('utf-8', errors='ignore').strip()
            if raw_line:
                dist = extract_distance(raw_line)
                if dist is not None:
                    send_distance_to_backend(dist)
                    print(f'[ESP DEV MODULE] Nearest Obstacle: {dist:.1f} cm (Sent to Website OK)', end='', flush=True)
                else:
                    print(f'
[ESP DEV MODULE]: {raw_line}')
    except Exception as e:
        print(f'
Serial Error on {port_name}: {e}')
        print('Falling back to Interactive Terminal Mode...')
        run_terminal_interactive()

def run_terminal_interactive():
    print('
INTERACTIVE TERMINAL INPUT MODE:')
    print('Type any distance in cm (e.g. 25, 45.5, 12) and press Enter to send to website:')
    print('Type sim to start auto simulation, or exit to quit.
')
    try:
        while True:
            user_input = input('Enter Obstacle Distance (cm) > ').strip()
            if not user_input:
                continue
            if user_input.lower() in ['exit', 'quit', 'q']:
                break
            if user_input.lower() == 'sim':
                run_simulation()
                break
            dist = extract_distance(user_input)
            if dist is not None:
                ok = send_distance_to_backend(dist)
                if ok:
                    print(f'Sent {dist:.1f} cm to website telemetry dashboard!')
                else:
                    print(f'Could not reach Flask backend at {BACKEND_UPDATE_URL}. Is server.py running?')
            else:
                print('Invalid number. Please enter a valid distance (e.g. 35.5).')
    except KeyboardInterrupt:
        print('
Exiting...')

if args.simulate:
    run_simulation()
else:
    active_port = args.port or find_esp_port()
    if HAS_SERIAL and active_port:
        run_serial(active_port)
    else:
        if not HAS_SERIAL:
            print('pyserial library not found (run pip install pyserial for USB serial).')
        else:
            print('No active USB Serial Port found for ESP Dev Module.')
        run_terminal_interactive()