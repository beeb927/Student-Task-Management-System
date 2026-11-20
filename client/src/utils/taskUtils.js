// Pure helper functions for tasks (no React, so they are easy to unit test).

export const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

// "2026-10-22 14:30:00" (from the API) -> Date in the user's local time
export function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Date -> "2026-10-22T14:30" for <input type="datetime-local">
export function toInputDateTime(value) {
  const d = parseDateTime(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDue(value) {
  const d = parseDateTime(value);
  if (!d) return "No due date";
  return d.toLocaleString([], {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// US-11: an incomplete task whose due date has passed
export function isOverdue(task, now = new Date()) {
  if (task.status === "Complete") return false;
  const due = parseDateTime(task.due_date);
  return due !== null && due < now;
}

// US-12: incomplete, not yet overdue, due within the next `hours`
export function isDueSoon(task, now = new Date(), hours = 24) {
  if (task.status === "Complete") return false;
  const due = parseDateTime(task.due_date);
  if (!due || due < now) return false;
  return due - now <= hours * 60 * 60 * 1000;
}

function byPriorityThenDue(a, b) {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  const da = parseDateTime(a.due_date);
  const db = parseDateTime(b.due_date);
  if (da && db) return da - db;
  if (da) return -1; // tasks with a due date before tasks without
  if (db) return 1;
  return a.id - b.id;
}

// Order: overdue first, then open tasks, then completed.
// Inside each group: priority (High > Medium > Low), then earliest due date.
export function sortTasks(tasks, now = new Date()) {
  const group = (t) => (t.status === "Complete" ? 2 : isOverdue(t, now) ? 0 : 1);
  return [...tasks].sort((a, b) => group(a) - group(b) || byPriorityThenDue(a, b));
}

// US-18: progress bar numbers
export function progress(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Complete").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
