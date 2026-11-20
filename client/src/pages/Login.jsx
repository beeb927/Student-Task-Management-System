import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "../services/api";
import GoogleButton from "../components/GoogleButton";
import { googleErrorMessage } from "../utils/googleMessages";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Message sent from the Register page (if any)
  const successMessage = location.state?.message;
  // Set by the server when Google sign-in fails (e.g. ?google_error=cancelled)
  const googleError = googleErrorMessage(new URLSearchParams(location.search).get("google_error"));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await loginUser({ email, password }); // server sets the cookie
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Is the server running?");
    }
  };

  return (
    <div className="container">
      <h2>Login</h2>

      {successMessage && <p className="success">{successMessage}</p>}
      {(error || googleError) && <p className="error">{error || googleError}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>

      <div className="or-divider"><span>or</span></div>
      <GoogleButton />

      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

export default Login;