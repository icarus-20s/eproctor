import os
import uuid
import base64
import json
import sqlite3
import logging
from datetime import datetime
from functools import wraps

import bcrypt
import cv2
import dlib
import numpy as np
from ultralytics import YOLO

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit

# -----------------------------------------------------------------------------
# Configuration & constants
# -----------------------------------------------------------------------------

DB_PATH = "users.db"
LOGS_DIR = "logs"
HAAR_CASCADE_PATH = "haarcascade_frontalface_default.xml"
SHAPE_PREDICTOR_PATH = "./models/shape_predictor_68_face_landmarks.dat"
YOLO_MODEL_PATH = "./models/all_model.pt"

# YOLO class IDs (must match your model)
CLASS_ID_FACE = 0
CLASS_ID_BOOK = 1
CLASS_ID_PHONE = 2

# Thresholds
TURN_THRESHOLD_PX = 50          # horizontal offset from center for "Face Turned Away"
NO_FACE_TIMEOUT_SECONDS = 3     # time before logging "No Face Detected"
HEAD_POSE_DX_THRESHOLD = 50     # horizontal threshold for head pose (looking left/right)
HEAD_POSE_DY_THRESHOLD = 50     # vertical threshold for head pose (looking down)
EAR_THRESHOLD = 0.23            # reserved if you later add blink detection

# Exam session policy
MAX_OFFLINE_SECONDS = 300       # maximum allowed offline time (5 minutes)

# 3D model points for head pose estimation
MODEL_3D_POINTS = np.array([
    (0.0, 0.0, 0.0),             # Nose tip
    (0.0, -330.0, -65.0),        # Chin
    (-225.0, 170.0, -135.0),     # Left eye left corner
    (225.0, 170.0, -135.0),      # Right eye right corner
    (-150.0, -150.0, -125.0),    # Left mouth corner
    (150.0, -150.0, -125.0)      # Right mouth corner
])

# -----------------------------------------------------------------------------
# App, Socket.IO, logging setup
# -----------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Global ML objects
# -----------------------------------------------------------------------------

predictor = dlib.shape_predictor(SHAPE_PREDICTOR_PATH)
yolo_model = YOLO(YOLO_MODEL_PATH)
face_cascade = cv2.CascadeClassifier(HAAR_CASCADE_PATH)

# Track face disappearance times per (username, test_id)
face_disappearance_tracker: dict[str, datetime] = {}

# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_tables() -> None:
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password BLOB NOT NULL,
            salt BLOB NOT NULL,
            role TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_code TEXT UNIQUE NOT NULL,
            questions TEXT NOT NULL,
            timer INTEGER NOT NULL,
            is_test_started BOOLEAN NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_test_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            test_id INTEGER NOT NULL,
            answers TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            session_login TEXT NOT NULL,
            FOREIGN KEY (test_id) REFERENCES tests (id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS suspicious_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            test_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            frame_path TEXT,
            FOREIGN KEY (test_id) REFERENCES tests (id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_exam_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            test_id INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            status TEXT NOT NULL,               -- IN_PROGRESS, DISCONNECTED, SUBMITTED, TERMINATED
            remaining_time INTEGER NOT NULL,    -- in seconds
            last_answers TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (test_id) REFERENCES tests (id),
            UNIQUE(username, test_id)
        )
    """)

    conn.commit()
    conn.close()


def update_exam_last_seen(username: str, test_id: int, now: datetime | None = None) -> None:
    """
    Update last_seen for an existing exam session if it's IN_PROGRESS or DISCONNECTED.
    Does nothing if no session exists.
    """
    if now is None:
        now = datetime.now()
    now_iso = now.isoformat()

    conn = get_db_connection()
    conn.execute("""
        UPDATE user_exam_sessions
        SET last_seen = ?
        WHERE username = ? AND test_id = ?
          AND status IN ('IN_PROGRESS', 'DISCONNECTED')
    """, (now_iso, username, test_id))
    conn.commit()
    conn.close()

# -----------------------------------------------------------------------------
# Auth / token helpers
# -----------------------------------------------------------------------------

def generate_token(username: str, role: str) -> str:
    """
    Minimal, non-secure token (base64 JSON).
    Replace with real JWT (e.g. PyJWT) in production.
    """
    payload = {"username": username, "role": role}
    json_bytes = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(json_bytes).decode("utf-8")


def decode_token(auth_header_value: str | None) -> dict:
    """
    Decode token from Authorization header: "Bearer <token>".
    Raises ValueError on failure.
    """
    if not auth_header_value or not auth_header_value.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")
    token = auth_header_value.split(" ", 1)[1]
    try:
        data = json.loads(
            base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        )
        return data
    except Exception as exc:
        raise ValueError(f"Invalid token: {exc}") from exc


def role_required(required_role: str):
    """Decorator to enforce a user role based on our simple token."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            try:
                user_info = decode_token(auth_header)
            except ValueError as exc:
                return jsonify({"message": str(exc)}), 403

            if user_info.get("role") != required_role:
                return jsonify({"message": "Access denied."}), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

# -----------------------------------------------------------------------------
# Utility: image decoding & face-missing tracker
# -----------------------------------------------------------------------------

def decode_base64_image(image_b64: str) -> np.ndarray | None:
    """
    Accepts either raw base64 or data URL (e.g. 'data:image/jpeg;base64,...').
    Returns a BGR OpenCV image (np.ndarray) or None on error.
    """
    try:
        if "," in image_b64:
            _, image_b64 = image_b64.split(",", 1)
        image_bytes = base64.b64decode(image_b64)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        logger.exception("Failed to decode base64 image")
        return None


def update_face_missing_tracker(key: str, now: datetime) -> float | None:
    """
    Update and check the face disappearance tracker.

    Returns:
        diff_seconds (float) if the key already existed,
        or None if this is the first time we've seen "no face".
    """
    last_time = face_disappearance_tracker.get(key)
    if last_time is None:
        face_disappearance_tracker[key] = now
        return None

    diff = (now - last_time).total_seconds()
    if diff >= NO_FACE_TIMEOUT_SECONDS:
        # reset so we don't log every frame
        face_disappearance_tracker[key] = now
    return diff

# -----------------------------------------------------------------------------
# Suspicious event logging
# -----------------------------------------------------------------------------

def log_suspicious_event(username: str, test_id: int, event_type: str, frame_bgr: np.ndarray | None) -> None:
    if not username or frame_bgr is None:
        logger.error(
            "Invalid log input: username=%s, test_id=%s, event_type=%s",
            username, test_id, event_type,
        )
        return

    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S-%f")
        unique_id = uuid.uuid4().hex[:8]

        event_name = event_type.replace(" ", "_").lower()
        folder_path = os.path.join(LOGS_DIR, f"test_{test_id}", username)
        os.makedirs(folder_path, exist_ok=True)

        filename = f"{event_name}_{timestamp}_{unique_id}.jpg"
        full_path = os.path.join(folder_path, filename)

        cv2.imwrite(full_path, frame_bgr)

        relative_path = os.path.relpath(full_path, LOGS_DIR)

        conn = get_db_connection()
        conn.execute("""
            INSERT INTO suspicious_events (username, test_id, timestamp, event_type, frame_path)
            VALUES (?, ?, ?, ?, ?)
        """, (username, test_id, timestamp, event_type, relative_path))
        conn.commit()
        conn.close()

        logger.info(
            "Logged suspicious event: %s | user=%s | test=%s | path=%s",
            event_type, username, test_id, relative_path,
        )
    except Exception:
        logger.exception("Failed to log suspicious event")

# -----------------------------------------------------------------------------
# Detection pipeline (shared by HTTP and WebSocket)
# -----------------------------------------------------------------------------

def detect_all_objects(frame_bgr: np.ndarray):
    """
    Run YOLO once, detect face(s), phone, book. Fall back to Haar for faces.

    Returns:
        face_boxes: list[(x, y, w, h)]
        dlib_rects: list[dlib.rectangle]
        gray: grayscale image
        phone_detected: bool
        book_detected: bool
    """
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    results = yolo_model(frame_bgr)[0]

    face_boxes: list[tuple[int, int, int, int]] = []
    phone_detected = False
    book_detected = False

    for box in results.boxes:
        cls_id = int(box.cls[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

        if cls_id == CLASS_ID_FACE:
            face_boxes.append((x1, y1, x2 - x1, y2 - y1))
        elif cls_id == CLASS_ID_PHONE:
            phone_detected = True
        elif cls_id == CLASS_ID_BOOK:
            book_detected = True

    if not face_boxes:
        # Fallback to Haar cascade for faces only
        haar_faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30),
        )
        face_boxes = [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in haar_faces]

    dlib_rects = [
        dlib.rectangle(x, y, x + w, y + h) for (x, y, w, h) in face_boxes
    ]

    return face_boxes, dlib_rects, gray, phone_detected, book_detected


def run_proctor_checks(username: str, test_id: int, frame_bgr: np.ndarray) -> dict:
    """
    Main proctoring pipeline:
      - Face presence & orientation (center vs turned)
      - Head pose (left/right/down/center) via solvePnP
      - Phone detection
      - Book detection

    Returns a structured dict with all statuses.
    """
    now = datetime.now()
    user_key = f"{username}_{test_id}"

    try:
        update_exam_last_seen(username, test_id, now)
    except Exception:
        logger.exception("Failed to update exam last_seen")

    face_boxes, dlib_rects, gray, phone_detected, book_detected = detect_all_objects(frame_bgr)
    face_count = len(face_boxes)

    # ------------------ Face presence / orientation ------------------
    if face_count == 0:
        diff = update_face_missing_tracker(user_key, now)
        if diff is not None and diff >= NO_FACE_TIMEOUT_SECONDS:
            log_suspicious_event(username, test_id, "No Face Detected", frame_bgr)
        face_status = "No Face Detected"
    else:
        # reset disappearance tracker
        face_disappearance_tracker.pop(user_key, None)

        if face_count > 1:
            log_suspicious_event(username, test_id, "Multiple Faces Detected", frame_bgr)
            face_status = "Multiple Faces Detected"
        else:
            x, y, w, h = face_boxes[0]
            face_center_x = x + w // 2
            frame_center_x = frame_bgr.shape[1] // 2
            distance_from_center = abs(face_center_x - frame_center_x)

            if distance_from_center > TURN_THRESHOLD_PX:
                face_status = "Face Turned Away"
                log_suspicious_event(username, test_id, "Face Turned Away", frame_bgr)
            else:
                face_status = "Facing Camera"

    # ------------------ Head pose (solvePnP) ------------------
    head_pose_status = "Unavailable"
    nose_tip = None
    rotation_vector = None
    eye_positions = None

    if face_count == 1 and dlib_rects:
        try:
            face_rect = dlib_rects[0]
            landmarks = predictor(gray, face_rect)

            image_points = np.array([
                (landmarks.part(30).x, landmarks.part(30).y),  # Nose tip
                (landmarks.part(8).x, landmarks.part(8).y),    # Chin
                (landmarks.part(36).x, landmarks.part(36).y),  # Left eye
                (landmarks.part(45).x, landmarks.part(45).y),  # Right eye
                (landmarks.part(48).x, landmarks.part(48).y),  # Left mouth
                (landmarks.part(54).x, landmarks.part(54).y),  # Right mouth
            ], dtype="double")

            size = frame_bgr.shape
            focal_length = size[1]
            center = (size[1] / 2, size[0] / 2)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1],
            ], dtype="double")

            dist_coeffs = np.zeros((4, 1))

            success, rvec, tvec = cv2.solvePnP(
                MODEL_3D_POINTS, image_points, camera_matrix, dist_coeffs,
            )

            if success:
                nose_end_point2D, _ = cv2.projectPoints(
                    np.array([(0.0, 0.0, 1000.0)]),
                    rvec, tvec, camera_matrix, dist_coeffs,
                )

                nose_tip = image_points[0]
                nose_proj = nose_end_point2D[0][0]
                dx = nose_proj[0] - nose_tip[0]
                dy = nose_proj[1] - nose_tip[1]

                if dx > HEAD_POSE_DX_THRESHOLD:
                    head_pose_status = "Looking Right"
                elif dx < -HEAD_POSE_DX_THRESHOLD:
                    head_pose_status = "Looking Left"
                elif dy > HEAD_POSE_DY_THRESHOLD:
                    head_pose_status = "Looking Down"
                else:
                    head_pose_status = "Looking Center"

                if head_pose_status != "Looking Center":
                    log_suspicious_event(
                        username,
                        test_id,
                        f"{head_pose_status} (Head Pose)",
                        frame_bgr,
                    )

                rotation_vector = rvec.ravel().tolist()
                eye_positions = {
                    "left_eye": [landmarks.part(36).x, landmarks.part(36).y],
                    "right_eye": [landmarks.part(45).x, landmarks.part(45).y],
                }
        except Exception:
            logger.exception("Head pose estimation failed")

    # ------------------ Phone & Book detection ------------------
    phone_status = "Phone Detected" if phone_detected else "No Phone Detected"
    if phone_detected:
        log_suspicious_event(username, test_id, "Phone Detected", frame_bgr)

    book_status = "Book Detected" if book_detected else "No Book Detected"
    if book_detected:
        log_suspicious_event(username, test_id, "Book Detected", frame_bgr)

    # ------------------ Aggregate result ------------------
    result = {
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "face": {
            "status": face_status,
            "face_count": face_count,
        },
        "head_pose": {
            "status": head_pose_status,
            "nose_tip": nose_tip.tolist() if nose_tip is not None else None,
            "rotation_vector": rotation_vector,
            "eye_positions": eye_positions,
        },
        "phone": {
            "status": phone_status,
        },
        "book": {
            "status": book_status,
        },
    }
    return result

