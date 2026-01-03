import React, { useEffect, useState } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Users,
  AlertTriangle,
  Activity,
  Eye,
  ArrowLeft,
  Trash2,
  UserX,
  Search,
  Shield,
  Monitor,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  const [tests, setTests] = useState([]);
  const [suspiciousEvents, setSuspiciousEvents] = useState([]);
  const [userSessions, setUserSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testUsers, setTestUsers] = useState([]);
  const [testSuspiciousEvents, setTestSuspiciousEvents] = useState([]);
  const [error, setError] = useState(null);

  const [filterType, setFilterType] = useState("all"); // all | face | phone | book | head
  const [searchTerm, setSearchTerm] = useState("");

  const [stats, setStats] = useState({
    totalTests: 0,
    activeTests: 0,
    totalUsers: 0,
    totalIncidents: 0,
    faceIncidents: 0,
    phoneIncidents: 0,
    bookIncidents: 0,
    headIncidents: 0,
  });

  const getAuthToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  // Initial load + periodic log refresh
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchSuspiciousEvents, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTests(), fetchSuspiciousEvents(), fetchUserSessions()]);
    } catch (err) {
      setError("Failed to fetch data. Please try again.");
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  };

  const fetchTests = async () => {
    try {
      const response = await fetch("http://localhost:5000/get-all-tests", {
        headers: {
          Authorization: getAuthToken(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch tests");
      const data = await response.json();
      setTests(data);

      setStats((prev) => ({
        ...prev,
        totalTests: data.length,
        activeTests: data.filter((t) => t.is_test_started).length,
      }));
    } catch (err) {
      setError("Failed to fetch tests");
      console.error("Error fetching tests:", err);
    }
  };

  const fetchSuspiciousEvents = async () => {
    try {
      const response = await fetch("http://localhost:5000/get-logs-json", {
        headers: {
          Authorization: getAuthToken(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch suspicious events");
      const data = await response.json();
      const events = data || [];
      setSuspiciousEvents(events);

      // Categorize incidents
      const faceEvents = events.filter((e) =>
        ["No Face Detected", "Multiple Faces Detected", "Face Turned Away"].includes(
          e.event_type
        )
      );
      const phoneEvents = events.filter((e) =>
        (e.event_type || "").toLowerCase().includes("phone")
      );
      const bookEvents = events.filter((e) =>
        (e.event_type || "").toLowerCase().includes("book")
      );
      const headEvents = events.filter((e) =>
        (e.event_type || "").toLowerCase().includes("head pose")
      );

      setStats((prev) => ({
        ...prev,
        totalIncidents: events.length,
        faceIncidents: faceEvents.length,
        phoneIncidents: phoneEvents.length,
        bookIncidents: bookEvents.length,
        headIncidents: headEvents.length,
      }));
    } catch (err) {
      setError("Failed to fetch suspicious events");
      console.error("Error fetching suspicious events:", err);
    }
  };

  const fetchUserSessions = async () => {
    try {
      const response = await fetch("http://localhost:5000/get-user-sessions", {
        headers: {
          Authorization: getAuthToken(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch user sessions");
      const data = await response.json();
      setUserSessions(data || []);

      setStats((prev) => ({
        ...prev,
        totalUsers: data.length,
      }));
    } catch (err) {
      setError("Failed to fetch user sessions");
      console.error("Error fetching user sessions:", err);
    }
  };

  const fetchTestUsers = async (testCode) => {
    try {
      const response = await fetch(
        `http://localhost:5000/test/${testCode}/users`,
        {
          headers: {
            Authorization: getAuthToken(),
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch test users");
      const data = await response.json();

      const usersAsObjects = (data.users || []).map((u) => ({
        username: u,
        status: "active",
        id: u,
        test_code: testCode,
      }));

      setTestUsers(usersAsObjects);
    } catch (err) {
      console.error("Error fetching test users:", err);
      setError("Failed to fetch test users");
      setTestUsers([]);
    }
  };

  const fetchTestSuspiciousEvents = async (testCode) => {
    try {
      // Note: backend expects numeric test_id; here we treat testCode as test_id
      const response = await fetch(
        `http://localhost:5000/get-logs-json?test_id=${testCode}`,
        {
          headers: {
            Authorization: getAuthToken(),
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch test suspicious events");
      const data = await response.json();
      setTestSuspiciousEvents(data || []);
    } catch (err) {
      console.error("Error fetching test suspicious events:", err);
      setError("Failed to fetch test suspicious events");
      setTestSuspiciousEvents(
        suspiciousEvents.filter((e) => String(e.test_id) === String(testCode))
      );
    }
  };

  const handleTestAction = async (testCode, action) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/${action}-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthToken(),
        },
        body: JSON.stringify({ testCode }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} test`);
      await fetchTests();
    } catch (err) {
      setError(`Failed to ${action} test`);
      console.error(`Error ${action} test:`, err);
    }
    setLoading(false);
  };

  const handleTestDelete = async (testCode) => {
    if (
      !window.confirm(
        `Are you sure you want to delete test "${testCode}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:5000/delete-test", {
        method: "DELETE",
        headers: {
          Authorization: getAuthToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testCode }),
      });

      if (!response.ok) throw new Error("Failed to delete test");
      await fetchTests();
      if (selectedTest?.test_code === testCode) {
        setSelectedTest(null);
        setTestUsers([]);
        setTestSuspiciousEvents([]);
      }
    } catch (err) {
      setError("Failed to delete test");
      console.error("Error deleting test:", err);
    }
    setLoading(false);
  };

  const handleUserDelete = async (username, testCode) => {
    if (
      !window.confirm(
        `Are you sure you want to remove user "${username}" from the test "${testCode}"?`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "http://localhost:5000/delete-user-from-test",
        {
          method: "DELETE",
          headers: {
            Authorization: getAuthToken(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ testCode, username }),
        }
      );

      if (!response.ok) throw new Error("Failed to delete user");
      await fetchTestUsers(selectedTest.test_code);
    } catch (err) {
      setError("Failed to delete user");
      console.error("Error deleting user:", err);
      setTestUsers((prev) => prev.filter((u) => u.username !== username));
    }
    setLoading(false);
  };

  const handleTestClick = async (test) => {
    setSelectedTest(test);
    setError(null);
    await Promise.all([
      fetchTestUsers(test.test_code),
      fetchTestSuspiciousEvents(test.test_code),
    ]);
  };

  const deleteAllLogs = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete ALL logs? This action cannot be undone."
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:5000/delete-logs", {
        method: "DELETE",
        headers: {
          Authorization: getAuthToken(),
        },
      });
      if (!response.ok) throw new Error("Failed to delete logs");
      setSuspiciousEvents([]);
      setTestSuspiciousEvents([]);
      alert("All logs deleted successfully.");
      setStats((prev) => ({ ...prev, totalIncidents: 0 }));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown";
    try {
      if (timestamp instanceof Date) {
        return timestamp.toISOString().split("T")[0];
      }
      if (typeof timestamp === "string") {
        return timestamp.split("T")[0];
      }
      return String(timestamp).split("T")[0];
    } catch {
      return "Invalid date";
    }
  };

  const getEventColor = (eventType = "") => {
    if (eventType === "No Face Detected")
      return "bg-red-50 text-red-700 border-red-200";
    if (eventType === "Multiple Faces Detected")
      return "bg-orange-50 text-orange-700 border-orange-200";
    if (eventType === "Face Turned Away")
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (eventType.toLowerCase().includes("phone"))
      return "bg-pink-50 text-pink-700 border-pink-200";
    if (eventType.toLowerCase().includes("book"))
      return "bg-amber-50 text-amber-700 border-amber-200";
    if (eventType.toLowerCase().includes("head pose") || eventType.startsWith("Looking "))
      return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getEventIcon = (eventType = "") => {
    if (eventType === "No Face Detected") return <XCircle className="w-4 h-4" />;
    if (eventType === "Multiple Faces Detected")
      return <AlertCircle className="w-4 h-4" />;
    if (eventType === "Face Turned Away") return <Eye className="w-4 h-4" />;
    if (eventType.toLowerCase().includes("phone"))
      return <Monitor className="w-4 h-4" />;
    if (eventType.toLowerCase().includes("book"))
      return <BookIcon className="w-4 h-4" />;
    if (eventType.toLowerCase().includes("head pose") || eventType.startsWith("Looking "))
      return <Eye className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const getUserStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "suspicious":
        return "bg-red-50 text-red-700 border-red-200";
      case "inactive":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  // Simple icon for book (since not imported separately from lucide)
  const BookIcon = (props) => <Monitor {...props} />; // visually can replace with another icon if you prefer

  const filteredEvents = suspiciousEvents.filter((event) => {
    const type = (event.event_type || "").toLowerCase();
    const matchSearch =
      !searchTerm ||
      (event.username || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(event.test_id || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    if (filterType === "all") return true;
    if (filterType === "face") {
      return (
        event.event_type === "No Face Detected" ||
        event.event_type === "Multiple Faces Detected" ||
        event.event_type === "Face Turned Away"
      );
    }
    if (filterType === "phone") return type.includes("phone");
    if (filterType === "book") return type.includes("book");
    if (filterType === "head")
      return type.includes("head pose") || type.startsWith("looking ");
    return true;
  });

  // Active users by test (as in original code; assumes userSessions include test_id)
  const usersByTest = userSessions.reduce((acc, session) => {
    const testId = session.test_id;
    if (!testId) return acc;
    if (!acc[testId]) acc[testId] = [];
    acc[testId].push(session);
    return acc;
  }, {});

  const usersByTestKeys = Object.keys(usersByTest);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    ProctorAI
                  </h1>
                  <p className="text-sm text-gray-500">
                    Intelligent Exam Monitoring
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchAllData}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Live Monitoring</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {selectedTest ? (
          // ---------------- Test Detail View ----------------
          <div>
            <button
              onClick={() => {
                setSelectedTest(null);
                setTestUsers([]);
                setTestSuspiciousEvents([]);
              }}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-6 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>

            {/* Test Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {selectedTest.test_code}
                    </h1>
                    <div
                      className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                        selectedTest.is_test_started
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          selectedTest.is_test_started
                            ? "bg-green-400"
                            : "bg-gray-400"
                        }`}
                      />
                      {selectedTest.is_test_started ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <p className="text-gray-600">
                    Test Session Management & Monitoring
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleTestDelete(selectedTest.test_code)}
                    disabled={loading}
                    className="flex items-center px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete Test
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Registered Users */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          Registered Users
                        </h2>
                        <p className="text-sm text-gray-500">
                          {testUsers.length} total participants
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {testUsers.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">No users found</p>
                        <p className="text-gray-400 text-sm">
                          Users will appear here once they register
                        </p>
                      </div>
                    ) : (
                      testUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {user.username}
                              </p>
                              <p className="text-xs text-gray-400 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  Joined:{" "}
                                  {formatTimestamp(user.joined_at || new Date())}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span
                              className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${getUserStatusColor(
                                user.status || "active"
                              )}`}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {user.status || "active"}
                            </span>
                            <button
                              onClick={() =>
                                handleUserDelete(
                                  user.username,
                                  selectedTest.test_code
                                )
                              }
                              className="flex items-center px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm hover:bg-red-100 transition-colors"
                              title="Remove user from test"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Suspicious Activities for Selected Test */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Suspicious Activities
                      </h2>
                      <p className="text-sm text-gray-500">
                        {testSuspiciousEvents.length} incidents detected
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {testSuspiciousEvents.length === 0 ? (
                      <div className="text-center py-12">
                        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">All clear!</p>
                        <p className="text-gray-400 text-sm">
                          No suspicious activities detected
                        </p>
                      </div>
                    ) : (
                      testSuspiciousEvents.map((event, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-shrink-0">
                            {event.frame_path && (
                              <img
                                src={`http://localhost:5000/logs/${event.frame_path}`}
                                alt="Evidence"
                                className="w-16 h-16 object-cover rounded-xl border-2 border-gray-200 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                                onClick={() => {
                                  const w = window.open();
                                  if (w) {
                                    w.document.write(
                                      `<img src="http://localhost:5000/logs/${event.frame_path}" style="max-width:100%;height:auto;" />`
                                    );
                                  }
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <span
                                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${getEventColor(
                                  event.event_type
                                )}`}
                              >
                                {getEventIcon(event.event_type)}
                                <span className="ml-1">
                                  {event.event_type}
                                </span>
                              </span>
                              <span className="text-xs text-gray-500 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              {event.username}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ---------------- Main Dashboard ----------------
          <div>
            {/* Dashboard Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Admin Dashboard
                </h1>
                <p className="text-gray-600">
                  Monitor and manage all proctoring sessions
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => navigate("/log-review")}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Search className="w-5 h-5" />
                  <span>Search Logs</span>
                </button>
                <button
                  onClick={deleteAllLogs}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl hover:from-rose-600 hover:to-red-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Settings className="w-5 h-5" />
                  <span>Delete All Logs</span>
                </button>
              </div>
            </div>

            {/* High-level Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Tests"
                value={stats.totalTests}
                subtitle="All time"
                icon={Activity}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
              />
              <StatCard
                title="Active Tests"
                value={stats.activeTests}
                subtitle="Currently running"
                valueClass="text-green-600"
                icon={Play}
                iconBg="bg-green-100"
                iconColor="text-green-600"
              />
              <StatCard
                title="Active Users"
                value={stats.totalUsers}
                subtitle="Sessions recorded"
                valueClass="text-purple-600"
                icon={Users}
                iconBg="bg-purple-100"
                iconColor="text-purple-600"
              />
              <StatCard
                title="Total Incidents"
                value={stats.totalIncidents}
                subtitle="All logged events"
                valueClass="text-red-600"
                icon={AlertTriangle}
                iconBg="bg-red-100"
                iconColor="text-red-600"
              />
            </div>

            {/* Incident breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <MiniStat
                label="Face / Presence"
                value={stats.faceIncidents}
                color="text-amber-600"
                bg="bg-amber-50"
                icon={Eye}
              />
              <MiniStat
                label="Phone Use"
                value={stats.phoneIncidents}
                color="text-pink-600"
                bg="bg-pink-50"
                icon={Monitor}
              />
              <MiniStat
                label="Books / Notes"
                value={stats.bookIncidents}
                color="text-amber-700"
                bg="bg-amber-50"
                icon={AlertTriangle}
              />
              <MiniStat
                label="Head Pose"
                value={stats.headIncidents}
                color="text-blue-700"
                bg="bg-blue-50"
                icon={Eye}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Test Management */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Test Management
                      </h2>
                      <p className="text-sm text-gray-500">
                        Click on a test to view its participants and incidents
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {tests.length === 0 ? (
                    <div className="text-center py-12">
                      <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No tests found</p>
                      <p className="text-gray-400 text-sm">
                        Create tests from your admin panel
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tests.map((test, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group"
                          onClick={() => handleTestClick(test)}
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-4 h-4 rounded-full ${
                                test.is_test_started
                                  ? "bg-green-400 animate-pulse"
                                  : "bg-gray-300"
                              }`}
                            />
                            <div>
                              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {test.test_code}
                              </p>
                              <p className="text-sm text-gray-500">
                                {test.is_test_started ? "Active Session" : "Inactive"}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {!test.is_test_started ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTestAction(test.test_code, "start");
                                }}
                                disabled={loading}
                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 shadow-sm hover:shadow-md transition-all"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Start
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTestAction(test.test_code, "end");
                                }}
                                disabled={loading}
                                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 shadow-sm hover:shadow-md transition-all"
                              >
                                <Square className="w-4 h-4 mr-1" />
                                Stop
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTestDelete(test.test_code);
                              }}
                              disabled={loading}
                              className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 shadow-sm hover:shadow-md transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Suspicious Activities (Global) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          Recent Activities
                        </h2>
                        <p className="text-sm text-gray-500">
                          Latest security incidents across all tests
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Events</option>
                        <option value="face">Face / Presence</option>
                        <option value="phone">Phone</option>
                        <option value="book">Book / Notes</option>
                        <option value="head">Head Pose</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center mb-4 space-x-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter by username or test id..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {filteredEvents.length === 0 ? (
                      <div className="text-center py-12">
                        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">All secure!</p>
                        <p className="text-gray-400 text-sm">
                          No suspicious activities detected
                        </p>
                      </div>
                    ) : (
                      filteredEvents.slice(0, 15).map((event, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-shrink-0">
                            {event.frame_path && (
                              <img
                                src={`http://localhost:5000/logs/${event.frame_path}`}
                                alt="Evidence"
                                className="w-16 h-16 object-cover rounded-xl border-2 border-gray-200 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                                onClick={() => {
                                  const w = window.open();
                                  if (w) {
                                    w.document.write(
                                      `<img src="http://localhost:5000/logs/${event.frame_path}" style="max-width:100%;height:auto;" />`
                                    );
                                  }
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <span
                                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${getEventColor(
                                  event.event_type
                                )}`}
                              >
                                {getEventIcon(event.event_type)}
                                <span className="ml-1">
                                  {event.event_type}
                                </span>
                              </span>
                              <span className="text-xs text-gray-500 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              {event.username}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center space-x-1">
                              <Monitor className="w-3 h-3" />
                              <span>Test {event.test_id}</span>
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Users by Test */}
            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Active Users by Test
                    </h2>
                    <p className="text-sm text-gray-500">
                      Real-time user activity across all sessions
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {usersByTestKeys.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No active sessions</p>
                    <p className="text-gray-400 text-sm">
                      Active users will appear here when tests are running
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {usersByTestKeys.map((testId) => {
                      const sessionsForTest = usersByTest[testId] || [];
                      const testInfo = tests.find(
                        (t) => String(t.test_code) === String(testId)
                      );

                      return (
                        <div
                          key={testId}
                          className="border border-gray-200 rounded-2xl overflow-hidden"
                        >
                          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div
                                  className={`w-4 h-4 rounded-full ${
                                    testInfo?.is_test_started
                                      ? "bg-green-400 animate-pulse"
                                      : "bg-gray-300"
                                  }`}
                                />
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    Test {testId}
                                  </h3>
                                  <p className="text-sm text-gray-600 flex items-center space-x-4">
                                    <span className="flex items-center space-x-1">
                                      <Users className="w-4 h-4" />
                                      <span>
                                        {sessionsForTest.length} active user
                                        {sessionsForTest.length !== 1
                                          ? "s"
                                          : ""}
                                      </span>
                                    </span>
                                    {testInfo && (
                                      <span
                                        className={`flex items-center space-x-1 font-medium ${
                                          testInfo.is_test_started
                                            ? "text-green-600"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        <div
                                          className={`w-2 h-2 rounded-full ${
                                            testInfo.is_test_started
                                              ? "bg-green-400"
                                              : "bg-gray-400"
                                          }`}
                                        />
                                        <span>
                                          {testInfo.is_test_started
                                            ? "Test Active"
                                            : "Test Inactive"}
                                        </span>
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const t = tests.find(
                                    (tt) =>
                                      String(tt.test_code) === String(testId)
                                  );
                                  if (t) handleTestClick(t);
                                }}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
                              >
                                <Eye className="w-4 h-4" />
                                <span>View Details</span>
                              </button>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    User
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    IP Address
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Session Started
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {sessionsForTest.map((session, index) => (
                                  <tr
                                    key={index}
                                    className="hover:bg-gray-50 transition-colors"
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                          <span className="text-white font-semibold text-sm">
                                            {session.username
                                              ?.charAt(0)
                                              .toUpperCase() || "U"}
                                          </span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {session.username}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                                        {session.ip_address || "N/A"}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                      <div className="flex items-center space-x-1">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>
                                          {formatTimestamp(
                                            session.session_login
                                          )}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                                        Active
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:bg-blue-50 px-3 py-1 rounded transition-colors">
                                        Monitor
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Small statistic card component
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  valueClass = "text-gray-900",
}) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  </div>
);

// Mini stat pill
const MiniStat = ({ label, value, color, bg, icon: Icon }) => (
  <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-200 bg-white`}>
    <div className="flex items-center space-x-3">
      <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-lg font-semibold ${color}`}>{value}</p>
      </div>
    </div>
  </div>
);

export default Dashboard;