import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import "../planner.css";
import Navbar from "./Navbar";
import Reminders from "./Reminders";
import { getCurrentUser } from "../services/api";

// Wraps every logged-in page: checks the session, shows the navbar and reminders.
function Layout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const response = await getCurrentUser();
        setUser(response.data.user);
      } catch {
        navigate("/login"); // not logged in (401)
      } finally {
        setLoading(false);
      }
    };
    checkLogin();
  }, [navigate]);

  if (loading) return <p className="container">Loading...</p>;
  if (!user) return null; // redirecting to /login

  return (
    <div className="planner-shell">
      <Navbar userName={user.name} />
      <div className="planner-body">
        <Reminders />
        <main className="planner-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
