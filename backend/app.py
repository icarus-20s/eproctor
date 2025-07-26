import sqlite3
import bcrypt
import os
from datetime import datetime
import json
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from PIL import Image
import io
from ultralytics import YOLO
from flask import send_from_directory
import torch
import dlib



# Load face detector and predictor
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("./models/shape_predictor_68_face_landmarks.dat")
# Load the YOLOv8 face model
yolo_model = YOLO("./models/detect/train11/weights/best.pt")  # Update path if needed

# 3D model points
model_points = np.array([
    (0.0, 0.0, 0.0),             # Nose tip
    (0.0, -330.0, -65.0),        # Chin
    (-225.0, 170.0, -135.0),     # Left eye left corner
    (225.0, 170.0, -135.0),      # Right eye right corner
    (-150.0, -150.0, -125.0),    # Left mouth corner
    (150.0, -150.0, -125.0)      # Right mouth corner
])


app = Flask(__name__ )
CORS(app)  # Enable CORS
print(cv2.__version__)
# Load the Haar cascade for face detection
# Specify the path to the Haar cascade manually
HAAR_CASCADE_PATH = 'haarcascade_frontalface_default.xml'  # Update this path
face_cascade = cv2.CascadeClassifier(HAAR_CASCADE_PATH)

# Thresholds and constants
TURN_THRESHOLD = 50  # pixels for face turn detection
EAR_THRESHOLD = 0.23  # eye aspect ratio threshold for blink
NO_FACE_TIMEOUT = 3  # seconds to consider face disappeared

# Function to create a connection to the database
def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

# User and Test table creation if they don't exist
def create_tables():
    conn = get_db_connection()
    
    # Users table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password BLOB NOT NULL,
            salt BLOB NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    
    # Tests table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_code TEXT UNIQUE NOT NULL,
            questions TEXT NOT NULL,
            timer INTEGER NOT NULL,
            is_test_started BOOLEAN NOT NULL
        )
    ''')

    # User test sessions table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_test_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            test_id INTEGER NOT NULL,
            answers TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            session_login TEXT NOT NULL,
            FOREIGN KEY (test_id) REFERENCES tests (id)
        )
    ''')

    # Suspicious activity logs
    conn.execute('''
        CREATE TABLE IF NOT EXISTS suspicious_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            test_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            frame_path TEXT,
            FOREIGN KEY (test_id) REFERENCES tests (id)
        )
    ''')
    
    conn.commit()
    conn.close()


