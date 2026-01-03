import React, { useState, useEffect } from "react";
import Navbar from "./navbar";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logoexam.jpg";
import Ut2 from "./underline2";
import Marquee from "./textloop";
import { useTestContext } from "./Context";

const Admin = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testCode, setTestCode] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const { username: ctxUsername, logout } = useTestContext();

  // Prefer username from route state, then context, then localStorage
  const routeUsername = location.state?.username;
  const storedUsername = typeof window !== "undefined"
    ? localStorage.getItem("username")
    : "";
  const username = routeUsername || ctxUsername || storedUsername || "";

  // Redirect to admin login if no username
  useEffect(() => {
    if (!username) {
      navigate("/login_admin");
    }
  }, [username, navigate]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleTestCodeChange = (e) => {
    const value = e.target.value;
    // Only allow digits (keep existing behavior)
    if (/^\d*$/.test(value)) {
      setTestCode(value);
    }
  };

  const startTest = () => {
    if (!testCode.trim()) {
      alert("Please enter a test code before starting.");
      return;
    }
    // Existing behavior: log and navigate to test creation/page
    console.log("Test Started with Code:", testCode);
    navigate("/test-page", { state: { testCode } });
    closeModal();
  };

  const handleLogout = () => {
    logout();
    navigate("/login_admin");
  };

  const goToMonitoringDashboard = () => {
    // Route where your redesigned Dashboard component is mounted
    navigate("/dashboard");
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

        {/* Right-top: link to monitoring dashboard */}
        <div className="absolute top-4 right-4">
          <button
            onClick={goToMonitoringDashboard}
            className="px-4 py-2 text-sm rounded-full bg-blue-600 text-white font-Orbitron hover:bg-blue-700 shadow-md"
          >
            Open Monitoring Dashboard
          </button>
        </div>

        {/* Sidebar: profile & logout */}
        <aside className="w-[500px] h-full absolute left-0 p-6 shadow-2xl flex flex-col justify-center items-center bg-white/90">
          <div className="flex flex-col justify-center items-center">
            <img
              className="w-52 h-52 rounded-full object-cover mb-4 border-4 border-blue-500 shadow-lg"
              src="https://i.pinimg.com/originals/59/af/9c/59af9cd100daf9aa154cc753dd58316d.jpg"
              alt="Profile"
            />
            <h2 className="text-2xl font-bold text-gray-800 font-Lex">
              {username || "Admin"}
            </h2>
            <p className="text-sm text-gray-500 font-Lex">Administrator</p>
          </div>

          <nav className="mt-8 space-y-4 w-full">
            {/* Static quick actions (non-breaking) */}
            <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Quick Links
              </p>
              <ul className="text-xs text-slate-600 space-y-1 font-Lex">
                <li>• View live incidents on the Monitoring Dashboard</li>
                <li>• Create or manage tests from here</li>
                <li>• Use logs for post-exam audit & review</li>
              </ul>
            </div>

            <button
              className="w-full px-4 py-3 bg-red-100 font-Orbitron text-red-600 font-medium rounded-lg hover:bg-red-200 transition duration-300"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </nav>
        </aside>

        {/* Main Section */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 md:ml-[500px]">
          <div className="max-w-2xl w-full flex flex-col items-center space-y-4">
            <Marquee />
            <Ut2 />

            <p className="text-gray-700 text-lg text-center max-w-md font-Mont">
              Welcome back,{" "}
              <span className="font-semibold">
                {username || "Admin"}
              </span>
              . Use this panel to create new exams and manage existing
              sessions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
              {/* Static summary cards */}
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h3 className="font-Orbitron text-sm text-slate-700 mb-2">
                  Step 1: Create Test
                </h3>
                <p className="text-xs text-slate-600 font-Lex">
                  Generate a unique test code, then add questions on the next
                  screen.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h3 className="font-Orbitron text-sm text-slate-700 mb-2">
                  Step 2: Monitor
                </h3>
                <p className="text-xs text-slate-600 font-Lex">
                  Use the Monitoring Dashboard to track suspicious behavior in
                  real time.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h3 className="font-Orbitron text-sm text-slate-700 mb-2">
                  Step 3: Review
                </h3>
                <p className="text-xs text-slate-600 font-Lex">
                  Review logs and incidents after the exam for audit and
                  grading support.
                </p>
              </div>
            </div>

            <p className="text-gray-600 text-lg text-center max-w-md font-Mont mt-4">
              Click below to create your exam.
            </p>

            <button
              className="px-10 py-4 bg-blue-600 text-white font-Orbitron font-semibold text-lg rounded-full shadow-md hover:bg-blue-700 transition duration-300"
              onClick={openModal}
            >
              Create test
            </button>
          </div>
        </main>

        <Navbar />
      </div>

      {/* Modal for creating test */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4 font-Orbitron">
              Create Test
            </h2>
            <p className="text-xs text-gray-500 mb-2 font-Lex">
              Enter a numeric test code. You will configure questions on the
              next page.
            </p>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md mb-4 font-Lex"
              placeholder="Enter test code (digits only)"
              value={testCode}
              onChange={handleTestCodeChange}
            />
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400 font-Orbitron"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-Orbitron"
                onClick={startTest}
              >
                Start Test
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Admin;