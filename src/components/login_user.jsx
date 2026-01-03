import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTestContext } from "./Context.jsx";
import logo from "../assets/logoexam.jpg";

const Login_user = () => {
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const { login, error } = useTestContext();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await login(usernameInput, password);

      if (result.success) {
        // Persist username for proctoring pipeline (used by video + backend)
        localStorage.setItem("username", usernameInput);

        navigate("/user", { state: { username: usernameInput } });
      } else {
        // Context already exposes result.message as `error` usually
        console.log("Login failed:", result.message);
      }
    } catch (err) {
      console.error("User login error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-gray-900">
      <img className="w-24 h-24 rounded-full m-8" alt="Logo" src={logo} />
      <h1 className="font-Zen font-medium text-3xl mb-2 text-black">
        ProctoringAI
      </h1>

      <div className="w-80 rounded-lg bg-gray-100 p-8 shadow-xl">
        <p className="text-center text-xl font-bold text-black font-Orbitron">
          User Login
        </p>
        <form className="mt-6" onSubmit={handleSubmit}>
          <div className="mt-1 text-sm">
            <label
              htmlFor="username"
              className="block text-gray-900 font-Lex mb-1"
            >
              Username:
            </label>
            <input
              type="text"
              name="username"
              id="username"
              autoComplete="username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full rounded-md border border-black bg-white px-3 py-2 text-black focus:border-indigo-400 focus:outline-none"
              required
            />
          </div>
          <div className="mt-4 text-sm">
            <label
              htmlFor="password"
              className="block text-gray-900 font-Lex mb-1"
            >
              Password:
            </label>
            <input
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-black bg-white px-3 py-2 text-black focus:border-indigo-400 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-black py-2 text-white font-semibold hover:bg-indigo-950 disabled:opacity-60 font-Orbitron"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600 font-medium text-center">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-black font-Lex">
          Don&apos;t have an account?{" "}
          <a
            href="/Register"
            className="text-black hover:underline hover:text-indigo-600"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login_user;