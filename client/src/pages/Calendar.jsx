// app/client/src/pages/Calendar.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import StudyCheckIn from "../components/StudyCheckIn";
import { formatMinutes } from "../utils/duration";
import { loadPlanningEvents, needsPlanUpdate } from "../utils/studyPlanSync";
import {
  API_BASE_URL, disconnectGoogle, getClasses, getGoogleEvents, getGoogleStatus, getTasks,
  checkInStudySession, getStudyPlan, saveStudyPlan,
} from "../services/api";
import { googleErrorMessage } from "../utils/googleMessages";
import {
  addDays, calculateStudyPlan, dayKey, durationMinutes, eventsForDay, monthGrid, startOfDay, startOfWeek, studyTotals,
} from "../utils/calendarUtils";
import { formatDue, isOverdue, parseDateTime } from "../utils/taskUtils";

// Helper to convert "HH:MM" to minutes from midnight
function timeToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

// Compute proportional height: 1 hr (60 min) = 44px
function getEventHeight(event, view) {
  if (view === "month") return undefined; // Month view remains compact chips

  let durationMinutes = 60; // Default fallback: 1 hour (44px)

  if (event.kind === "segment") {
    const s = event.data;
    if (s.start_time && s.end_time) {
      durationMinutes = Math.max(30, timeToMinutes(s.end_time) - timeToMinutes(s.start_time));
    }
  } else if (event.kind === "class") {
    const c = event.data;
    if (c.start_time && c.end_time) {
      durationMinutes = Math.max(30, timeToMinutes(c.end_time) - timeToMinutes(c.start_time));
    }
  } else if (event.kind === "google") {
    const g = event.data;
    if (g.allDay) {
      return 36; // All-day events stay compact
    }
    if (g.start_time && g.end_time) {
      const endM = g.end_time === "24:00" ? 24 * 60 : timeToMinutes(g.end_time);
      durationMinutes = Math.max(30, endM - timeToMinutes(g.start_time));
    }
  } else if (event.kind === "task") {
    return 36; // Deadlines represent a milestone / point in time
  }

  // 44px per hour (~0.73px per minute)
  return Math.round((durationMinutes / 60) * 44);
}

function EventChip({ event, onOpenTask, onCheckIn, view }) {
  const dynamicHeight = getEventHeight(event, view);
  const proportionalStyle = dynamicHeight ? { minHeight: `${dynamicHeight}px` } : {};

  if (event.kind === "class") {
    const c = event.data;
    const isHabit = ["Sleep", "Hobby", "Work"].includes(c.type);
    return (
      <div
        className="chip chip-class"
        style={{
          borderLeftColor: c.course_color || (c.type === "Sleep" ? "#5a6268" : c.type === "Hobby" ? "#28a745" : "#888"),
          background: isHabit ? "#f0f2f5" : undefined,
          ...proportionalStyle,
        }}
        title={`${c.title} (${c.type}) ${c.start_time}-${c.end_time}${c.location ? " @ " + c.location : ""}`}
      >
        <strong>{c.start_time} - {c.end_time}</strong> [{c.type}] {c.title}{c.overnightPart === "continues" ? " (from previous night)" : c.overnightPart === "starts" ? " (continues overnight)" : ""}
        {c.location && <div style={{ fontSize: "11px", opacity: 0.85 }}>@{c.location}</div>}
      </div>
    );
  }

  if (event.kind === "google") {
    const g = event.data;
    const e = g.event;
    return (
      <a
        className={`chip chip-google ${e.busy === false ? "chip-free" : ""}`}
        href={e.link || undefined}
        target="_blank"
        rel="noreferrer"
        style={proportionalStyle}
        title={`${e.title} (Google Calendar) ${g.allDay ? "all day" : `${g.start_time}-${g.end_time}`}${e.location ? " @ " + e.location : ""}`}
      >
        <strong>{g.allDay ? "All day" : `${g.start_time} - ${g.end_time}`}</strong> [Google] {e.title}
        {e.location && <div style={{ fontSize: "11px", opacity: 0.85 }}>@{e.location}</div>}
      </a>
    );
  }

  if (event.kind === "segment") {
    const s = event.data;
    const duration = formatMinutes(durationMinutes(s));
    const label = `${s.start_time} – ${s.end_time} Work (${duration}): ${s.task.title}`;
    const style = { borderLeftColor: s.task.course_color || "#2e75b6", ...proportionalStyle };
    if (s.status !== "Planned") {
      return <div className="chip chip-task-segment" style={style}>
        {label}<br /><span>{s.status} · {formatMinutes(s.completed_minutes)} credited</span>
      </div>;
    }
    return (
      <button className="chip chip-task-segment" style={style} onClick={() => onCheckIn(s)}
        aria-label={`Check in: ${label}`}>
        {label}<br />Check in
      </button>
    );
  }

  const t = event.data;
  return (
    <button
      className={`chip chip-task ${t.status === "Complete" ? "chip-done" : ""} ${isOverdue(t) ? "chip-overdue" : ""}`}
      style={proportionalStyle}
      onClick={() => onOpenTask(t)}
      title={`Due ${formatDue(t.due_date)} (${t.priority})`}
    >
      <strong>{event.sortTime}</strong> DUE: {t.title}
    </button>
  );
}