# -----------------------------------------------------------------------------
# WebSocket (Socket.IO) endpoints
# -----------------------------------------------------------------------------

@socketio.on("connect", namespace="/proctor")
def ws_connect():
    logger.info("Client connected: %s", request.sid)


@socketio.on("disconnect", namespace="/proctor")
def ws_disconnect():
    logger.info("Client disconnected: %s", request.sid)


@socketio.on("proctor_frame", namespace="/proctor")
def ws_proctor_frame(data):
    """
    WebSocket event to process one video frame.

    Expected payload:
        {
          "username": "alice",
          "test_id": 1,
          "frame": "<base64-encoded image>"
        }

    Emits:
        "proctor_result" with the aggregated detection result.
    """
    try:
        username = data["username"]
        test_id = int(data["test_id"])
        frame_b64 = data["frame"]
    except (KeyError, ValueError, TypeError):
        emit("proctor_error", {"error": "Invalid payload"}, room=request.sid)
        return

    frame_bgr = decode_base64_image(frame_b64)
    if frame_bgr is None:
        emit("proctor_error", {"error": "Could not decode frame"}, room=request.sid)
        return

    result = run_proctor_checks(username, test_id, frame_bgr)
    emit("proctor_result", result, room=request.sid)

# -----------------------------------------------------------------------------
# HTTP endpoints: Auth & user/test management
# -----------------------------------------------------------------------------

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "user")

    if not username or not password:
        return jsonify({"message": "Username and password are required."}), 400

    conn = get_db_connection()
    existing_user = conn.execute(
        "SELECT 1 FROM users WHERE username = ?", (username,),
    ).fetchone()
    if existing_user:
        conn.close()
        return jsonify({"message": "Username already exists."}), 400

    salt = os.urandom(16)
    salted_password = password.encode("utf-8") + salt
    hashed_password = bcrypt.hashpw(salted_password, bcrypt.gensalt())

    conn.execute(
        "INSERT INTO users (username, password, salt, role) VALUES (?, ?, ?, ?)",
        (username, hashed_password, salt, role),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "User registered successfully.", "role": role}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = data.get("username")
    password = data.get("password")

    conn = get_db_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username,),
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({"message": "Invalid username or password."}), 401

    salt = user["salt"]
    salted_password = password.encode("utf-8") + salt

    if bcrypt.checkpw(salted_password, user["password"]):
        token = generate_token(username, user["role"])
        return jsonify({"message": "Login successful!", "token": token}), 200

    return jsonify({"message": "Invalid username or password."}), 401


