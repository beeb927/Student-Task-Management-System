// Unit tests for the pure helper functions. Run: npm test (from /client)
import test from "node:test";
import assert from "node:assert/strict";
import {
  isOverdue, isDueSoon, sortTasks, progress, toInputDateTime, parseDateTime,
} from "../src/utils/taskUtils.js";
import {
  startOfWeek, dayKey, dbDayOfWeek, monthGrid, eventsForDay,
} from "../src/utils/calendarUtils.js";

const NOW = new Date(2026, 9, 22, 12, 0, 0); // Thu Oct 22 2026 12:00
const t = (id, over) => ({ id, status: "Incomplete", priority: "Medium", due_date: null, ...over });

test("isOverdue only for incomplete tasks past their due date", () => {
  assert.equal(isOverdue(t(1, { due_date: "2026-10-21 09:00:00" }), NOW), true);
  assert.equal(isOverdue(t(2, { due_date: "2026-10-23 09:00:00" }), NOW), false);
  assert.equal(isOverdue(t(3, { due_date: "2026-10-21 09:00:00", status: "Complete" }), NOW), false);
  assert.equal(isOverdue(t(4), NOW), false);
});

test("isDueSoon covers the next 24 hours only", () => {
  assert.equal(isDueSoon(t(1, { due_date: "2026-10-23 11:00:00" }), NOW), true);
  assert.equal(isDueSoon(t(2, { due_date: "2026-10-23 13:00:00" }), NOW), false);
  assert.equal(isDueSoon(t(3, { due_date: "2026-10-22 08:00:00" }), NOW), false); // already overdue
  assert.equal(isDueSoon(t(4, { due_date: "2026-10-22 18:00:00", status: "Complete" }), NOW), false);
});

test("sortTasks: overdue first, then by priority, then due date, completed last", () => {
  const tasks = [
    t(1, { priority: "Low", due_date: "2026-10-25 10:00:00" }),
    t(2, { priority: "High", due_date: "2026-10-28 10:00:00" }),
    t(3, { priority: "Low", due_date: "2026-10-20 10:00:00" }), // overdue
    t(4, { priority: "High", due_date: "2026-10-24 10:00:00" }),
    t(5, { priority: "High", status: "Complete", due_date: "2026-10-19 10:00:00" }),
    t(6, { priority: "Medium" }), // no due date
  ];
  assert.deepEqual(sortTasks(tasks, NOW).map((x) => x.id), [3, 4, 2, 6, 1, 5]);
});

