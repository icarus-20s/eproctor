import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

function FaceOrientationChecker() {
  const [status, setStatus] = useState({
    orientation: 'unknown',
    faceCount: 0
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Access webcam
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(error => {
        console.error('Error accessing webcam:', error);
      });

    const sendFrameToServer = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append('frame', blob, 'frame.jpg');
        formData.append('username', 'ayush123'); // 👈 hardcoded
        formData.append('test_id', '5');         // 👈 hardcoded

        axios.post('http://localhost:5000/face-orientation', formData)
          .then(response => {
            setStatus({
              orientation: response.data.status,
              faceCount: response.data.face_count
            });
          })
          .catch(error => {
            console.error('Error sending frame:', error);
          });
      }, 'image/jpeg');
    };

    const interval = setInterval(sendFrameToServer, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className='rounded-md p-4'>
      <h1 className='text-2xl font-bold mb-2'>Face Orientation Status</h1>
      
      <div className='h-96 rounded-md overflow-hidden'>
        <video ref={videoRef} className='w-full h-full object-cover rounded-md' />
      </div>

      <div className='bg-black h-24 w-full mt-2 rounded-md' />

      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <div className='mt-4'>
        <p className='text-red-600 text-2xl ml-4'>Status: {status.orientation}</p>

        {status.faceCount === 0 && (
          <p className='text-3xl text-yellow-400 font-bold mt-4 ml-4'>
            No face detected — Please position yourself in front of the camera.
          </p>
        )}

        {status.faceCount > 1 && (
          <p className='text-3xl text-red-600 font-bold mt-4 ml-4'>
            Multiple faces detected — Only one candidate is allowed on screen.
          </p>
        )}

        {status.orientation === 'Face Turned Away' && status.faceCount === 1 && (
          <p className='text-3xl text-red-500 font-bold mt-4 ml-4'>
            Please look directly at the screen.
          </p>
        )}

        {status.orientation === 'Facing Camera' && status.faceCount === 1 && (
          <p className='text-2xl text-green-600 mt-4 ml-4'>
            Face aligned properly. Monitoring active.
          </p>
        )}

        <p className='text-green-600 text-xl ml-4 mt-2'>
          Faces detected: {status.faceCount}
        </p>
      </div>
    </div>
  );
}

export default FaceOrientationChecker;
