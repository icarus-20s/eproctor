import React, { useState, useEffect } from 'react';

const LogsManager = ({ username, testId }) => {
  const [suspiciousEvents, setSuspiciousEvents] = useState([]);
  const [error, setError] = useState('');

  const fetchSuspiciousEvents = async () => {
    try {
      const response = await fetch('http://localhost:5000/get-logs-json', {
        headers: {
          'Authorization': getAuthToken()
        }
      });
      if (!response.ok) throw new Error('Failed to fetch suspicious events');
      const data = await response.json();
      setSuspiciousEvents(data || []);
      
      setStats(prev => ({
        ...prev,
        totalIncidents: data?.length || 0
      }));
    } catch (error) {
      setError('Failed to fetch suspicious events');
      console.error('Error fetching suspicious events:', error);
    }
  };
  // Delete logs from backend
  const deleteLogs = async () => {
    try {
      const response = await fetch('http://localhost:5000/delete-logs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthToken(),
        },
        body: JSON.stringify({ username, test_id: testId })
      });

      if (!response.ok) throw new Error('Failed to delete logs');

      // Refresh logs after successful delete
      fetchSuspiciousEvents();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchSuspiciousEvents();
  }, [username, testId]);

  return (
    <div>
      <h3>Suspicious Events ({suspiciousEvents.length})</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={deleteLogs}>Delete Logs</button>
      <button onClick={fetchSuspiciousEvents}>Refresh Logs</button>

      <ul>
        {suspiciousEvents.map(event => (
          <li key={event.id}>
            {event.timestamp} - {event.event} by {event.username}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LogsManager;
