import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getTasks } from "../services/api";
import { formatDue, isDueSoon, isOverdue, sortTasks } from "../utils/taskUtils";

const CHECK_EVERY_MS = 60 * 1000;

// US-12: shows a banner for overdue tasks and tasks due in the next 24 hours,
// and (if the user allows it) sends a browser notification once per task.
function Reminders() {
  const [alerts, setAlerts] = useState({ overdue: [], soon: [] });
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const notified = useRef(new Set());

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await getTasks();
        if (cancelled) return;
        const now = new Date();
        const overdue = sortTasks(data.tasks.filter((t) => isOverdue(t, now)), now);
        const soon = data.tasks
          .filter((t) => isDueSoon(t, now, 24))
          .sort((a, b) => a.due_date.localeCompare(b.due_date));
        setAlerts({ overdue, soon });

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          [...overdue, ...soon].forEach((t) => {
            const key = `${t.id}-${t.due_date}`;
            if (!notified.current.has(key)) {
              notified.current.add(key);
              new Notification(isOverdue(t, now) ? "Overdue task" : "Task due soon", {
                body: `${t.title} - ${formatDue(t.due_date)}`,
              });
            }
          });
        }
      } catch {
        /* ignore: the page itself redirects if the session expired */
      }
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const enableNotifications = async () => {
    setPermission(await Notification.requestPermission());
  };

  const total = alerts.overdue.length + alerts.soon.length;
  if (dismissed || total === 0) return null;

  return (
    <div className="reminder-banner" role="alert">
      <div>
        {alerts.overdue.length > 0 && (
          <p>
            <strong>{alerts.overdue.length} overdue:</strong>{" "}
            {alerts.overdue.slice(0, 3).map((t) => t.title).join(", ")}
            {alerts.overdue.length > 3 && "..."}
          </p>
        )}
        {alerts.soon.length > 0 && (
          <p>
            <strong>{alerts.soon.length} due in the next 24 hours:</strong>{" "}
            {alerts.soon.slice(0, 3).map((t) => `${t.title} (${formatDue(t.due_date)})`).join(", ")}
            {alerts.soon.length > 3 && "..."}
          </p>
        )}
      </div>
      <div className="reminder-actions">
        <Link to="/dashboard">View tasks</Link>
        {permission === "default" && (
          <button onClick={enableNotifications}>Enable browser alerts</button>
        )}
        <button onClick={() => setDismissed(true)} aria-label="Dismiss reminders">Dismiss</button>
      </div>
    </div>
  );
}

export default Reminders;
