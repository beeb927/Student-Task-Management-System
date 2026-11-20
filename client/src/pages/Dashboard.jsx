import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  clearCompletedTasks, deleteTask, getCourses, getTasks, getStudyPlan, setTaskStatus, taskImageUrl,
} from "../services/api";
import { formatDue, isOverdue, parseDateTime, progress, sortTasks } from "../utils/taskUtils";

import { addDays, dayKey, startOfWeek, studyTotals } from "../utils/calendarUtils";
import { formatMinutes } from "../utils/duration";

function StudySummary({ tasks, sessions, today }) {
  const key = dayKey(today);
  const currentTime = today.toTimeString().slice(0, 5);
  const next = sessions?.filter((s) => s.session_date === key && s.status === "Planned" && s.end_time > currentTime &&
    tasks.some((task) => task.id === s.task_id && task.status !== "Complete"))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const totals = sessions && studyTotals(sessions, key, dayKey(addDays(today, 1)));
  return (
    <aside className="planner-panel study-summary">
      <h3>Today's study plan</h3>
      {totals?.target > 0 && (
        <span className="planner-pill study-pill">{formatMinutes(totals.completed)} of {formatMinutes(totals.target)} complete</span>
      )}
      {next ? (
        <>
          <strong className="planner-accent">{next.start_time}–{next.end_time}</strong>
          <strong>{tasks.find((task) => task.id === next.task_id)?.title}</strong>
        </>
      ) : <p>{sessions ? "No planned sessions today." : "View your study sessions in Calendar."}</p>}
      <Link to="/calendar">Open calendar →</Link>
    </aside>
  );
}

function TaskCard({ task, onToggle, onDelete, onEdit }) {
  const navigate = useNavigate();
  const overdue = isOverdue(task);
  const done = task.status === "Complete";

  return (
    <li className={`task-card ${overdue ? "overdue" : ""} ${done ? "done" : ""}`}>
      <div className="planner-task-content">
        <div className="planner-task-details">
          <div className="planner-task-tags">
            {task.course_code && (task.course_shell_url
              ? <a className="planner-course" href={task.course_shell_url} target="_blank" rel="noreferrer">{task.course_code}</a>
              : <span className="planner-course">{task.course_code}</span>)}
            {task.checklist_total > 0 && <span className="planner-pill">Subtasks: {task.checklist_completed}/{task.checklist_total}</span>}
          </div>
          <label className="planner-task-title">
            <input type="checkbox" checked={done} onChange={() => onToggle(task)}
              aria-label={`Mark "${task.title}" as ${done ? "incomplete" : "complete"}`} />
            <span className="task-title">{task.title}</span>
          </label>
          {task.description && <div className="task-desc">{task.description}</div>}
        </div>
        <div className="planner-task-media">
          <span className={`badge priority-${task.priority}`}>{task.priority}</span>
          {task.image_id && <a href={taskImageUrl(task.id, task.image_id)} target="_blank" rel="noreferrer"
            aria-label={`Open image attached to ${task.title} in a new tab`}>
            <img className="planner-task-image" src={taskImageUrl(task.id, task.image_id)}
              alt={`Attachment for ${task.title}`} loading="lazy" />
          </a>}
        </div>
      </div>
      <div className="planner-task-bottom">
        <span className="task-meta">{task.due_date ? `Due: ${formatDue(task.due_date)}` : "No deadline"}
          {task.estimated_hours != null && ` · Est. ${Number(task.estimated_hours)} h`}</span>
        <div className="task-actions">
          <button type="button" className="secondary" onClick={() => navigate(`/tasks/${task.id}/checklist`)}>Checklist</button>
          <button type="button" className="secondary danger-text" onClick={() => onDelete(task)}>Delete</button>
          <button type="button" className="secondary edit-link" onClick={() => onEdit(task)}>Edit task →</button>
        </div>
      </div>
    </li>
  );
}