test("progress percentage", () => {
  assert.deepEqual(progress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(progress([t(1, { status: "Complete" }), t(2), t(3)]), { done: 1, total: 3, percent: 33 });
});

test("date helpers", () => {
  assert.equal(toInputDateTime("2026-10-22 14:30:00"), "2026-10-22T14:30");
  assert.equal(parseDateTime(null), null);
  assert.equal(dayKey(startOfWeek(NOW)), "2026-10-19"); // Monday
  assert.equal(dayKey(startOfWeek(new Date(2026, 9, 25))), "2026-10-19"); // Sunday -> same week
  assert.equal(dbDayOfWeek(new Date(2026, 9, 19)), 1); // Monday
  assert.equal(dbDayOfWeek(new Date(2026, 9, 25)), 7); // Sunday
});

test("monthGrid is 6 weeks starting on a Monday", () => {
  const grid = monthGrid(2026, 9);
  assert.equal(grid.length, 6);
  assert.ok(grid.every((w) => w.length === 7));
  assert.equal(grid[0][0].getDay(), 1);
  assert.ok(grid.flat().some((d) => dayKey(d) === "2026-10-31"));
});

test("eventsForDay merges weekly classes and tasks due that day, sorted by time", () => {
  const classes = [{ id: 1, day_of_week: 4, start_time: "10:00", end_time: "12:00", title: "Lecture" }];
  const tasks = [
    t(1, { due_date: "2026-10-22 09:00:00", title: "Early" }),
    t(2, { due_date: "2026-10-22 23:59:00", title: "Late" }),
    t(3, { due_date: "2026-10-23 09:00:00", title: "Tomorrow" }),
  ];
  const ev = eventsForDay(new Date(2026, 9, 22), tasks, classes);
  assert.deepEqual(ev.map((e) => e.kind), ["task", "class", "task"]);
  assert.equal(eventsForDay(new Date(2026, 9, 21), tasks, classes).length, 0); // Wednesday
});

// ---------- Google Calendar sync ----------
import { googleEventsOnDay, googleBusyBlocks, generateTaskSegments } from "../src/utils/calendarUtils.js";
import { googleErrorMessage } from "../src/utils/googleMessages.js";

test("googleEventsOnDay: timed, all-day (exclusive end) and multi-day events", () => {
  const evs = [
    { id: "a", title: "Meeting", allDay: false, start: new Date(2026, 9, 22, 10, 0).toISOString(), end: new Date(2026, 9, 22, 11, 30).toISOString() },
    { id: "b", title: "Holiday", allDay: true, start: "2026-10-22", end: "2026-10-23" },
    { id: "c", title: "Trip", allDay: false, start: new Date(2026, 9, 22, 22, 0).toISOString(), end: new Date(2026, 9, 23, 2, 0).toISOString() },
  ];
  const thu = googleEventsOnDay(new Date(2026, 9, 22), evs);
  assert.deepEqual(thu.map((g) => g.event.id), ["a", "b", "c"]);
  assert.equal(thu[0].start_time, "10:00");
  assert.equal(thu[0].end_time, "11:30");
  assert.equal(thu[2].end_time, "24:00"); // clipped at midnight

  const fri = googleEventsOnDay(new Date(2026, 9, 23), evs);
  assert.deepEqual(fri.map((g) => g.event.id), ["c"]); // all-day event ended (end date is exclusive)
  assert.equal(fri[0].start_time, "00:00");
  assert.equal(fri[0].end_time, "02:00");
});

test("eventsForDay includes Google events, sorted with everything else", () => {
  const g = [{ id: "a", title: "Meeting", allDay: false, start: new Date(2026, 9, 22, 10, 0).toISOString(), end: new Date(2026, 9, 22, 11, 0).toISOString() }];
  const ev = eventsForDay(new Date(2026, 9, 22), [t(1, { due_date: "2026-10-22 09:00:00", title: "Early" })], [], g);
  assert.deepEqual(ev.map((e) => e.kind), ["task", "google"]);
});

test("study segments avoid busy Google events, and ignore all-day / free ones", () => {
  const task = { id: 1, status: "Incomplete", estimated_hours: 1, created_at: "2026-10-22 08:00:00", due_date: "2026-10-22 23:00:00", title: "x" };
  const day = new Date(2026, 9, 22);
  // Without Google: the preferred 18:00 slot is used
  assert.equal(generateTaskSegments(task, [], [], [], { now: new Date(2026, 9, 22, 8) })[0].start_time, "18:00");

  const busy = { id: "m", allDay: false, start: new Date(2026, 9, 22, 17, 30).toISOString(), end: new Date(2026, 9, 22, 19, 0).toISOString() };
  const blocks = googleBusyBlocks([busy]);
  assert.deepEqual(blocks, [{ dateKey: "2026-10-22", start_time: "17:30", end_time: "19:00" }]);
  const seg = generateTaskSegments(task, [], [], blocks, { now: new Date(2026, 9, 22, 8) })[0];
  assert.ok(seg.end_time <= "17:30" || seg.start_time >= "19:00", `overlaps: ${seg.start_time}-${seg.end_time}`);

  assert.deepEqual(googleBusyBlocks([{ ...busy, busy: false }]), []);
  assert.deepEqual(googleBusyBlocks([{ id: "h", allDay: true, start: "2026-10-22", end: "2026-10-23" }]), []);
  assert.equal(dayKey(day), "2026-10-22");
});

test("regression: a 1-hour task due several days out no longer crashes the scheduler", () => {
  const task = { id: 1, status: "Incomplete", estimated_hours: 1, created_at: "2026-10-22 08:00:00", due_date: "2026-10-26 18:00:00", title: "x" };
  const segs = generateTaskSegments(task, [], [], [], { now: new Date(2026, 9, 22, 8) });
  assert.equal(segs.length, 1);
});

test("googleErrorMessage maps server codes to text", () => {
  assert.equal(googleErrorMessage(null), "");
  assert.match(googleErrorMessage("cancelled"), /cancelled/i);
  assert.match(googleErrorMessage("something_new"), /went wrong/i); // unknown codes fall back safely
});
