import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

function FaceOrientationChecker({ isActive = true, stopSignal = false }) {
   const test_code = localStorage.getItem('testCode');
  const username = localStorage.getItem('username');
  const [status, setStatus] = useState({
    orientation: 'unknown',
    faceCount: 0,
    timestamp: ''
  });

  const [eyeStatus, setEyeStatus] = useState({
    direction: 'unknown',
    noseTip: [],
    leftEye: [],
    rightEye: [],
    timestamp: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Failed to access webcam:', error);
      }
    };

    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || stopSignal) return;

    const intervalId = setInterval(() => {
      sendFrameToServer();
    }, 2000); // Every 3 seconds

    return () => clearInterval(intervalId);
  }, [isActive, stopSignal, username, test_code]);

  const sendFrameToServer = async () => {
 
    if (!streamRef.current || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob || stopSignal) return;

      const formData = new FormData();
      formData.append('frame', blob, 'frame.jpg');
      formData.append('username', username);
      formData.append('test_id', test_code);
      console.log(test_code)
      try {
        // FACE ORIENTATION
        const faceRes = await axios.post('http://localhost:5000/face-orientation', formData, {
          timeout: 5000,
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (faceRes.data && !stopSignal) {
          setStatus({
            orientation: faceRes.data.status,
            faceCount: faceRes.data.face_count,
            timestamp: faceRes.data.timestamp
          });
        }

        // EYE DIRECTION
        const eyeRes = await axios.post('http://localhost:5000/detect-eye', formData, {
          timeout: 5000,
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (eyeRes.data && !stopSignal) {
          setEyeStatus({
            direction: eyeRes.data.status,
            noseTip: eyeRes.data.nose_tip || [],
            leftEye: eyeRes.data.eye_positions?.left_eye || [],
            rightEye: eyeRes.data.eye_positions?.right_eye || [],
            timestamp: eyeRes.data.timestamp
          });
        }
      } catch (error) {
        console.error('Detection error:', error.message);
      }
    }, 'image/jpeg', 0.8);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white shadow-lg rounded-xl space-y-6">
      <h2 className="text-2xl font-semibold text-center text-gray-800">Face & Eye Detection</h2>

      <div className="flex justify-center">
        <video
          ref={videoRef}
          autoPlay
          muted
          width="400"
          height="300"
          className="rounded-lg border border-gray-300 shadow-md"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="bg-gray-100 p-4 rounded-lg space-y-2">
        <h3 className="font-semibold text-lg text-gray-800">Face Orientation</h3>
        <p><strong>Orientation:</strong> {status.orientation}</p>
        <p><strong>Face Count:</strong> {status.faceCount}</p>
        <p><strong>Time:</strong> {status.timestamp}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg space-y-2">
        <h3 className="font-semibold text-lg text-gray-800">Eye/Head Direction</h3>
        <p><strong>Direction:</strong> {eyeStatus.direction}</p>
        <p><strong>Nose Tip:</strong> {eyeStatus.noseTip.join(', ')}</p>
        <p><strong>Left Eye:</strong> {eyeStatus.leftEye.join(', ')}</p>
        <p><strong>Right Eye:</strong> {eyeStatus.rightEye.join(', ')}</p>
        <p><strong>Time:</strong> {eyeStatus.timestamp}</p>
      </div>
    </div>
  );
}

export default FaceOrientationChecker;

