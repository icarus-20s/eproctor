import React, { useEffect, useState } from "react";
import axios from "axios";

function ReviewLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [testId, setTestId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [error, setError] = useState("");

  const getAuthToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  useEffect(() => {
    if (!submitted || !username || !testId) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(
          "http://localhost:5000/get-logs-json",
          {
            params: { username, test_id: testId },
            headers: {
              Authorization: getAuthToken(),
            },
          }
        );
        setLogs(response.data || []);
      } catch (err) {
        console.error("Error fetching logs:", err);
        setLogs([]);
        setError("Failed to fetch logs. Please try again.");
      } finally {
        setLoading(false);
        setSubmitted(false);
      }
    };

    fetchLogs();
  }, [submitted, username, testId]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown";
    try {
      // Backend uses: '%Y-%m-%d_%H-%M-%S-%f'
      if (typeof timestamp === "string" && timestamp.includes("_")) {
        const [datePart, timePartRaw] = timestamp.split("_"); // '2025-07-26', '15-11-51-014822'
        const tParts = timePartRaw.split("-");
        if (tParts.length >= 4) {
          const [hh, mm, ss, ...msRest] = tParts;
          const ms = msRest.join("");
          const iso = `${datePart}T${hh}:${mm}:${ss}.${ms}`;
          const dateObj = new Date(iso);
          if (!isNaN(dateObj)) {
            return dateObj.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
        }
      }

      // Fallback: try direct Date parsing
      const d = new Date(timestamp);
      if (!isNaN(d)) {
        return d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      return timestamp;
    } catch {
      return timestamp;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setHasQueried(true);
    setSubmitted(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">
        Suspicious Event Logs
      </h1>
      <p className="text-center text-sm text-gray-600 mb-8">
        Filter and review AI-detected suspicious events (e.g., multiple faces,
        phones, or books) for a specific user and test.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row items-stretch gap-4 justify-center mb-8"
      >
        <div className="flex flex-col w-full md:w-1/3">
          <label
            htmlFor="username"
            className="mb-1 font-medium text-gray-700 text-sm"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter username"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>

        <div className="flex flex-col w-full md:w-1/3">
          <label
            htmlFor="testId"
            className="mb-1 font-medium text-gray-700 text-sm"
          >
            Test ID / Code
          </label>
          <input
            id="testId"
            type="text"
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            required
            placeholder="Enter test ID"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>

        <button
          type="submit"
          className="md:self-end px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition text-sm"
        >
          Load Logs
        </button>
      </form>

      {/* Optional static helper / legend */}
      <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600">
        <p className="font-semibold mb-1">Note:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Logs include events such as <em>No Face Detected</em>,{" "}
            <em>Multiple Faces Detected</em>, <em>Face Turned Away</em>,{" "}
            <em>Phone Detected</em>, and <em>Book Detected</em>.
          </li>
          <li>
            Each entry shows the captured frame at the time of detection, along
            with user, test ID, and timestamp.
          </li>
        </ul>
      </div>

      {loading && (
        <p className="text-center text-gray-600 text-lg animate-pulse">
          Loading logs...
        </p>
      )}

      {!loading && error && (
        <p className="text-center text-red-500 font-semibold text-sm mb-4">
          {error}
        </p>
      )}

      {!loading && hasQueried && logs.length === 0 && !error && (
        <p className="text-center text-red-500 font-semibold text-lg">
          No logs found for this user/test.
        </p>
      )}

      {!loading && logs.length > 0 && (
        <ul className="space-y-6">
          {logs.map((log) => (
            <li
              key={log.id}
              className="border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition bg-white"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
                <span className="font-mono text-gray-500 text-xs">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="text-sm text-gray-700 mt-2 sm:mt-0">
                  <strong>{log.username}</strong> | Test {log.test_id} |{" "}
                  <em className="text-gray-600">{log.event_type}</em>
                </span>
              </div>
              {log.frame_path && (
                <div className="w-full flex justify-center">
                  <img
                    src={`http://localhost:5000/logs/${log.frame_path}`}
                    alt={log.event_type}
                    className="w-full max-w-md rounded-md object-contain border border-gray-200"
                    loading="lazy"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ReviewLogs;