@app.route("/create-test", methods=["POST"])
def create_test():
    data = request.get_json(force=True)
    test_code = data.get("testCode")
    questions = data.get("questions")
    timer = data.get("timer")

    if not test_code or questions is None or timer is None:
        return jsonify({"message": "Missing test data."}), 400

    conn = get_db_connection()
    existing_test = conn.execute(
        "SELECT 1 FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()
    if existing_test:
        conn.close()
        return jsonify({"message": "Test code already exists."}), 400

    conn.execute(
        "INSERT INTO tests (test_code, questions, timer, is_test_started) "
        "VALUES (?, ?, ?, ?)",
        (test_code, json.dumps(questions), int(timer), False),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Test created successfully."}), 201


@app.route("/get-all-tests", methods=["GET"])
def get_all_tests():
    conn = get_db_connection()
    tests = conn.execute(
        "SELECT test_code, is_test_started FROM tests",
    ).fetchall()
    conn.close()

    data = [
        {"test_code": t["test_code"], "is_test_started": bool(t["is_test_started"])}
        for t in tests
    ]
    return jsonify(data), 200


@app.route("/start-test", methods=["POST"])
def start_test():
    data = request.get_json(force=True)
    test_code = data.get("testCode")

    conn = get_db_connection()
    conn.execute(
        "UPDATE tests SET is_test_started = ? WHERE test_code = ?",
        (True, test_code),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Test started successfully."}), 200


@app.route("/end-test", methods=["POST"])
def end_test():
    data = request.get_json(force=True)
    test_code = data.get("testCode")

    conn = get_db_connection()
    conn.execute(
        "UPDATE tests SET is_test_started = ? WHERE test_code = ?",
        (False, test_code),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Test ended successfully."}), 200


@app.route("/submit-test", methods=["POST"])
def submit_test():
    data = request.get_json(force=True)
    username = data.get("username")
    test_code = data.get("test_id")  # frontend sends test_code here as test_id
    answers = data.get("answers")
    session_login = data.get("session_login")
    ip_address = request.remote_addr

    if not username or not test_code or answers is None:
        return jsonify({"error": "Missing submission data"}), 400

    conn = get_db_connection()
    test = conn.execute(
        "SELECT id FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()
    if not test:
        conn.close()
        return jsonify({"error": "Test not found"}), 404

    test_id = test["id"]

    # Insert final answers into user_test_sessions (existing behavior)
    conn.execute("""
        INSERT INTO user_test_sessions (username, test_id, answers, ip_address, session_login)
        VALUES (?, ?, ?, ?, ?)
    """, (username, test_id, json.dumps(answers), ip_address, session_login))

    # Mark exam session as SUBMITTED, store last_answers
    now_iso = datetime.now().isoformat()
    conn.execute("""
        UPDATE user_exam_sessions
        SET status = ?, last_seen = ?, last_answers = ?
        WHERE username = ? AND test_id = ?
    """, ("SUBMITTED", now_iso, json.dumps(answers), username, test_id))

    conn.commit()
    conn.close()

    return jsonify({"message": "Test submitted successfully."}), 201


@app.route("/get-test-data/<test_code>", methods=["GET"])
def get_test_data(test_code: str):
    conn = get_db_connection()
    test = conn.execute("""
        SELECT test_code, questions, timer, is_test_started
        FROM tests
        WHERE test_code = ?
    """, (test_code,)).fetchone()
    conn.close()

    if not test:
        return jsonify({"error": "Test not found"}), 404

    questions = json.loads(test["questions"])
    data = {
        "test_code": test["test_code"],
        "questions": questions,
        "timer": test["timer"],
        "is_test_started": bool(test["is_test_started"]),
    }
    return jsonify(data), 200


@app.route("/admin", methods=["GET"])
def admin_dashboard():
    return jsonify({"message": "Welcome to the Admin Dashboard!"})


@app.route("/user/dashboard", methods=["GET"])
def user_dashboard():
    return jsonify({"message": "Welcome to the User Dashboard!"})


@app.route("/get-user-sessions", methods=["GET"])
def get_user_sessions():
    conn = get_db_connection()
    sessions = conn.execute("""
        SELECT username, ip_address, session_login
        FROM user_test_sessions
    """).fetchall()
    conn.close()

    data = [
        {
            "username": s["username"],
            "ip_address": s["ip_address"],
            "session_login": s["session_login"],
        }
        for s in sessions
    ]
    return jsonify(data), 200


@app.route("/reset-test", methods=["POST"])
@role_required("admin")
def reset_test():
    data = request.get_json(force=True)
    test_code = data.get("testCode")
    new_questions = data.get("questions")
    new_timer = data.get("timer")

    conn = get_db_connection()
    test = conn.execute(
        "SELECT * FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()

    if not test:
        conn.close()
        return jsonify({"message": "Test not found."}), 404

    conn.execute("""
        UPDATE tests
        SET questions = ?, timer = ?, is_test_started = ?
        WHERE test_code = ?
    """, (json.dumps(new_questions), int(new_timer), False, test_code))
    conn.commit()
    conn.close()

    return jsonify({"message": "Test reset successfully."}), 200


@app.route("/test/<test_code>/users", methods=["GET"])
def get_users_by_test_code(test_code: str):
    conn = get_db_connection()
    test = conn.execute(
        "SELECT id FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()
    if not test:
        conn.close()
        return jsonify({"error": "Test not found."}), 404

    test_id = test["id"]
    users = conn.execute("""
        SELECT DISTINCT username
        FROM user_test_sessions
        WHERE test_id = ?
    """, (test_id,)).fetchall()
    conn.close()

    user_list = [u["username"] for u in users]
    result = {
        "test_code": test_code,
        "user_count": len(user_list),
        "users": user_list,
    }
    return jsonify(result), 200


@app.route("/delete-test", methods=["DELETE"])
def delete_test():
    data = request.get_json(force=True)
    test_code = data.get("testCode")

    if not test_code:
        return jsonify({"message": "Missing test code."}), 400

    conn = get_db_connection()
    test = conn.execute(
        "SELECT id FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()

    if not test:
        conn.close()
        return jsonify({"message": "Test not found."}), 404

    test_id = test["id"]

    conn.execute("DELETE FROM user_test_sessions WHERE test_id = ?", (test_id,))
    conn.execute("DELETE FROM suspicious_events WHERE test_id = ?", (test_id,))
    conn.execute("DELETE FROM user_exam_sessions WHERE test_id = ?", (test_id,))
    conn.execute("DELETE FROM tests WHERE id = ?", (test_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Test deleted successfully."}), 200


@app.route("/delete-user-from-test", methods=["DELETE"])
def delete_user_from_test():
    data = request.get_json(force=True)
    username = data.get("username")
    test_code = data.get("testCode")

    if not username or not test_code:
        return jsonify({"message": "Missing username or test code."}), 400

    conn = get_db_connection()

    test = conn.execute(
        "SELECT id FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()
    if not test:
        conn.close()
        return jsonify({"message": "Test not found."}), 404

    test_id = test["id"]

    user = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,),
    ).fetchone()
    if not user:
        conn.close()
        return jsonify({"message": "User not found."}), 404

    conn.execute("""
        DELETE FROM user_test_sessions
        WHERE username = ? AND test_id = ?
    """, (username, test_id))

    conn.execute("""
        DELETE FROM suspicious_events
        WHERE username = ? AND test_id = ?
    """, (username, test_id))

    conn.execute("""
        DELETE FROM user_exam_sessions
        WHERE username = ? AND test_id = ?
    """, (username, test_id))

    conn.commit()
    conn.close()

    return jsonify({"message": f"User {username} removed from test {test_code}."}), 200

# -----------------------------------------------------------------------------
# Logs: view, JSON, delete, and serve images
# -----------------------------------------------------------------------------

@app.route("/review-logs")
def review_logs():
    username = request.args.get("username")
    test_id = request.args.get("test_id")

    query = "SELECT * FROM suspicious_events WHERE 1=1"
    params: list = []

    if username:
        query += " AND username = ?"
        params.append(username)
    if test_id:
        query += " AND test_id = ?"
        params.append(int(test_id))

    query += " ORDER BY timestamp DESC"

    conn = get_db_connection()
    logs = conn.execute(query, params).fetchall()
    conn.close()

    html = "<h2>Suspicious Event Logs</h2><ul>"
    for log in logs:
        html += (
            f"<li><b>{log['timestamp']}</b> | {log['username']} | "
            f"Test {log['test_id']} | {log['event_type']}<br>"
            f"<img src='/logs/{log['frame_path']}' width='320'/></li>"
        )
    html += "</ul>"
    return html


@app.route("/get-logs-json")
def get_logs_json():
    username = request.args.get("username")
    test_id = request.args.get("test_id")

    query = "SELECT * FROM suspicious_events WHERE 1=1"
    params: list = []

    if username:
        query += " AND username = ?"
        params.append(username)
    if test_id:
        query += " AND test_id = ?"
        params.append(int(test_id))

    query += " ORDER BY timestamp DESC"

    conn = get_db_connection()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    logs = [dict(row) for row in rows]
    return jsonify(logs), 200


@app.route("/delete-logs", methods=["DELETE"])
def delete_logs():
    conn = get_db_connection()
    conn.execute("DELETE FROM suspicious_events")
    conn.commit()
    conn.close()
    return jsonify({"status": "all logs deleted"}), 200


@app.route("/logs/<path:filename>")
def get_log_image(filename: str):
    return send_from_directory(LOGS_DIR, filename)

# -----------------------------------------------------------------------------
# Exam autosave / resume
# -----------------------------------------------------------------------------

@app.route("/autosave-test", methods=["POST"])
def autosave_test():
    """
    Auto-save partial answers and remaining time.

    Expected JSON:
    {
        "username": "alice",
        "test_code": "TEST123",
        "answers": { ... },             # partial or full answers
        "remaining_time": 1234          # seconds
    }
    """
    data = request.get_json(force=True)
    username = data.get("username")
    test_code = data.get("test_code")
    answers = data.get("answers") or {}
    remaining_time = data.get("remaining_time")

    if not username or not test_code or remaining_time is None:
        return jsonify({"error": "Missing autosave data"}), 400

    conn = get_db_connection()
    test = conn.execute(
        "SELECT id, timer FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()
    if not test:
        conn.close()
        return jsonify({"error": "Test not found"}), 404

    test_id = test["id"]
    now = datetime.now()
    now_iso = now.isoformat()

    conn.execute("""
        INSERT INTO user_exam_sessions (
            username, test_id, start_time, last_seen, status, remaining_time, last_answers
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(username, test_id) DO UPDATE SET
            last_seen = excluded.last_seen,
            remaining_time = excluded.remaining_time,
            last_answers = excluded.last_answers
    """, (
        username,
        test_id,
        now_iso,            # start_time (for first insert)
        now_iso,            # last_seen
        "IN_PROGRESS",      # status on first insert
        int(remaining_time),
        json.dumps(answers),
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Autosave successful."}), 200


@app.route("/resume-test", methods=["POST"])
def resume_test():
    """
    Resume an interrupted exam session.

    Expected JSON:
    {
        "username": "alice",
        "test_code": "TEST123"
    }

    Response on success:
    {
        "allowed": true,
        "remaining_time": 900,            # seconds
        "last_answers": { ... },
        "status": "IN_PROGRESS"
    }
    """
    data = request.get_json(force=True)
    username = data.get("username")
    test_code = data.get("test_code")

    if not username or not test_code:
        return jsonify({"error": "Missing username or test_code"}), 400

    conn = get_db_connection()
    test = conn.execute(
        "SELECT id, timer FROM tests WHERE test_code = ?", (test_code,),
    ).fetchone()
    if not test:
        conn.close()
        return jsonify({"error": "Test not found"}), 404

    test_id = test["id"]

    session = conn.execute("""
        SELECT * FROM user_exam_sessions
        WHERE username = ? AND test_id = ?
    """, (username, test_id)).fetchone()

    if not session:
        conn.close()
        return jsonify({"error": "No existing exam session."}), 404

    status = session["status"]
    if status in ("SUBMITTED", "TERMINATED"):
        conn.close()
        return jsonify({
            "allowed": False,
            "reason": f"Exam already {status.lower()}.",
        }), 403

    # Compute offline duration
    try:
        last_seen = datetime.fromisoformat(session["last_seen"])
    except Exception:
        last_seen = datetime.now()

    now = datetime.now()
    offline_seconds = max((now - last_seen).total_seconds(), 0)

    remaining_time = int(session["remaining_time"])
    # Timer continues running while offline
    if offline_seconds > 0:
        remaining_time = max(remaining_time - int(offline_seconds), 0)

    # If offline too long or time expired, terminate
    if offline_seconds > MAX_OFFLINE_SECONDS or remaining_time <= 0:
        conn.execute("""
            UPDATE user_exam_sessions
            SET status = ?, remaining_time = ?
            WHERE username = ? AND test_id = ?
        """, ("TERMINATED", remaining_time, username, test_id))
        conn.commit()
        conn.close()

        return jsonify({
            "allowed": False,
            "reason": "Exam time expired or you were offline too long.",
        }), 403

    # Allowed to resume
    now_iso = now.isoformat()
    conn.execute("""
        UPDATE user_exam_sessions
        SET last_seen = ?, remaining_time = ?, status = ?
        WHERE username = ? AND test_id = ?
    """, (now_iso, remaining_time, "IN_PROGRESS", username, test_id))
    conn.commit()

    last_answers_raw = session["last_answers"] or "{}"
    try:
        last_answers = json.loads(last_answers_raw)
    except Exception:
        last_answers = {}

    conn.close()

    return jsonify({
        "allowed": True,
        "remaining_time": remaining_time,
        "last_answers": last_answers,
        "status": "IN_PROGRESS",
    }), 200

# -----------------------------------------------------------------------------
# Optional: legacy HTTP endpoints for single detections (reuse pipeline)
# -----------------------------------------------------------------------------

@app.route("/face-orientation", methods=["POST"])
def http_face_orientation():
    if "frame" not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    username = request.form.get("username")
    test_id = request.form.get("test_id")

    if not username or not test_id:
        return jsonify({"error": "Missing username or test_id"}), 400

    try:
        test_id_int = int(test_id)
    except ValueError:
        return jsonify({"error": "Invalid test_id"}), 400

    file = request.files["frame"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    frame_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    result = run_proctor_checks(username, test_id_int, frame_bgr)
    face_result = result["face"]
    face_result["timestamp"] = result["timestamp"]
    return jsonify(face_result), 200


@app.route("/detect-eye", methods=["POST"])
def http_detect_eye():
    if "frame" not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    username = request.form.get("username")
    test_id = request.form.get("test_id")

    if not username or not test_id:
        return jsonify({"error": "Missing username or test_id"}), 400

    try:
        test_id_int = int(test_id)
    except ValueError:
        return jsonify({"error": "Invalid test_id"}), 400

    file = request.files["frame"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    frame_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    result = run_proctor_checks(username, test_id_int, frame_bgr)
    head_pose = result["head_pose"]
    head_pose["timestamp"] = result["timestamp"]
    head_pose["face_count"] = result["face"]["face_count"]
    return jsonify(head_pose), 200


@app.route("/detect-phone", methods=["POST"])
def http_detect_phone():
    if "frame" not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    username = request.form.get("username")
    test_id = request.form.get("test_id")

    if not username or not test_id:
        return jsonify({"error": "Missing username or test_id"}), 400

    try:
        test_id_int = int(test_id)
    except ValueError:
        return jsonify({"error": "Invalid test_id"}), 400

    file = request.files["frame"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    frame_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    result = run_proctor_checks(username, test_id_int, frame_bgr)
    phone_result = result["phone"]
    phone_result["timestamp"] = result["timestamp"]
    return jsonify(phone_result), 200


@app.route("/detect-book", methods=["POST"])
def http_detect_book():
    if "frame" not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    username = request.form.get("username")
    test_id = request.form.get("test_id")

    if not username or not test_id:
        return jsonify({"error": "Missing username or test_id"}), 400

    try:
        test_id_int = int(test_id)
    except ValueError:
        return jsonify({"error": "Invalid test_id"}), 400

    file = request.files["frame"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    frame_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    result = run_proctor_checks(username, test_id_int, frame_bgr)
    book_result = result["book"]
    book_result["timestamp"] = result["timestamp"]
    return jsonify(book_result), 200

# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    create_tables()
    # For production, set debug=False and configure host/port appropriately
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)