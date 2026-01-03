import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

const TestContext = createContext();

export const TestProvider = ({ children }) => {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [token, setToken] = useState("");
  const [testData, setTestData] = useState(null);
  const [testCode, setTestCode] = useState("");
  const [error, setError] = useState("");

  // Helper: decode backend token payload (urlsafe base64 JSON)
  const decodeTokenPayload = (rawToken) => {
    if (!rawToken) return null;
    try {
      // Our backend uses base64.urlsafe_b64encode
      const base64 = rawToken.replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(base64);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // Restore session from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    const storedRole = localStorage.getItem("role");
    const storedToken = localStorage.getItem("token");
    const storedTestCode = localStorage.getItem("testCode");

    if (storedUsername) setUsername(storedUsername);
    if (storedRole) setRole(storedRole);
    if (storedToken) setToken(storedToken);
    if (storedTestCode) setTestCode(storedTestCode);
  }, []);

  const login = async (usernameInput, password) => {
    setError("");
    try {
      const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const receivedToken = data.token;
        if (!receivedToken) {
          setError("Login response did not contain a token.");
          return { success: false, message: "No token returned" };
        }

        const payload = decodeTokenPayload(receivedToken);
        const extractedUsername = payload?.username || usernameInput;
        const extractedRole =
          payload?.role || (extractedUsername === "admin" ? "admin" : "user");

        setUsername(extractedUsername);
        setRole(extractedRole);
        setToken(receivedToken);

        localStorage.setItem("username", extractedUsername);
        localStorage.setItem("role", extractedRole);
        localStorage.setItem("token", receivedToken);

        return {
          success: true,
          username: extractedUsername,
          role: extractedRole,
        };
      } else {
        const msg = data.message || "Login failed";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Unexpected error during login");
      return { success: false, message: "Unexpected error during login" };
    }
  };

  const logout = () => {
    setUsername("");
    setRole("");
    setToken("");
    setTestCode("");
    setTestData(null);
    setError("");

    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("testCode");
  };

  const fetchTestData = async (code) => {
    setError("");
    try {
      const res = await fetch(
        `http://localhost:5000/get-test-data/${code}`
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setTestData(data);
        setTestCode(code);
        localStorage.setItem("testCode", code);
        return { success: true, data };
      } else {
        const msg = data.error || data.message || "Failed to fetch test data";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Fetch test data error:", err);
      setError("Unexpected error while fetching test data");
      return {
        success: false,
        message: "Unexpected error while fetching test data",
      };
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