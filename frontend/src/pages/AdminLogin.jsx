import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../api";

function AdminLogin({ adminPath }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await loginAdmin({ username, password });
    setSubmitting(false);

    if (!result.ok || !result.data?.success) {
      setError(result.data?.error || "Invalid username or password.");
      return;
    }

    navigate(`/${adminPath}`);
  }

  return (
    <div className="login-wrap">
      <h1 className="login-title">Admin Login</h1>

      {error && (
        <div className="login-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="login-field">
          <label className="login-label" htmlFor="username">
            Username
          </label>
          <input
            className="login-input"
            id="username"
            name="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="login-field">
          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input
            className="login-input"
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="login-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminLogin;
