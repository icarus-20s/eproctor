import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { AlertTriangle, Users, Phone, Book, Eye, X } from "lucide-react";

// Professional Warning Toast Component
const WarningToast = ({ id, type, title, message, onClose, isVisible }) => {
  const getTypeConfig = () => {
    switch (type) {
      case "face":
        return {
          icon: Users,
          bgColor: "bg-red-100 border-red-300",
          textColor: "text-red-800",
          iconColor: "text-red-600",
        };
      case "phone":
        return {
          icon: Phone,
          bgColor: "bg-red-100 border-red-300",
          textColor: "text-red-800",
          iconColor: "text-red-600",
        };
      case "book":
        return {
          icon: Book,
          bgColor: "bg-yellow-100 border-yellow-300",
          textColor: "text-yellow-800",
          iconColor: "text-yellow-600",
        };
      case "eye":
        return {
          icon: Eye,
          bgColor: "bg-blue-100 border-blue-300",
          textColor: "text-blue-800",
          iconColor: "text-blue-600",
        };
      default:
        return {
          icon: AlertTriangle,
          bgColor: "bg-gray-100 border-gray-300",
          textColor: "text-gray-800",
          iconColor: "text-gray-600",
        };
    }
  };

  const config = getTypeConfig();
  const IconComponent = config.icon;

  if (!isVisible) return null;

  return (
    <div
      className={`w-full max-w-sm rounded-xl border ${config.bgColor} shadow-lg p-4 flex items-start space-x-3 animate-fade-in`}
    >
      <IconComponent className={`w-6 h-6 ${config.iconColor} mt-1`} />
      <div className="flex-1">
        <h4 className={`font-semibold ${config.textColor}`}>{title}</h4>
        <p className={`text-sm ${config.textColor}`}>{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="p-1 hover:bg-black hover:bg-opacity-10 rounded-full"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Warning Manager Component
const WarningManager = ({ warnings, onRemoveWarning }) => {
  return (
    <div className="fixed top-6 right-6 z-50 space-y-4">
      {warnings.map((warning) => (
        <WarningToast
          key={warning.id}
          {...warning}
          onClose={onRemoveWarning}
          isVisible={true}
        />
      ))}
    </div>
  );
};

function FaceOrientationChecker({ isActive = true, stopSignal = false }) {
  const test_code = localStorage.getItem("testCode");
  const username = localStorage.getItem("username");

  const [status, setStatus] = useState({
    orientation: "unknown",
    faceCount: 0,
    timestamp: "",
  });

  const [bookStatus, setBookStatus] = useState({
    status: "unknown",
    timestamp: "",
  });

  const [phoneStatus, setPhoneStatus] = useState({
    status: "Checking...",
    timestamp: "",
  });

  const [eyeStatus, setEyeStatus] = useState({
    direction: "unknown",
    noseTip: [],
    leftEye: [],
    rightEye: [],
    timestamp: "",
  });

  const [warnings, setWarnings] = useState([]);
  const [warningId, setWarningId] = useState(0);
  const warningTimeouts = useRef(new Map());

  const [connectionStatus, setConnectionStatus] = useState("connected"); // "connected" | "disconnected"

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);

  const lastAlerted = useRef({
    phone: false,
    faces: false,
    book: false,
    eye: false,
    faceTurn: false,
    noFace: false,
  });

  // Webcam init
  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        console.error("Failed to access webcam:", error);
        showWarning({
          type: "error",
          title: "Camera Access Failed",
          message: "Please check webcam permissions.",
          duration: 8000,
        });
      }
    };

    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Socket.IO connection
  useEffect(() => {
    // Connect directly to the /proctor namespace (matches Flask-SocketIO)
    const socket = io("http://localhost:5000/proctor", {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to proctor WS:", socket.id);
      setConnectionStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected from proctor WS:", reason);
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("Proctor WS connect_error:", err);
      setConnectionStatus("disconnected");
      showWarning({
        type: "error",
        title: "Monitoring Connection Failed",
        message: "Unable to connect to monitoring service.",
        duration: 8000,
      });
    });

    socket.on("proctor_error", (data) => {
      console.error("Proctor error:", data);
      showWarning({
        type: "error",
        title: "Monitoring Error",
        message: data?.error || "An error occurred in monitoring.",
        duration: 6000,
      });
    });

    socket.on("proctor_result", (data) => {
      const { timestamp, face, head_pose, phone, book } = data || {};

      setStatus({
        orientation: face?.status || "unknown",
        faceCount: face?.face_count ?? 0,
        timestamp: timestamp || "",
      });

      setEyeStatus({
        direction: head_pose?.status || "unknown",
        noseTip: head_pose?.nose_tip || [],
        leftEye: head_pose?.eye_positions?.left_eye || [],
        rightEye: head_pose?.eye_positions?.right_eye || [],
        timestamp: timestamp || "",
      });

      setPhoneStatus({
        status: phone?.status || "unknown",
        timestamp: timestamp || "",
      });

      setBookStatus({
        status: book?.status || "unknown",
        timestamp: timestamp || "",
      });
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic frame sending via WebSocket
  useEffect(() => {
    if (!isActive || stopSignal) return;

    const intervalId = setInterval(() => {
      sendFrameToServer();
    }, 3000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, stopSignal]);

  const showWarning = ({ type, title, message, duration = 5000 }) => {
    setWarningId((prevId) => {
      const id = prevId + 1;
      const newWarning = { id, type, title, message };
      setWarnings((prev) => [...prev, newWarning]);

      const timeout = setTimeout(() => removeWarning(id), duration);
      warningTimeouts.current.set(id, timeout);

      return id;
    });
  };

  const removeWarning = (id) => {
    setWarnings((prev) => prev.filter((w) => w.id !== id));
    const t = warningTimeouts.current.get(id);
    if (t) clearTimeout(t);
    warningTimeouts.current.delete(id);
  };

  // Auto warnings based on updated statuses
  useEffect(() => {
    // Multiple faces
    if (status.faceCount > 1 && !lastAlerted.current.faces) {
      showWarning({
        type: "face",
        title: "Multiple Faces Detected",
        message: "Ensure only one person is visible.",
        duration: 6000,
      });
      lastAlerted.current.faces = true;
    } else if (status.faceCount <= 1 && lastAlerted.current.faces) {
      lastAlerted.current.faces = false;
    }

    // Face turned away
    if (
      status.orientation === "Face Turned Away" &&
      !lastAlerted.current.faceTurn
    ) {
      showWarning({
        type: "face",
        title: "Face Turned Away",
        message: "Please face the camera during the exam.",
        duration: 5000,
      });
      lastAlerted.current.faceTurn = true;
    } else if (
      status.orientation !== "Face Turned Away" &&
      lastAlerted.current.faceTurn
    ) {
      lastAlerted.current.faceTurn = false;
    }

    // No face detected
    if (
      status.orientation === "No Face Detected" &&
      !lastAlerted.current.noFace
    ) {
      showWarning({
        type: "face",
        title: "No Face Detected",
        message: "Ensure your face is clearly visible to the camera.",
        duration: 5000,
      });
      lastAlerted.current.noFace = true;
    } else if (
      status.orientation !== "No Face Detected" &&
      lastAlerted.current.noFace
    ) {
      lastAlerted.current.noFace = false;
    }

    // Phone
    if (phoneStatus.status === "Phone Detected" && !lastAlerted.current.phone) {
      showWarning({
        type: "phone",
        title: "Phone Detected",
        message: "Remove mobile devices from the area.",
        duration: 8000,
      });
      lastAlerted.current.phone = true;
    } else if (
      phoneStatus.status !== "Phone Detected" &&
      lastAlerted.current.phone
    ) {
      lastAlerted.current.phone = false;
    }

    // Book
    if (bookStatus.status === "Book Detected" && !lastAlerted.current.book) {
      showWarning({
        type: "book",
        title: "Book Detected",
        message: "Remove study materials from view.",
        duration: 6000,
      });
      lastAlerted.current.book = true;
    } else if (
      bookStatus.status !== "Book Detected" &&
      lastAlerted.current.book
    ) {
      lastAlerted.current.book = false;
    }

    // Eye / Head direction:
    // Backend gives: "Looking Center", "Looking Left", "Looking Right", "Looking Down", "Unavailable"
    const isLookingAway =
      eyeStatus.direction &&
      !["Looking Center", "Unavailable", "unknown"].includes(
        eyeStatus.direction
      );

    if (isLookingAway && !lastAlerted.current.eye) {
      showWarning({
        type: "eye",
        title: "Focus Lost",
        message: "Please focus on the screen.",
        duration: 4000,
      });
      lastAlerted.current.eye = true;
    } else if (!isLookingAway && lastAlerted.current.eye) {
      lastAlerted.current.eye = false;
    }
  }, [
    status.faceCount,
    status.orientation,
    phoneStatus.status,
    bookStatus.status,
    eyeStatus.direction,
  ]);

  const sendFrameToServer = () => {
    if (
      !socketRef.current ||
      !socketRef.current.connected ||
      !streamRef.current ||
      !videoRef.current ||
      !canvasRef.current ||
      stopSignal
    )
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

    socketRef.current.emit("proctor_frame", {
      username,
      test_id: test_code,
      frame: dataUrl,
    });
  };

  // Cleanup any pending timeouts on unmount
  useEffect(() => {
    return () => {
      warningTimeouts.current.forEach((t) => clearTimeout(t));
      warningTimeouts.current.clear();
    };
  }, []);

  // For dot color: treat Looking Center/Unavailable/unknown as "good"
  const eyeDotColor =
    eyeStatus.direction === "Looking Center" ||
    eyeStatus.direction === "Unavailable" ||
    eyeStatus.direction === "unknown"
      ? "bg-green-500"
      : "bg-yellow-500";

  const faceDotColor =
    status.faceCount === 1 && status.orientation === "Facing Camera"
      ? "bg-green-500"
      : "bg-red-500";

  return (
    <>
      <WarningManager warnings={warnings} onRemoveWarning={removeWarning} />

      {/* Connection lost overlay */}
      {connectionStatus === "disconnected" && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md text-center shadow-xl">
            <h3 className="text-xl font-semibold mb-2">Connection Lost</h3>
            <p className="text-sm text-gray-700 mb-4">
              Your connection to the exam monitoring service has been
              interrupted. Please check your internet connection. The exam may
              be paused or recorded as interrupted depending on exam policy.
            </p>
            <p className="text-xs text-gray-500">
              If this persists, contact your instructor or support team
              immediately.
            </p>
          </div>
        </div>
      )}

      <div className="p-6 max-w-2xl mx-auto bg-white shadow-xl rounded-xl space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          Exam Monitoring Dashboard
        </h2>

        <div className="flex justify-center">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="rounded-lg border border-gray-300 shadow w-full max-w-md"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {[
          {
            title: "Face Orientation",
            data: status,
            fields: ["orientation", "faceCount", "timestamp"],
            dot: faceDotColor,
          },
          {
            title: "Eye/Head Direction",
            data: eyeStatus,
            fields: ["direction", "noseTip", "leftEye", "rightEye", "timestamp"],
            dot: eyeDotColor,
          },
          {
            title: "Phone Detection",
            data: phoneStatus,
            fields: ["status", "timestamp"],
            dot:
              phoneStatus.status === "Phone Detected"
                ? "bg-red-500"
                : "bg-green-500",
          },
          {
            title: "Book Detection",
            data: bookStatus,
            fields: ["status", "timestamp"],
            dot:
              bookStatus.status === "Book Detected"
                ? "bg-yellow-500"
                : "bg-green-500",
          },
        ].map((section, idx) => (
          <div key={idx} className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-lg text-gray-700 mb-2">
              {section.title}
            </h3>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                {section.fields.map((field, i) => (
                  <p key={i} className="text-sm text-gray-800">
                    <strong>
                      {field.replace(/([A-Z])/g, " $1").replace(/^./, (s) =>
                        s.toUpperCase()
                      )}
                      :
                    </strong>{" "}
                    {Array.isArray(section.data[field])
                      ? section.data[field].join(", ")
                      : section.data[field]}
                  </p>
                ))}
              </div>
              <div
                className={`w-4 h-4 mt-1 rounded-full ${section.dot}`}
                title={section.data.status || section.data.direction}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default FaceOrientationChecker;