function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState(() => window.matchMedia("(max-width: 720px)").matches ? "day" : "week");
  const [anchor, setAnchor] = useState(startOfDay(new Date()));
  const [tasks, setTasks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [checkIn, setCheckIn] = useState(null);
  const [planError, setPlanError] = useState("");
  const [planNotice, setPlanNotice] = useState("");
  const [planningGoogle, setPlanningGoogle] = useState(null);

  // Google Calendar
  const [searchParams] = useSearchParams(); // ?google=connected / ?google_error=... after the OAuth redirect
  const [google, setGoogle] = useState({ configured: false, connected: false, email: null });
  const [gData, setGData] = useState({ key: "", events: [] });
  const [gError, setGError] = useState("");
  const [syncVersion, setSyncVersion] = useState(0);

  const [googleReady, setGoogleReady] = useState(false);
  useEffect(() => {
    getGoogleStatus().then((r) => {
      setGoogle(r.data);
      setGoogleReady(true);
    }).catch(() => {
      setPlanError("Could not check Google Calendar connection. Reload to update the study plan.");
    });
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([getTasks(), getClasses(), getStudyPlan()])
      .then(([t, c, p]) => { setTasks(t.data.tasks); setClasses(c.data.classes); setPlan(p.data); })
      .catch((err) => setError(err.response?.data?.message || "Could not load calendar."));
  }, []);

  // The date range on screen; only these Google events are requested.
  const range = useMemo(() => {
    if (view === "day") {
      const from = startOfDay(anchor);
      return { from, to: addDays(from, 1) };
    }
    if (view === "week") {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 7) };
    }
    const grid = monthGrid(anchor.getFullYear(), anchor.getMonth()).flat();
    return { from: grid[0], to: addDays(grid[grid.length - 1], 1) };
  }, [view, anchor]);
  const rangeKey = `${range.from.toISOString()}|${range.to.toISOString()}|${syncVersion}`;

  useEffect(() => {
    if (!google.connected) return undefined;
    let active = true;
    getGoogleEvents(range.from.toISOString(), range.to.toISOString())
      .then((r) => {
        if (!active) return;
        setGData({ key: rangeKey, events: r.data.events });
        setGError("");
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.data?.code === "reauth") setGoogle((g) => ({ ...g, connected: false }));
        setGError(err.response?.data?.message || "Could not load Google Calendar events.");
      });
    return () => { active = false; };
  }, [google.connected, range, rangeKey]);

  // The planner needs busy events up to the last task deadline, independent of the visible calendar view.
  const today = dayKey(now);
  const planThrough = useMemo(() => tasks.reduce((latest, task) => {
    const due = parseDateTime(task.due_date);
    const date = due && task.status !== "Complete" ? dayKey(due) : "";
    return date > latest ? date : latest;
  }, today), [tasks, today]);
  const planningKey = `${today}|${planThrough}|${syncVersion}`;

  useEffect(() => {
    if (!google.connected) return undefined;
    let active = true;
    const from = new Date(today + "T00:00:00");
    const to = addDays(new Date(planThrough + "T00:00:00"), 1);
    loadPlanningEvents(from, to, getGoogleEvents)
      .then((events) => {
        if (active) {
          setPlanningGoogle({ key: planningKey, events });
          setPlanError("");
        }
      })
      .catch(() => { if (active) setPlanError("Could not load Google commitments. Sync again to update the study plan."); });
    return () => { active = false; };
  }, [google.connected, today, planThrough, planningKey]);

  const proposed = useMemo(() => {
    if (!plan || !googleReady || (google.connected && planningGoogle?.key !== planningKey)) return null;
    return calculateStudyPlan(tasks, classes, google.connected ? planningGoogle.events : [], plan.sessions, now);
  }, [plan, googleReady, google.connected, planningGoogle, planningKey, tasks, classes, now]);

  useEffect(() => {
    if (!proposed || checkIn || !needsPlanUpdate(proposed, plan.sessions)) return undefined;
    let active = true;
    saveStudyPlan({ revision: plan.revision, cutoff: proposed.cutoff, blocks: proposed.blocks })
      .then(({ data }) => {
        if (active) {
          setPlan(data);
          setPlanError("");
        }
      })
      .catch((err) => {
        if (!active) return;
        const latest = err.response?.data;
        if (err.response?.status === 409 && latest?.revision) setPlan(latest);
        else setPlanError(latest?.message || "Could not update the study plan. Reload to try again.");
      });
    return () => { active = false; };
  }, [checkIn, plan, proposed]);

  async function saveCheckIn(session, status, minutes) {
    const { data } = await checkInStudySession(session.id, status, minutes);
    setNow(new Date());
    setPlan(data);
    setCheckIn(null);
    setPlanNotice("Check-in saved.");
  }

  const sessions = plan?.sessions ?? [];
  const weekStart = startOfWeek(now);
  const todayTotals = studyTotals(sessions, today, dayKey(addDays(now, 1)));
  const weekTotals = studyTotals(sessions, dayKey(weekStart), dayKey(addDays(weekStart, 7)));

  const googleEvents = google.connected ? gData.events : [];
  const syncing = google.connected && gData.key !== rangeKey && !gError;

  const connectGoogle = () => { window.location.href = `${API_BASE_URL}/google/connect`; };

  const handleDisconnect = async () => {
    if (!window.confirm("Stop syncing with Google Calendar? Your Google events will disappear from this calendar.")) return;
    try {
      await disconnectGoogle();
      setGoogle((g) => ({ ...g, connected: false }));
      setGData({ key: "", events: [] });
      setGError("");
    } catch (err) {
      setGError(err.response?.data?.message || "Could not disconnect Google Calendar.");
    }
  };

  const flashError = googleErrorMessage(searchParams.get("google_error"));
  const flashConnected = searchParams.get("google") === "connected";

  const openTask = (t) => navigate(`/tasks/${t.id}/edit`);

  const move = (dir) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };

  const title = useMemo(() => {
    if (view === "month") return anchor.toLocaleDateString([], { month: "long", year: "numeric" });
    if (view === "day") return anchor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const start = startOfWeek(anchor);
    return `Week of ${start.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  }, [view, anchor]);

  const renderDay = (date, limit) => {
    const events = eventsForDay(date, tasks, classes, googleEvents, sessions);
    const shown = limit ? events.slice(0, limit) : events;
    return (
      <>
        {shown.map((e, i) => (
          <EventChip key={i} event={e} onOpenTask={openTask} onCheckIn={setCheckIn} view={view} />
        ))}
        {limit && events.length > limit && <div className="more">+{events.length - limit} more</div>}
        {events.length === 0 && !limit && <div className="more">Nothing scheduled</div>}
      </>
    );
  };

  return (
    <div className="planner-section planner-calendar">
      <h2>Calendar</h2>
      {error && <p className="error">{error}</p>}
      {planError && <p className="error" role="alert">{planError}</p>}
      {planNotice && <p className="success" role="status">{planNotice}</p>}
      {plan && (
        <section className="study-targets" aria-label="Study targets" aria-live="polite">
          <div><strong>Today’s study target</strong><br />{formatMinutes(todayTotals.completed)} of {formatMinutes(todayTotals.target)} completed</div>
          <div><strong>This week’s study target</strong><br />{formatMinutes(weekTotals.completed)} of {formatMinutes(weekTotals.target)} completed</div>
        </section>
      )}
      {plan?.sessions.some((session) => session.status === "Planned" &&
        `${session.session_date} ${session.end_time}` <= proposed?.cutoff) && (
        <p>Check in on past study sessions to record progress or reschedule missed time.</p>
      )}
      {proposed?.unscheduled.length > 0 && (
        <p role="status">Could not fit before the deadline: {proposed.unscheduled.map(({ task, minutes }) =>
          `${task.title} (${formatMinutes(minutes)})`).join(", ")}.</p>
      )}
      {checkIn && <StudyCheckIn key={checkIn.id} session={checkIn} onClose={() => setCheckIn(null)} onSave={saveCheckIn} />}
      {flashConnected && google.connected && <p className="success">Google Calendar connected.</p>}
      {flashError && <p className="error">{flashError}</p>}
      {gError && <p className="error">{gError}</p>}

      <div className="google-panel">
        {!google.connected ? (
          <>
            <span className="grow">
              {google.configured === false
                ? "Google Calendar sync is not set up on the server yet."
                : "Show your Google Calendar events here, and keep study blocks clear of them."}
            </span>
            {google.configured !== false && <button onClick={connectGoogle}>Connect Google Calendar</button>}
          </>
        ) : (
          <>
            <span className="grow">
              Synced with <strong>{google.email}</strong>{syncing ? " (loading...)" : ""}
            </span>
            <button className="secondary" onClick={() => setSyncVersion((v) => v + 1)}>Sync now</button>
            <button className="secondary" onClick={handleDisconnect}>Disconnect</button>
          </>
        )}
      </div>

      <div className="cal-toolbar">
        <div className="button-row">
          <button className="secondary" onClick={() => move(-1)} aria-label="Previous">&lt;</button>
          <button className="secondary" onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
          <button className="secondary" onClick={() => move(1)} aria-label="Next">&gt;</button>
        </div>
        <strong>{title}</strong>
        <div className="button-row">
          {["day", "week", "month"].map((v) => (
            <button key={v} className={view === v ? "" : "secondary"} aria-pressed={view === v} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === "day" && <div className="cal-day">{renderDay(anchor)}</div>}

      {view === "week" && (
        <div className="cal-grid cal-week">
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)).map((d) => (
            <div key={dayKey(d)} className={`cal-cell ${dayKey(d) === today ? "today" : ""}`}>
              <div className="cal-date">{d.toLocaleDateString([], { weekday: "short", day: "numeric" })}</div>
              {renderDay(d)}
            </div>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="cal-grid cal-month">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((n) => (
            <div key={n} className="cal-head">{n}</div>
          ))}
          {monthGrid(anchor.getFullYear(), anchor.getMonth()).flat().map((date) => {
            const key = dayKey(date);
            const isToday = key === today;
            const outsideMonth = date.getMonth() !== anchor.getMonth();
            const count = eventsForDay(date, tasks, classes, googleEvents, sessions).length;
            return (
              <div key={key} className={`cal-cell ${isToday ? "today" : ""} ${outsideMonth ? "other-month" : ""}`}>
                <div className="cal-month-details">
                  <div className="cal-date">{date.getDate()}</div>
                  {renderDay(date, 3)}
                </div>
                <button type="button" className="secondary cal-date-button"
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${date.toLocaleDateString([], { dateStyle: "full" })}, ${count} ${count === 1 ? "event" : "events"}`}
                  onClick={() => { setAnchor(date); setView("day"); }}>
                  <span>{date.getDate()}</span>
                  {count > 0 && <small aria-hidden="true">{count}</small>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="legend">
        <strong>Legend:</strong> [Lecture/Lab/Sleep/Hobby] = Scheduled Commitments | 
        <span style={{ color: "#2e75b6", fontWeight: "bold" }}> Work</span> = Auto-scheduled study sessions | 
        <strong> DUE</strong> = Final Task Deadline |
        <span style={{ color: "#1e7e34", fontWeight: "bold" }}> [Google]</span> = Events synced from Google Calendar (study blocks avoid them).
      </p>
    </div>
  );
}

export default Calendar;