import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Users, Phone, Book, Eye, X } from "lucide-react";

// Professional Warning Toast Component
const WarningToast = ({ id, type, title, message, onClose, isVisible }) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'face':
        return {
          icon: Users,
          bgColor: 'bg-red-100 border-red-300',
          textColor: 'text-red-800',
          iconColor: 'text-red-600'
        };
      case 'phone':
        return {
          icon: Phone,
          bgColor: 'bg-red-100 border-red-300',
          textColor: 'text-red-800',
          iconColor: 'text-red-600'
        };
      case 'book':
        return {
          icon: Book,
          bgColor: 'bg-yellow-100 border-yellow-300',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600'
        };
      case 'eye':
        return {
          icon: Eye,
          bgColor: 'bg-blue-100 border-blue-300',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600'
        };
      default:
        return {
          icon: AlertTriangle,
          bgColor: 'bg-gray-100 border-gray-300',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600'
        };
    }
  };

  const config = getTypeConfig();
  const IconComponent = config.icon;

  if (!isVisible) return null;

  return (
    <div className={`w-full max-w-sm rounded-xl border ${config.bgColor} shadow-lg p-4 flex items-start space-x-3 animate-fade-in`}>      
      <IconComponent className={`w-6 h-6 ${config.iconColor} mt-1`} />
      <div className="flex-1">
        <h4 className={`font-semibold ${config.textColor}`}>{title}</h4>
        <p className={`text-sm ${config.textColor}`}>{message}</p>
      </div>
      <button onClick={() => onClose(id)} className="p-1 hover:bg-black hover:bg-opacity-10 rounded-full">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Warning Manager Component
const WarningManager = ({ warnings, onRemoveWarning }) => {
  return (
    <div className="fixed top-6 right-6 z-50 space-y-4">
      {warnings.map(warning => (
        <WarningToast key={warning.id} {...warning} onClose={onRemoveWarning} isVisible={true} />
      ))}
    </div>
  );
};

function FaceOrientationChecker({ isActive = true, stopSignal = false }) {
  const test_code = localStorage.getItem("testCode");
  const username = localStorage.getItem("username");

  const [status, setStatus] = useState({ orientation: "unknown", faceCount: 0, timestamp: "" });
  const [bookStatus, setBookStatus] = useState({ status: "unknown", timestamp: "" });
  const [phoneStatus, setPhoneStatus] = useState({ status: "Checking...", timestamp: "" });
  const [eyeStatus, setEyeStatus] = useState({ direction: "unknown", noseTip: [], leftEye: [], rightEye: [], timestamp: "" });

  const [warnings, setWarnings] = useState([]);
  const [warningId, setWarningId] = useState(0);
  const warningTimeouts = useRef(new Map());

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const lastAlerted = useRef({ phone: false, faces: false, book: false, eye: false });

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        console.error("Failed to access webcam:", error);
        showWarning({ type: 'error', title: 'Camera Access Failed', message: 'Please check webcam permissions.', duration: 8000 });
      }
    };

    startWebcam();
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!isActive || stopSignal) return;
    const intervalId = setInterval(() => sendFrameToServer(), 3000);
    return () => clearInterval(intervalId);
  }, [isActive, stopSignal]);

  const showWarning = ({ type, title, message, duration = 5000 }) => {
    const id = warningId + 1;
    setWarningId(id);
    const newWarning = { id, type, title, message };
    setWarnings(prev => [...prev, newWarning]);
    const timeout = setTimeout(() => removeWarning(id), duration);
    warningTimeouts.current.set(id, timeout);
  };

  const removeWarning = (id) => {
    setWarnings(prev => prev.filter(w => w.id !== id));
    clearTimeout(warningTimeouts.current.get(id));
    warningTimeouts.current.delete(id);
  };

  useEffect(() => {
    if (status.faceCount > 1 && !lastAlerted.current.faces) {
      showWarning({ type: 'face', title: 'Multiple Faces Detected', message: 'Ensure only one person is visible.', duration: 6000 });
      lastAlerted.current.faces = true;
    } else if (status.faceCount <= 1 && lastAlerted.current.faces) {
      lastAlerted.current.faces = false;
    }

    if (phoneStatus.status === "Phone Detected" && !lastAlerted.current.phone) {
      showWarning({ type: 'phone', title: 'Phone Detected', message: 'Remove mobile devices from the area.', duration: 8000 });
      lastAlerted.current.phone = true;
    } else if (phoneStatus.status !== "Phone Detected" && lastAlerted.current.phone) {
      lastAlerted.current.phone = false;
    }

    if (bookStatus.status === "Book Detected" && !lastAlerted.current.book) {
      showWarning({ type: 'book', title: 'Book Detected', message: 'Remove study materials from view.', duration: 6000 });
      lastAlerted.current.book = true;
    } else if (bookStatus.status !== "Book Detected" && lastAlerted.current.book) {
      lastAlerted.current.book = false;
    }

    if (eyeStatus.direction === "Looking Away" && !lastAlerted.current.eye) {
      showWarning({ type: 'eye', title: 'Focus Lost', message: 'Please focus on the screen.', duration: 4000 });
      lastAlerted.current.eye = true;
    } else if (eyeStatus.direction !== "Looking Away" && lastAlerted.current.eye) {
      lastAlerted.current.eye = false;
    }
  }, [status.faceCount, phoneStatus.status, bookStatus.status, eyeStatus.direction]);

  const sendFrameToServer = async () => {
    if (!streamRef.current || !videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob || stopSignal) return;
      const formData = new FormData();
      formData.append("frame", blob, "frame.jpg");
      formData.append("username", username);
      formData.append("test_id", test_code);

      try {
        const [faceRes, eyeRes, bookRes, phoneRes] = await Promise.all([
          fetch("http://localhost:5000/face-orientation", { method: 'POST', body: formData }),
          fetch("http://localhost:5000/detect-eye", { method: 'POST', body: formData }),
          fetch("http://localhost:5000/detect-book", { method: 'POST', body: formData }),
          fetch("http://localhost:5000/detect-phone", { method: 'POST', body: formData })
        ]);

        if (faceRes.ok) {
          const face = await faceRes.json();
          setStatus({ orientation: face.status, faceCount: face.face_count, timestamp: face.timestamp });
        }
        if (eyeRes.ok) {
          const eye = await eyeRes.json();
          setEyeStatus({ direction: eye.status, noseTip: eye.nose_tip || [], leftEye: eye.eye_positions?.left_eye || [], rightEye: eye.eye_positions?.right_eye || [], timestamp: eye.timestamp });
        }
        if (bookRes.ok) {
          const book = await bookRes.json();
          setBookStatus({ status: book.status, timestamp: book.timestamp });
        }
        if (phoneRes.ok) {
          const phone = await phoneRes.json();
          setPhoneStatus({ status: phone.status, timestamp: phone.timestamp });
        }
      } catch (err) {
        console.error("Server Error:", err);
        showWarning({ type: 'error', title: 'Server Error', message: 'Monitoring service unreachable.', duration: 6000 });
      }
    }, "image/jpeg", 0.8);
  };

  useEffect(() => () => warningTimeouts.current.forEach(clearTimeout), []);

  return (
    <>
      <WarningManager warnings={warnings} onRemoveWarning={removeWarning} />

      <div className="p-6 max-w-2xl mx-auto bg-white shadow-xl rounded-xl space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">Exam Monitoring Dashboard</h2>

        <div className="flex justify-center">
          <video ref={videoRef} autoPlay muted className="rounded-lg border border-gray-300 shadow w-full max-w-md" />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {[{
          title: 'Face Orientation', data: status, fields: ['orientation', 'faceCount', 'timestamp'], dot: status.faceCount === 1 ? 'bg-green-500' : 'bg-red-500'
        }, {
          title: 'Eye/Head Direction', data: eyeStatus, fields: ['direction', 'noseTip', 'leftEye', 'rightEye', 'timestamp'], dot: (eyeStatus.direction === 'Looking Forward' || eyeStatus.direction === 'unknown') ? 'bg-green-500' : 'bg-yellow-500'
        }, {
          title: 'Phone Detection', data: phoneStatus, fields: ['status', 'timestamp'], dot: phoneStatus.status === 'Phone Detected' ? 'bg-red-500' : 'bg-green-500'
        }, {
          title: 'Book Detection', data: bookStatus, fields: ['status', 'timestamp'], dot: bookStatus.status === 'Book Detected' ? 'bg-yellow-500' : 'bg-green-500'
        }].map((section, idx) => (
          <div key={idx} className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-lg text-gray-700 mb-2">{section.title}</h3>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                {section.fields.map((field, i) => (
                  <p key={i} className="text-sm text-gray-800">
                    <strong>{field.replace(/([A-Z])/g, ' $1')}:</strong> {Array.isArray(section.data[field]) ? section.data[field].join(', ') : section.data[field]}
                  </p>
                ))}
              </div>
              <div className={`w-4 h-4 mt-1 rounded-full ${section.dot}`} title={section.data.status || section.data.direction}></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default FaceOrientationChecker;