# Role-based access control decorator
def role_required(role):
    """Decorator to check user role."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get('Authorization')  # Assuming a token is sent with the request
            if token is None or not token.startswith('Bearer '):
                return jsonify({"message": "Missing or invalid token."}), 403

            user_info = decode_token(token)  # Implement your token decoding logic here
            if user_info['role'] != role:
                return jsonify({"message": "Access denied."}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE LOWER(username) = ?', (username,)).fetchone()
    print(user)  # See if the users table contains data
    conn.close()
    if user:
        # Append the salt to the password and hash it
        salt = user['salt']
        salted_password = password.encode('utf-8') + salt
        if bcrypt.checkpw(salted_password, user['password']):
            # Generate a token with the user's info, including their role
            token = generate_token(username, user['role'])  # Implement your token generation logic here
            print(token)
            return jsonify({"message": "Login successful!","token": token}), 200

    return jsonify({"message": "Invalid username or password."}), 401



def analyze_head_orientation(face_rect, image_shape):
    # Get the face rectangle
    x, y, w, h = face_rect

    # Calculate the center of the face
    face_center_x = x + w // 2
    face_center_y = y + h // 2

    # Determine if the face is within the threshold of the center of the frame
    frame_center_x = image_shape[1] // 2
    distance_from_center = abs(face_center_x - frame_center_x)

    if distance_from_center > TURN_THRESHOLD:
        return "Face Turned Away"
    else:
        return "Facing Camera"


face_disappearance_tracker = {}
@app.route('/face-orientation', methods=['POST'])
def face_orientation():
    if 'frame' not in request.files:
        return jsonify({"error": "No frame provided"}), 400
    username = request.form.get('username')
    test_id = int(request.form.get('test_id'))
    # Create unique key for this user-test combination
    user_test_key = f"{username}_{test_id}"

    # Get the frame (image) from the request
    frame_file = request.files['frame']
    print(frame_file.filename)  # Debugging line to check the filename
    frame = np.array(Image.open(io.BytesIO(frame_file.read())))

    # Convert the image to grayscale
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # YOLO face detection
    yolo_faces = yolo_model(frame)[0]
    faces = []
    for box in yolo_faces.boxes:
        if int(box.cls[0]) == 0:  # class = 0 is for face
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
            faces.append((x, y, w, h))
            print("detected by yolo")

    # Detect faces using Haar Cascade if yolo fails
    if len(faces) == 0:
        print("No face from YOLO — falling back to Haarcascade")
        faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    current_time = datetime.now()
    
    # Handle face detection results
    if len(faces) == 0:
        # No face detected
        if user_test_key not in face_disappearance_tracker:
            # First time no face detected - start tracking
            face_disappearance_tracker[user_test_key] = current_time
        else:
            # Check if 3 seconds have passed since face disappeared
            time_diff = (current_time - face_disappearance_tracker[user_test_key]).total_seconds()
            if time_diff >= 3:
                # Log suspicious event - face missing for 3+ seconds
                log_suspicious_event(username, test_id, "No Face Detected", frame)
                # Reset tracker to avoid continuous logging
                face_disappearance_tracker[user_test_key] = current_time
        
        orientation_status = "No Face Detected"
    else:
        # Face(s) detected - reset tracker
        if user_test_key in face_disappearance_tracker:
            del face_disappearance_tracker[user_test_key]
        
        # Check for multiple faces
        if len(faces) > 1:
            log_suspicious_event(username, test_id, "Multiple Faces Detected", frame)
            orientation_status = "Multiple Faces Detected"
        else:
            # Single face detected - check orientation
            face_rect = faces[0]
            orientation_status = analyze_head_orientation(face_rect, frame.shape)
            
            if orientation_status == "Face Turned Away":
                log_suspicious_event(username, test_id, "Face Turned Away", frame)

    return jsonify({
        "status": orientation_status,
        "face_count": len(faces),
        "timestamp": current_time.strftime('%Y-%m-%d %H:%M:%S')
    })



@app.route('/get-all-tests', methods=['GET'])
def get_all_tests():
    conn = get_db_connection()
    
    # Fetch all tests
    tests_query = '''
        SELECT test_code, is_test_started
        FROM tests
    '''
    tests = conn.execute(tests_query).fetchall()
    conn.close()
    
    # Convert tests to a list of dictionaries
    tests_data = []
    for test in tests:
        tests_data.append({
            'test_code': test['test_code'],
            'is_test_started': test['is_test_started']
        })
    
    return jsonify(tests_data), 200

@app.route('/start-test', methods=['POST'])
def start_test():
    data = request.get_json()
    test_code = data.get('testCode')
    
    conn = get_db_connection()
    conn.execute('UPDATE tests SET is_test_started = ? WHERE test_code = ?', (True, test_code))
    conn.commit()
    conn.close()

    return jsonify({"message": "Test started successfully."}), 200

@app.route('/end-test', methods=['POST'])
def end_test():
    data = request.get_json()
    test_code = data.get('testCode')
    
    conn = get_db_connection()
    conn.execute('UPDATE tests SET is_test_started = ? WHERE test_code = ?', (False, test_code))
    conn.commit()
    conn.close()

    return jsonify({"message": "Test ended successfully."}), 200

@app.route('/submit-test', methods=['POST'])
def submit_test():
    data = request.get_json()
    username = data.get('username')
    test_code = data.get('test_id')  # the frontend sends test_code here as test_id
    answers = data.get('answers')
    ip_address = request.remote_addr
    session_login = data.get('session_login')

    conn = get_db_connection()
    # Convert test_code to test_id (numeric)
    test = conn.execute('SELECT id FROM tests WHERE test_code = ?', (test_code,)).fetchone()
    if not test:
        conn.close()
        return jsonify({"error": "Test not found"}), 404

    test_id = test['id']

    conn.execute('''
        INSERT INTO user_test_sessions (username, test_id, answers, ip_address, session_login)
        VALUES (?, ?, ?, ?, ?)
    ''', (username, test_id, json.dumps(answers), ip_address, session_login))

    conn.commit()
    conn.close()
    
    return jsonify({"message": "Test submitted successfully."}), 201

@app.route('/get-test-data/<test_code>', methods=['GET'])
def get_test_data(test_code):
    conn = get_db_connection()

    # Query the test based on test_code
    test_query = '''
        SELECT test_code, questions, timer, is_test_started
        FROM tests
        WHERE test_code = ?
    '''
    test = conn.execute(test_query, (test_code,)).fetchone()
    conn.close()
    if test:
        # Parse the questions JSON string to a Python list
        questions = json.loads(test['questions'])

        # Prepare and return the response as JSON
        test_data = {
            'test_code': test['test_code'],
            'questions': questions,  # This will now be a list of question dictionaries
            'timer': test['timer'],
            'is_test_started': test['is_test_started']
        }
        return jsonify(test_data)
    else:
        return jsonify({'error': 'Test not found'}), 404


@app.route('/admin', methods=['GET'])
def admin_dashboard():
    return jsonify({"message": "Welcome to the Admin Dashboard!"})


@app.route('/user/dashboard', methods=['GET'])
def user_dashboard():
    return jsonify({"message": "Welcome to the User Dashboard!"})

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')  # Default role is 'user'

    conn = get_db_connection()

    # Check if username already exists
    existing_user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if existing_user:
        conn.close()
        return jsonify({"message": "Username already exists.",}), 400

    # Generate a random salt
    salt = os.urandom(16)  # 16 bytes of random salt

    # Salt and hash the password
    salted_password = password.encode('utf-8') + salt
    hashed_password = bcrypt.hashpw(salted_password, bcrypt.gensalt())

    # Insert the new user into the database
    conn.execute('INSERT INTO users (username, password, salt, role) VALUES (?, ?, ?, ?)',
                 (username, hashed_password, salt, role))
    conn.commit()
    conn.close()

    return jsonify({"message": "User registered successfully.","role": role}), 201

# Create a test
@app.route('/create-test', methods=['POST'])
def create_test():
    data = request.get_json()
    test_code = data.get('testCode')
    questions = data.get('questions')
    timer = data.get('timer')

    conn = get_db_connection()
    # Check if test code already exists
    existing_test = conn.execute('SELECT * FROM tests WHERE test_code = ?', (test_code,)).fetchone()
    if existing_test:
        conn.close()
        return jsonify({"message": "Test code already exists."}), 400
    json_question = json.dumps(questions)
    # Insert new test into database
    conn.execute('INSERT INTO tests (test_code, questions, timer, is_test_started) VALUES (?, ?, ?, ?)',
                 (test_code, json_question, timer, False))
    conn.commit()
    conn.close()

    return jsonify({"message": "Test created successfully."}), 201

@app.route('/get-user-sessions', methods=['GET'])
def get_user_sessions():
    conn = get_db_connection()
    
    # Fetch username, ip_address, and session_login from user_test_sessions
    sessions_query = '''
        SELECT username, ip_address, session_login
        FROM user_test_sessions
    '''
    sessions = conn.execute(sessions_query).fetchall()
    conn.close()
    
    # Convert sessions to a list of dictionaries
    sessions_data = []
    for session in sessions:
        sessions_data.append({
            'username': session['username'],
            'ip_address': session['ip_address'],
            'session_login': session['session_login']
        })
    
    # Return the data as a JSON response
    return jsonify(sessions_data), 200

# Reset test (update questions and timer)
@app.route('/reset-test', methods=['POST'])
@role_required('admin')  # Only admin can reset tests
def reset_test():
    data = request.get_json()
    test_code = data.get('testCode')
    new_questions = data.get('questions')
    new_timer = data.get('timer')

    conn = get_db_connection()
    test = conn.execute('SELECT * FROM tests WHERE test_code = ?', (test_code,)).fetchone()

    if not test:
        conn.close()
        return jsonify({"message": "Test not found."}), 404

    conn.execute('UPDATE tests SET questions = ?, timer = ?, is_test_started = ? WHERE test_code = ?',
                 (new_questions, new_timer, False, test_code))
    conn.commit()
    conn.close()

    return jsonify({"message": "Test reset successfully."}), 200

def generate_token(username, role):
    # Implement token generation logic (e.g., JWT)
    return f"Bearer {username}-token"

def decode_token(token):
    # Implement token decoding logic (e.g., JWT)
    username, role = token.split('-token')
    return {'username': username, 'role': 'admin' if username == 'admin' else 'user'}


import uuid
@app.route('/logs/<path:path>')
def serve_log_image(path):
    return send_from_directory('logs', path)


def log_suspicious_event(username, test_id, event_type, frame_np_array):
    if not username or not isinstance(test_id, int) or not event_type or frame_np_array is None:
        print(f"[ERROR] Invalid log input: username={username}, test_id={test_id}, event_type={event_type}")
        return

    try:
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S-%f')
        unique_id = uuid.uuid4().hex[:8]
        
        # Define structured path: logs/username/test_<id>/eventname_timestamp_uid.jpg
        base_log_dir = 'logs'
        event_name = event_type.replace(" ", "_").lower()
        folder_path = os.path.join(base_log_dir, f"test_{test_id}", username)
        os.makedirs(folder_path, exist_ok=True)
        filename = f"{event_name}_{timestamp}_{unique_id}.jpg"
        full_path = os.path.join(folder_path, filename)

        # Save image
        frame_image = Image.fromarray(frame_np_array)
        frame_image.save(full_path)

        # Relative path for DB
        relative_path = os.path.relpath(full_path, base_log_dir)

        # Log to DB
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO suspicious_events (username, test_id, timestamp, event_type, frame_path)
            VALUES (?, ?, ?, ?, ?)
        ''', (username, test_id, timestamp, event_type, relative_path))
        conn.commit()
        conn.close()

        print(f"[INFO] Logged: {event_type} | User: {username} | Test: {test_id} | Path: {relative_path}")

    except Exception as e:
        print(f"[ERROR] Logging failed: {e}")


@app.route('/review-logs')
def review_logs():
    username = request.args.get('username')
    test_id = request.args.get('test_id')

    query = 'SELECT * FROM suspicious_events WHERE 1=1'
    params = []

    if username:
        query += ' AND username = ?'
        params.append(username)

    if test_id:
        query += ' AND test_id = ?'
        params.append(int(test_id))

    query += ' ORDER BY timestamp DESC'

    conn = get_db_connection()
    logs = conn.execute(query, params).fetchall()
    conn.close()

    html = '<h2>Suspicious Event Logs</h2><ul>'
    for log in logs:
        html += f"<li><b>{log['timestamp']}</b> | {log['username']} | Test {log['test_id']} | {log['event_type']}<br>"
        html += f"<img src='/logs/{log['frame_path']}' width='320'/>"
        html += '</li>'
    html += '</ul>'
    return html

@app.route('/get-logs-json')
def get_logs_json():
    username = request.args.get('username')
    test_id = request.args.get('test_id')

    query = 'SELECT * FROM suspicious_events WHERE 1=1'
    params = []

    if username:
        query += ' AND username = ?'
        params.append(username)

    if test_id:
        query += ' AND test_id = ?'
        params.append(int(test_id))

    query += ' ORDER BY timestamp DESC'

    conn = get_db_connection()
    cursor = conn.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    logs = [dict(row) for row in rows]
    return jsonify(logs)

@app.route('/logs/<path:filename>')
def get_log_image(filename):
    logs_folder = os.path.join(app.root_path, 'logs')
    print(f"Serving file from: {logs_folder}, file requested: {filename}")
    return send_from_directory(logs_folder, filename)

@app.route('/delete-test', methods=['DELETE'])
def delete_test():
    print("[DEBUG] Delete test route hit!")
    data = request.get_json()
    test_code = data.get('testCode')

    if not test_code:
        return jsonify({"message": "Missing test code."}), 400

    conn = get_db_connection()

    test = conn.execute('SELECT id FROM tests WHERE test_code = ?', (test_code,)).fetchone()

    if not test:
        conn.close()
        return jsonify({"message": "Test not found."}), 404

    test_id = test['id']

    conn.execute('DELETE FROM user_test_sessions WHERE test_id = ?', (test_id,))

    conn.execute('DELETE FROM suspicious_events WHERE test_id = ?', (test_id,))

    conn.execute('DELETE FROM tests WHERE id = ?', (test_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Test deleted successfully."}), 200


@app.route('/delete-user-from-test', methods=['DELETE'])
def delete_user_from_test():
    data = request.get_json()
    username = data.get('username')
    test_code = data.get('testCode')
    print(test_code ,username)

    if not username or not test_code:
        return jsonify({"message": "Missing username or test code."}), 400

    try:
        test_code = int(test_code)
    except ValueError:
        return jsonify({"message": "Invalid test code format."}), 400

    conn = get_db_connection()

    # Get test_id from test_code
    test = conn.execute('SELECT id FROM tests WHERE test_code = ?', (test_code,)).fetchone()
    if not test:
        conn.close()
        return jsonify({"message": "Test not found."}), 404

    test_id = test['id']

    # Check if user exists
    user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"message": "User not found."}), 404

    # Delete user sessions only for that test
    conn.execute('DELETE FROM user_test_sessions WHERE username = ? AND test_id = ?', (username, test_id))

    # Delete suspicious events only for that test
    conn.execute('DELETE FROM suspicious_events WHERE username = ? AND test_id = ?', (username, test_id))

    conn.commit()
    conn.close()

    return jsonify({"message": f"User {username} removed from test {test_code}."}), 200

@app.route('/detect-eye', methods=['POST'])
def detect_eye():
    if 'frame' not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    username = request.form.get('username')
    test_id = int(request.form.get('test_id'))
    user_test_key = f"{username}_{test_id}"

    # Load frame from request
    frame_file = request.files['frame']
    frame = np.array(Image.open(io.BytesIO(frame_file.read())))
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # YOLO face detection
    yolo_faces = yolo_model(frame)[0]
    faces = []
    for box in yolo_faces.boxes:
        if int(box.cls[0]) == 0:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
            faces.append(dlib.rectangle(x, y, x + w, y + h))

    # Fallback to Haar
    if len(faces) == 0:
        haar_faces = face_cascade.detectMultiScale(gray, 1.1, 5)
        for (x, y, w, h) in haar_faces:
            faces.append(dlib.rectangle(x, y, x + w, y + h))

    current_time = datetime.now()

    if len(faces) == 0:
        if user_test_key not in face_disappearance_tracker:
            face_disappearance_tracker[user_test_key] = current_time
        else:
            time_diff = (current_time - face_disappearance_tracker[user_test_key]).total_seconds()
            if time_diff >= 3:
                log_suspicious_event(username, test_id, "No Face Detected", frame)
                face_disappearance_tracker[user_test_key] = current_time

        return jsonify({
            "status": "No Face Detected",
            "face_count": 0,
            "timestamp": current_time.strftime('%Y-%m-%d %H:%M:%S')
        })

    # Reset disappearance tracker
    if user_test_key in face_disappearance_tracker:
        del face_disappearance_tracker[user_test_key]

    if len(faces) > 1:
        log_suspicious_event(username, test_id, "Multiple Faces Detected", frame)
        return jsonify({
            "status": "Multiple Faces Detected",
            "face_count": len(faces),
            "timestamp": current_time.strftime('%Y-%m-%d %H:%M:%S')
        })

    # Head pose estimation
    face = faces[0]
    landmarks = predictor(gray, face)

    image_points = np.array([
        (landmarks.part(30).x, landmarks.part(30).y),  # Nose tip
        (landmarks.part(8).x, landmarks.part(8).y),    # Chin
        (landmarks.part(36).x, landmarks.part(36).y),  # Left eye
        (landmarks.part(45).x, landmarks.part(45).y),  # Right eye
        (landmarks.part(48).x, landmarks.part(48).y),  # Left mouth
        (landmarks.part(54).x, landmarks.part(54).y)   # Right mouth
    ], dtype="double")

    size = frame.shape
    focal_length = size[1]
    center = (size[1] / 2, size[0] / 2)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1]
    ], dtype="double")
    dist_coeffs = np.zeros((4, 1))

    success, rotation_vector, translation_vector = cv2.solvePnP(
        model_points, image_points, camera_matrix, dist_coeffs
    )

    (nose_end_point2D, _) = cv2.projectPoints(
        np.array([(0.0, 0.0, 1000.0)]),
        rotation_vector, translation_vector, camera_matrix, dist_coeffs
    )

    nose_tip = image_points[0]
    nose_proj = nose_end_point2D[0][0]
    dx = nose_proj[0] - nose_tip[0]
    dy = nose_proj[1] - nose_tip[1]

    if dx > 50:
        head_direction = "Looking Right"
    elif dx < -50:
        head_direction = "Looking Left"
    elif dy > 50:
        head_direction = "Looking Down"
    else:
        head_direction = "Looking Center"

    if head_direction != "Looking Center":
        log_suspicious_event(username, test_id, f"{head_direction} (Head Pose)", frame)

    return jsonify({
        "status": head_direction,
        "nose_tip": nose_tip.tolist(),
        "rotation_vector": rotation_vector.ravel().tolist(),
        "eye_positions": {
            "left_eye": [landmarks.part(36).x, landmarks.part(36).y],
            "right_eye": [landmarks.part(45).x, landmarks.part(45).y]
        },
        "timestamp": current_time.strftime('%Y-%m-%d %H:%M:%S'),
        "face_count": 1
    })

@app.route('/test/<test_code>/users', methods=['GET'])
def get_users_by_test_code(test_code):
    conn = get_db_connection()

    test = conn.execute('SELECT id FROM tests WHERE test_code = ?', (test_code,)).fetchone()
    if not test:
        conn.close()
        return jsonify({"error": "Test not found."}), 404

    test_id = test['id']

    users = conn.execute('''
        SELECT DISTINCT username
        FROM user_test_sessions
        WHERE test_id = ?
    ''', (test_id,)).fetchall()

    conn.close()

    user_list = [u['username'] for u in users]
    result ={
        "test_code": test_code,
        "user_count": len(user_list),
        "users": user_list
    }
    print(result)

    return jsonify(result), 200




if __name__ == '__main__':
    create_tables() 
    app.run(debug=True)