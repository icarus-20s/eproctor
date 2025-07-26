import cv2
import dlib
import numpy as np

# Load face detector and facial landmarks
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("./models/shape_predictor_68_face_landmarks.dat")

# 3D model points (for head pose)
model_points = np.array([
    (0.0, 0.0, 0.0),             # Nose tip
    (0.0, -330.0, -65.0),        # Chin
    (-225.0, 170.0, -135.0),     # Left eye left corner
    (225.0, 170.0, -135.0),      # Right eye right corner
    (-150.0, -150.0, -125.0),    # Left mouth corner
    (150.0, -150.0, -125.0)      # Right mouth corner
])

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    size = frame.shape
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detector(gray)

    for face in faces:
        # Draw bounding box around the face
        x1, y1 = face.left(), face.top()
        x2, y2 = face.right(), face.bottom()
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        landmarks = predictor(gray, face)

        # 2D image points for head pose
        image_points = np.array([
            (landmarks.part(30).x, landmarks.part(30).y),     # Nose tip
            (landmarks.part(8).x, landmarks.part(8).y),       # Chin
            (landmarks.part(36).x, landmarks.part(36).y),     # Left eye
            (landmarks.part(45).x, landmarks.part(45).y),     # Right eye
            (landmarks.part(48).x, landmarks.part(48).y),     # Left mouth corner
            (landmarks.part(54).x, landmarks.part(54).y)      # Right mouth corner
        ], dtype="double")

        # Camera internals
        focal_length = size[1]
        center = (size[1]/2, size[0]/2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype="double")
        dist_coeffs = np.zeros((4, 1))

        # Solve PnP (head pose estimation)
        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs)

        # Project a 3D point to get nose direction
        (nose_end_point2D, _) = cv2.projectPoints(
            np.array([(0.0, 0.0, 1000.0)]), rotation_vector, translation_vector,
            camera_matrix, dist_coeffs)

        # Draw head pose direction
        p1 = tuple(map(int, image_points[0]))
        p2 = tuple(map(int, nose_end_point2D[0][0]))
        cv2.line(frame, p1, p2, (255, 0, 0), 2)

        # Draw eye positions
        for i in [36, 39, 42, 45]:  # corners of eyes
            x, y = landmarks.part(i).x, landmarks.part(i).y
            cv2.circle(frame, (x, y), 3, (0, 0, 255), -1)

        # Optional: extract and print eye/nose/head info
        nose_tip = image_points[0]
        print("Nose Tip:", nose_tip)
        print("Rotation Vector:", rotation_vector.ravel())

    cv2.imshow("Head + Eye Tracking", frame)
    if cv2.waitKey(1) == 27:  # Esc key to exit
        break

cap.release()
cv2.destroyAllWindows()
