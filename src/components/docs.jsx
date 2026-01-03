import React from "react";
import Underline from "./underline";
import logo from "../assets/logoexam.jpg";

const Docs = () => {
  return (
    <>
      {/* Top navigation bar */}
      <div className="flex justify-between items-center bg-slate-100 h-auto p-2 drop-shadow-xl">
        <div className="flex justify-start items-center">
          <img
            className="w-16 h-16 rounded-full m-4"
            alt="Logo"
            src={logo}
          />
          <h1 className="font-Zen font-medium text-2xl text-gray-900">
            ProctoringAI
          </h1>
        </div>

        <div className="flex justify-end items-center">
          <button className="relative bg-transparent text-black w-24 h-12 border-2 border-blue-500 rounded-[11px] m-2 transition-all duration-600 ease-in-out hover:bg-blue-600 hover:text-white cursor-pointer">
            <a href="/login_user" className="w-full h-full flex items-center justify-center">
              Login User
            </a>
          </button>

          <button className="relative bg-transparent text-black w-28 h-12 border-2 border-blue-500 m-2 rounded-[11px] transition-all duration-600 ease-in-out hover:bg-blue-600 hover:text-white cursor-pointer">
            <a href="/login_admin" className="w-full h-full flex items-center justify-center">
              Login Admin
            </a>
          </button>

          <button className="relative bg-transparent text-black w-24 h-12 border-2 border-blue-500 m-2 rounded-[11px] transition-all duration-600 ease-in-out hover:bg-blue-600 hover:text-white cursor-pointer">
            <a href="/register" className="w-full h-full flex items-center justify-center">
              Sign-up
            </a>
          </button>
        </div>
      </div>

      {/* Main docs / landing content */}
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 bg-custom-pattern">
        <img
          className="w-24 h-24 rounded-full m-4"
          alt="Logo"
          src={logo}
        />

        <h1 className="font-Zen text-5xl md:text-7xl text-center text-gray-900 hover:scale-105 mb-6 transition-transform duration-200">
          Welcome to ProctoringAI
        </h1>

        <Underline />

        {/* Short system overview (static, non-breaking) */}
        <p className="mt-6 max-w-3xl text-center text-gray-700 text-lg font-Mont px-4">
          ProctoringAI is an AI-assisted exam invigilation platform that
          combines secure browser controls with real-time webcam monitoring.
          It helps institutions conduct online exams fairly by detecting
          suspicious activities such as multiple faces, phones, or books
          while preserving a smooth user experience.
        </p>

        <div className="mt-8 max-w-3xl px-6">
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 font-Orbitron text-center">
            Key Safeguards
          </h2>
          <ul className="list-disc list-inside space-y-2 font-mono text-lg text-gray-800">
            <li>
              Blocks copying and pasting, and prevents right-click actions to
              limit access to external resources.
            </li>
            <li>
              Tracks and limits tab switches, issuing warnings or penalties if
              multiple changes are detected.
            </li>
            <li>
              Repeated violations trigger warnings, and persistent issues can
              result in automatic exam termination.
            </li>
            <li>
              Instructors can create tests, receive alerts, and monitor users
              from a dedicated admin dashboard.
            </li>
          </ul>
        </div>

        {/* Optional static pipeline summary (purely informational) */}
        <div className="mt-10 max-w-4xl px-6 py-4 bg-white/80 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-xl font-semibold mb-2 text-gray-900 font-Orbitron text-center">
            How ProctoringAI Works (High Level)
          </h3>
          <p className="text-sm text-gray-700 font-Mont mb-1">
            • The student&apos;s browser periodically sends webcam frames to the
            backend via a secure WebSocket connection.
          </p>
          <p className="text-sm text-gray-700 font-Mont mb-1">
            • A YOLO-based model detects faces, phones, and books; dlib is used
            to estimate head pose and check whether the student is looking at
            the screen.
          </p>
          <p className="text-sm text-gray-700 font-Mont mb-1">
            • Suspicious events (e.g., &quot;Multiple Faces Detected&quot;,
            &quot;Phone Detected&quot;, &quot;Face Turned Away&quot;) are logged
            with timestamps and screenshots for later review.
          </p>
          <p className="text-sm text-gray-700 font-Mont">
            • Admins can review incidents, manage tests, and see active sessions
            from the monitoring dashboard, while students access exams through
            a simplified user interface.
          </p>
        </div>
      </div>
    </>
  );
};

export default Docs;