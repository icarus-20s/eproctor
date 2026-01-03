import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NavbarU from "./navUser";
import logo from "../assets/logoexam.jpg";
import Ut2 from "./underline2";
import Marquee from "./textloop";
import puppet from "/pupet.jpg";
import { useTestContext } from "./Context.jsx";

const User = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, username: ctxUsername } = useTestContext();

  // Prefer username from route state, then context, then localStorage
  const routeUsername = location.state?.username;
  const storedUsername =
    typeof window !== "undefined" ? localStorage.getItem("username") : "";
  const username = routeUsername || ctxUsername || storedUsername || "";

  useEffect(() => {
    if (!username) {
      navigate("/login_user");
    }
  }, [username, navigate]);

  const startTest = () => {
    console.log("Test Started");
    navigate("/user_test", { state: { username } });
  };

  const handleLogout = () => {
    logout();
    navigate("/login_user");
  };

  return (
    <>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
        {/* Brand strip at top-left */}
        <div className="absolute top-0 left-0 flex items-center px-4 py-2 space-x-3">
          <img
            className="w-16 h-16 rounded-full"
            alt="Logo"
            src={logo}
          />
          <h1 className="font-Zen font-medium text-2xl text-gray-900">
            ProctoringAI
          </h1>
        </div>

        {/* Sidebar: Profile Section */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-72">
          <aside className="w-[500px] h-full absolute left-0 p-6 shadow-2xl flex flex-col justify-center items-center bg-white/90">
            <div className="flex flex-col justify-center items-center mt-8">
              <img
                className="w-52 h-52 rounded-full object-cover mb-4 border-4 border-blue-500"
                src={puppet}
                alt="Profile"
              />
              <h2 className="text-3xl font-Lex font-bold text-gray-800">
                {username || "Student"}
              </h2>
              <p className="text-sm text-gray-500">Student</p>
            </div>

            {/* Static info / reminders */}
            <div className="mt-8 w-full bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Exam Tips
              </p>
              <ul className="text-xs text-slate-600 space-y-1 font-Lex">
                <li>• Ensure a stable internet connection.</li>
                <li>• Keep your face clearly visible to the camera.</li>
                <li>• Avoid switching tabs or exiting fullscreen.</li>
                <li>• Remove phones and books from your workspace.</li>
              </ul>
            </div>

            <nav className="mt-6 space-y-4 w-full">
              <button
                className="w-full px-4 py-3 bg-red-50 text-red-600 font-medium rounded-lg font-Orbitron hover:bg-red-100 transition duration-300"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </nav>
          </aside>
        </div>

        {/* Main Section: Start Test Button */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 space-y-6 md:ml-[500px]">
          <div className="max-w-2xl w-full flex flex-col items-center space-y-4">
            <Marquee />
            <Ut2 />

            <p className="text-gray-600 text-lg text-center max-w-md font-Mont">
              Click on the button below to start the exam. Please ensure you
              have a stable connection and adhere to the exam guidelines.
            </p>

            {/* Static guideline cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-2">
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h3 className="font-Orbitron text-sm text-slate-700 mb-2">
                  Before You Start
                </h3>
                <p className="text-xs text-slate-600 font-Lex">
                  Close all unnecessary tabs and applications. Sit in a quiet,
                  well-lit environment.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h3 className="font-Orbitron text-sm text-slate-700 mb-2">
                  During the Exam
                </h3>
                <p className="text-xs text-slate-600 font-Lex">
                  Keep your face towards the screen and avoid looking away for
                  extended periods.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h3 className="font-Orbitron text-sm text-slate-700 mb-2">
                  Proctoring
                </h3>
                <p className="text-xs text-slate-600 font-Lex">
                  Your webcam will be used to monitor for multiple faces, phones,
                  and books.
                </p>
              </div>
            </div>

            <button
              className="px-10 py-4 bg-blue-600 font-Orbitron text-white font-semibold text-lg rounded-full shadow-md hover:bg-blue-700 transition duration-300 mt-4"
              onClick={startTest}
            >
              Start Exam
            </button>
          </div>
        </main>

        <NavbarU />
      </div>
    </>
  );
};

export default User;