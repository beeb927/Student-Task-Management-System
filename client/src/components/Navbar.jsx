import { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../services/api";

const sections = [
  ["/dashboard", "Dashboard"],
  ["/calendar", "Calendar"],
  ["/schedule", "Class Schedule"],
  ["/sleep", "Sleep Log"],
  ["/courses", "Courses"],
];

function Navbar({ userName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const menuButton = useRef(null);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout failed:", err);
    }
    navigate("/login");
  };

  return (
    <nav className="navbar" aria-label="Main navigation" onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen && menuButton.current.getClientRects().length) {
        setMenuOpen(false);
        menuButton.current.focus();
      }
    }}>
      <h3>Student Task Manager</h3>
      <button type="button" ref={menuButton} className="planner-menu" aria-expanded={menuOpen}
        aria-controls="planner-nav-links" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
      <div id="planner-nav-links" className="planner-nav-content" data-open={menuOpen}>
        <div className="nav-links">
          {sections.map(([path, label]) => (
            <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
        </div>
        <div className="nav-account">
          <span>Hello, {userName}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
