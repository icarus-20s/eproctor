import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

function FaceOrientationChecker() {
  const [status, setStatus] = useState('Unknown');
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

      // Draw video frame on the canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to Blob and send to Flask server
      canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append('frame', blob, 'frame.jpg');
        axios.post('http://localhost:5000/face-orientation', formData)
          .then(response => {
            setStatus(response.data.status);
          })
          .catch(error => {
            console.error('Error sending frame:', error);
          });
      }, 'image/jpeg');
    };

    // Send a frame to the server every second
    const interval = setInterval(sendFrameToServer, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className='rounded-md '>
      <h1>Face Orientation Status</h1>
     <div  className='h-96 rounded-md '>
      <video ref={videoRef} className='rounded-md'></video>
      </div>
      <div className='bg-black h-24 w-full rounded-md'>

      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      <p className='text-red-600 text-2xl ml-24 mt-3'>{status}</p>
      {status === 'Face Turned Away' && <p style={{ color: 'red' }} className='text-3xl mx-auto ml-5  mt-2 font-Orbitron hidden'>Please face the screen!</p>}
    </div>
    
  );
}

export default FaceOrientationChecker;
