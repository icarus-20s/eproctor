import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logoexam.jpg";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user"); // Default role as 'user'
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (data.role === "admin") {
          navigate("/login_admin");
        } else if (data.role === "user") {
          navigate("/login_user");
        } else {
          setError(
            data.message || "Registration succeeded but returned unknown role."
          );
        }
      } else {
        setError(data.message || data.error || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-white text-gray-900">
      <img className="w-24 h-24 rounded-full m-8" alt="Logo" src={logo} />
      <h1 className="font-Zen font-medium text-3xl mb-2 text-black">
        ProctoringAI
      </h1>

      <div className="flex flex-col justify-center items-center bg-gray-100 p-8 rounded-lg shadow-xl w-96">
        <h1 className="mb-4 font-medium text-2xl text-black font-Orbitron">
          Register
        </h1>

        {/* Static helper text (non-breaking) */}
        <p className="text-xs text-gray-600 mb-4 font-Lex text-center">
          Create an account as a student or admin. Your role will determine
          which dashboard you access after login.
        </p>

        <form onSubmit={handleSubmit} className="w-full">
          <div className="mb-4 font-Lex">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full p-2 rounded-lg text-slate-950 border border-black focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="mb-4 font-Lex">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full p-2 rounded-lg text-slate-950 border border-black focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="mb-2 font-Lex text-black">
            <label htmlFor="role" className="block mb-1 text-sm">
              Select Role:
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg p-2 text-slate-950 border border-black bg-white focus:outline-none focus:border-indigo-400"
            >
              <option value="user" className="text-slate-950">
                User
              </option>
              <option value="admin" className="text-slate-950">
                Admin
              </option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-black py-2 text-white font-semibold hover:bg-indigo-950 disabled:opacity-60 font-Orbitron"
          >
            {submitting ? "Registering..." : "Register"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600 font-medium text-center">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-black font-Lex text-center">
          Already have an account?{" "}
          <a
            href="/login_user"
            className="text-black hover:underline hover:text-indigo-600"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default Register;