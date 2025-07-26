import React, { useEffect, useState } from 'react';
import axios from 'axios';

function ReviewLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [testId, setTestId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted || !username || !testId) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/get-logs-json', {
          params: { username, test_id: testId },
        });
        setLogs(response.data);
      } catch (err) {
        console.error('Error fetching logs:', err);
        setLogs([]);
      } finally {
        setLoading(false);
        setSubmitted(false);
      }
    };

    fetchLogs();
  }, [submitted]);

  const formatTimestamp = (timestamp) => {
  // Example input: "2025-07-26_15-11-51-014822"
  // Replace underscores and dashes to form a proper ISO-like string
  const cleaned = timestamp
    .replace('_', 'T')          // Replace underscore between date and time with 'T'
    .replace(/-/g, ':')         // Replace all dashes with colons (in the time part)
    .replace('T15:11:51:014822', 'T15:11:51.014822'); // Fix milliseconds (replace last colon with dot)

  // Note: The last replace is to convert time to HH:MM:SS.MS format if needed

  // Or more simply, split and rebuild like this:

  const parts = timestamp.split('_'); // ['2025-07-26', '15-11-51-014822']
  if (parts.length !== 2) return timestamp;

  const datePart = parts[0]; // '2025-07-26'
  let timePart = parts[1];   // '15-11-51-014822'


  const timeParts = timePart.split('-');
  if (timeParts.length >= 4) {
    timePart = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${timeParts.slice(3).join('')}`;
  }

  const isoString = `${datePart}T${timePart}`;

  const date = new Date(isoString);
  if (isNaN(date)) return timestamp;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
        Suspicious Event Logs
      </h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row items-stretch gap-4 justify-center mb-8"
      >
        <div className="flex flex-col w-full md:w-1/3">
          <label htmlFor="username" className="mb-1 font-medium text-gray-700">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter username"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-col w-full md:w-1/3">
          <label htmlFor="testId" className="mb-1 font-medium text-gray-700">
            Test Code
          </label>
          <input
            id="testId"
            type="text"
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            required
            placeholder="Enter test ID"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          type="submit"
          className="md:self-end px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
        >
          Load Logs
        </button>
      </form>

      {loading && (
        <p className="text-center text-gray-600 text-lg animate-pulse">Loading logs...</p>
      )}

      {!loading && submitted && logs.length === 0 && (
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
                <span className="font-mono text-gray-500 text-sm">{formatTimestamp(log.timestamp)}</span>
                <span className="text-sm text-gray-700 mt-2 sm:mt-0">
                  <strong>{log.username}</strong> | Test {log.test_id} |{' '}
                  <em className="text-gray-600">{log.event_type}</em>
                </span>
              </div>
              <div className="w-full flex justify-center">
                <img
                  src={`http://localhost:5000/logs/${log.frame_path}`}
                  alt={log.event_type}
                  className="w-full max-w-md rounded-md object-contain"
                  loading="lazy"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ReviewLogs;
