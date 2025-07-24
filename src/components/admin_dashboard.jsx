import React, { useEffect, useState } from 'react';
import { Play, Square, RotateCcw, Users, AlertTriangle, Activity, RefreshCw, Eye } from 'lucide-react';

const Dashboard = () => {
  const [tests, setTests] = useState([]);
  const [suspiciousEvents, setSuspiciousEvents] = useState([]);
  const [userSessions, setUserSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTests: 0,
    activeTests: 0,
    totalUsers: 0,
    totalIncidents: 0
  });

  // Get token from localStorage (you'll need to implement proper auth)
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || 'Bearer_admin_admin_token';
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchSuspiciousEvents, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTests(),
        fetchSuspiciousEvents(),
        fetchUserSessions()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchTests = async () => {
    try {
      const response = await fetch('http://localhost:5000/get-all-tests');
      const data = await response.json();
      setTests(data);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalTests: data.length,
        activeTests: data.filter(test => test.is_test_started).length
      }));
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  };

  const fetchSuspiciousEvents = async () => {
    try {
      const response = await fetch('http://localhost:5000/admin/suspicious-events?limit=50', {
        headers: {
          'Authorization': getAuthToken()
        }
      });
      const data = await response.json();
      setSuspiciousEvents(data.events || []);
      
      setStats(prev => ({
        ...prev,
        totalIncidents: data.events?.length || 0
      }));
    } catch (error) {
      console.error('Error fetching suspicious events:', error);
    }
  };

  const fetchUserSessions = async () => {
    try {
      const response = await fetch('http://localhost:5000/get-user-sessions', {
        headers: {
          'Authorization': getAuthToken()
        }
      });
      const data = await response.json();
      setUserSessions(data);
      
      setStats(prev => ({
        ...prev,
        totalUsers: data.length
      }));
    } catch (error) {
      console.error('Error fetching user sessions:', error);
    }
  };

  const handleTestAction = async (testCode, action) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/${action}-test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': getAuthToken()
        },
        body: JSON.stringify({ testCode })
      });
      
      if (response.ok) {
        await fetchTests();
      }
    } catch (error) {
      console.error(`Error ${action} test:`, error);
    }
    setLoading(false);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'No Face Detected':
        return 'bg-red-100 text-red-800';
      case 'Multiple Faces Detected':
        return 'bg-orange-100 text-orange-800';
      case 'Face Turned Away':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Monitor tests and user activities</p>
            </div>
            <button
              onClick={fetchAllData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Play className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Tests</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeTests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Incidents</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalIncidents}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Management */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Test Management</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {tests.map((test, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${test.is_test_started ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                      <div>
                        <p className="font-medium text-gray-900">{test.test_code}</p>
                        <p className="text-sm text-gray-500">
                          {test.is_test_started ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {!test.is_test_started ? (
                        <button
                          onClick={() => handleTestAction(test.test_code, 'start')}
                          disabled={loading}
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTestAction(test.test_code, 'end')}
                          disabled={loading}
                          className="flex items-center px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          <Square className="w-4 h-4 mr-1" />
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Suspicious Activities */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Recent Suspicious Activities</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {suspiciousEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No suspicious activities detected</p>
                  </div>
                ) : (
                  suspiciousEvents.slice(0, 10).map((event, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0">
                        {event.frame_data && (
                          <img
                            src={`data:image/jpeg;base64,${event.frame_data}`}
                            alt="Evidence"
                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:scale-150 transition-transform"
                            onClick={() => {
                              const newWindow = window.open();
                              newWindow.document.write(`<img src="data:image/jpeg;base64,${event.frame_data}" style="max-width:100%;height:auto;" />`);
                            }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getEventColor(event.event_type)}`}>
                            {event.event_type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 font-medium">{event.username}</p>
                        <p className="text-xs text-gray-500">{event.test_code}</p>
                        {event.additional_info && (
                          <p className="text-xs text-gray-600 mt-1">{event.additional_info}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active User Sessions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Active User Sessions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session Login
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userSessions.map((session, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {session.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.test_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.ip_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.session_login}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;