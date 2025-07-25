import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const test_code = localStorage.getItem('testCode');
const username = localStorage.getItem('username');

function FaceOrientationChecker({ isActive = true, stopSignal = false }) {
  const [status, setStatus] = useState({
    orientation: 'unknown',
    faceCount: 0,
    timestamp: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Start webcam stream
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

  // Send frame periodically
  useEffect(() => {
    if (!isActive || stopSignal) return;

    const intervalId = setInterval(() => {
      sendFrameToServer();
    }, 3000); // Every 3 seconds

    return () => clearInterval(intervalId);
  }, [isActive, stopSignal, username, test_code]);

  const sendFrameToServer = async () => {
    if (!streamRef.current || !videoRef.current || !canvasRef.current) return;

    try {
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

        // Debugging the payload
        for (let pair of formData.entries()) {
          console.log(`${pair[0]}:`, pair[1]);
        }

        try {
          const response = await axios.post('http://localhost:5000/face-orientation', formData, {
            timeout: 5000,
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (response.data && !stopSignal) {
            setStatus({
              orientation: response.data.status,
              faceCount: response.data.face_count,
              timestamp: response.data.timestamp
            });
          }
        } catch (error) {
          if (error.response) {
            console.error('Backend error:', error.response.status, error.response.data);
          } else {
            console.error('Network or unexpected error:', error.message);
          }
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  };

  return (
   <div className="p-6 max-w-xl mx-auto bg-white shadow-lg rounded-xl space-y-6">
  <h2 className="text-2xl font-semibold text-center text-gray-800">Face Orientation Checker</h2>

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

  <div className="bg-gray-100 p-4 rounded-lg">
    <p className="text-lg text-gray-700">
      <span className="font-bold text-gray-900">Face Count:</span> {status.faceCount}
    </p>
    <p className="text-lg text-gray-700">
      <span className="font-bold text-gray-900">Orientation:</span> {status.orientation}
    </p>
    <p className="text-lg text-gray-700">
      <span className="font-bold text-gray-900">Timestamp:</span> {status.timestamp}
    </p>
  </div>
</div>

  );
}

export default FaceOrientationChecker;