function Section({ title, tasks, ...handlers }) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h3>{title} ({tasks.length})</h3>
      <ul className="task-list">
        {tasks.map((t) => <TaskCard key={t.id} task={t} {...handlers} />)}
      </ul>
    </section>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    getStudyPlan().then(({ data }) => active && setSessions(data.sessions)).catch(() => active && setSessions(null));
    Promise.all([getTasks(), getCourses()])
      .then(([t, c]) => {
        if (!active) return;
        setTasks(t.data.tasks);
        setCourses(c.data.courses);
        setError("");
      })
      .catch((err) => active && setError(err.response?.data?.message || "Could not load tasks."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [version]);

  const act = async (fn) => {
    try { await fn(); reload(); }
    catch (err) { setError(err.response?.data?.message || "Something went wrong."); }
  };

  const toggle = (task) =>
    act(() => setTaskStatus(task.id, task.status === "Complete" ? "Incomplete" : "Complete"));
  const remove = (task) => {
    if (window.confirm(`Delete "${task.title}"?`)) act(() => deleteTask(task.id));
  };
  const clearDone = () => {
    if (window.confirm("Remove all completed tasks?")) act(() => clearCompletedTasks());
  };

  const visible = useMemo(
    () => tasks.filter((t) => !courseFilter || String(t.course_id) === courseFilter),
    [tasks, courseFilter]
  );
  const sorted = useMemo(() => sortTasks(visible), [visible]);
  const overdue = sorted.filter((t) => isOverdue(t));
  const open = sorted.filter((t) => t.status !== "Complete" && !isOverdue(t));
  const completed = sorted.filter((t) => t.status === "Complete");
  const { done, total, percent } = progress(visible);
  const handlers = { onToggle: toggle, onDelete: remove, onEdit: (t) => navigate(`/tasks/${t.id}/edit`) };

  const today = new Date();
  const weekEnd = addDays(startOfWeek(today), 7);
  const upcoming = open.filter((task) => {
    const due = parseDateTime(task.due_date);
    return due && due >= today && due < weekEnd;
  }).length;

  return (
    <div className="planner-dashboard">
      <header className="planner-heading">
        <div><h1>Dashboard</h1><p>See what needs your attention this week.</p></div>
        <button onClick={() => navigate("/tasks/create")}>+ New task</button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && <>
        <div className="planner-metrics" aria-label="Task overview">
          <div className="planner-panel metric-overdue"><span>Overdue</span><strong>{overdue.length}</strong><small>Past deadline</small></div>
          <div className="planner-panel metric-upcoming"><span>Upcoming</span><strong>{upcoming}</strong><small>Due this week</small></div>
          <div className="planner-panel metric-complete"><span>Completed</span><strong>{done} of {total}</strong>
            <progress aria-label="Task completion" value={percent} max={100} /></div>
        </div>
        <div className="planner-mobile-summary">
          <strong>{done} of {total} tasks completed ({percent}%)</strong>
          <span className="planner-pill overdue-pill">{overdue.length} overdue</span>
          <progress aria-label="Task completion" value={percent} max={100} />
        </div>
      </>}
      <div className="planner-dashboard-grid">
        <div className="planner-task-list">
          <div className="planner-heading">
            <h2>Your tasks</h2>
            {courses.length > 0 && <select aria-label="Filter by course" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>}
          </div>
          {loading ? <p>Loading tasks…</p> : visible.length === 0 ? (
            <p className="empty">{courseFilter ? "No tasks for this course." : <>No tasks yet. <Link to="/tasks/create">Create your first task</Link>.</>}</p>
          ) : (
            <>
              <Section title="Overdue" tasks={overdue} {...handlers} />
              <Section title="Upcoming" tasks={open.filter((t) => t.due_date)} {...handlers} />
              <Section title="No deadline" tasks={open.filter((t) => !t.due_date)} {...handlers} />
              {completed.length > 0 && <>
                <div className="section-head">
                  <h3>Completed ({completed.length})</h3>
                  <button className="secondary" onClick={clearDone}>Clear completed</button>
                </div>
                <ul className="task-list">
                  {completed.map((t) => <TaskCard key={t.id} task={t} {...handlers} />)}
                </ul>
              </>}
            </>
          )}
        </div>
        <StudySummary tasks={tasks} sessions={sessions} today={today} />
      </div>
    </div>
  );
}


export default Dashboard;
