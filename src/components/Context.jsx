import React, { createContext, useContext, useState, useEffect } from 'react';

const TestContext = createContext();

export const TestProvider = ({ children }) => {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [token, setToken] = useState('');
  const [testData, setTestData] = useState(null);
  const [testCode, setTestCode] = useState('');
  const [error, setError] = useState('');

  // Restore session from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    const storedToken = localStorage.getItem('authToken');
    const storedTestCode = localStorage.getItem('testCode');

    if (storedUsername) setUsername(storedUsername);
    if (storedRole) setRole(storedRole);
    if (storedToken) setToken(storedToken);
    if (storedTestCode) setTestCode(storedTestCode);
  }, []);

const login = async (usernameInput, password) => {
  setError('');
  try {
    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password }),
    });

    const data = await res.json();

    if (res.ok) {
      const receivedToken = data.token;
      const extractedUsername = receivedToken.replace('Bearer ', '').replace('-token', '');
      const extractedRole = extractedUsername === 'admin' ? 'admin' : 'user';

      setUsername(extractedUsername);
      setRole(extractedRole);
      setToken(receivedToken);

      localStorage.setItem('username', extractedUsername);
      localStorage.setItem('role', extractedRole);
      localStorage.setItem('authToken', receivedToken);

      return { success: true, username: extractedUsername, role: extractedRole };
    } else {
      setError(data.message || 'Login failed');
      return { success: false, message: data.message };
    }
  } catch (err) {
    setError('Unexpected error during login');
    return { success: false, message: 'Unexpected error during login' };
  }
};


const logout = (navigate) => {
  setUsername('');
  setRole('');
  setToken('');
  setTestCode('');
  setTestData(null);
  setError('');

  localStorage.removeItem('username');
  localStorage.removeItem('role');
  localStorage.removeItem('authToken');
  localStorage.removeItem('testCode');
  
  }
  // Fetch test data
  const fetchTestData = async (code) => {
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/get-test-data/${code}`);
      const data = await res.json();

      if (res.ok) {
        setTestData(data);
        setTestCode(code);
        localStorage.setItem('testCode', code);
        return { success: true, data };
      } else {
        setError(data.message || 'Failed to fetch test data');
        return { success: false, message: data.message };
      }
    } catch (err) {
      setError('Unexpected error while fetching test data');
      return { success: false, message: 'Unexpected error while fetching test data' };
    }
  };

  return (
    <TestContext.Provider
      value={{
        username,
        role,
        token,
        testData,
        testCode,
        error,
        login,
        logout,
        fetchTestData,
        setTestData,
        setTestCode,
        setError,
      }}
    >
      {children}
    </TestContext.Provider>
  );
};

export const useTestContext = () => useContext(TestContext);
