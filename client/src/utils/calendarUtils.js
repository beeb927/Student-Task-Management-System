// app/client/src/utils/calendarUtils.js
import { parseDateTime, PRIORITY_RANK } from "./taskUtils.js";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(date) {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function dayKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dbDayOfWeek(date) {
  return ((date.getDay() + 6) % 7) + 1;
}

export function monthGrid(year, month) {
  const first = startOfWeek(new Date(year, month, 1));
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d))
  );
}

// Convert "HH:MM" string to minutes from midnight
function toMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

// Split overnight sleep into daily intervals for both display and collision checks.
export function recurringSchedulesForDay(date, schedules) {
  const dow = dbDayOfWeek(date);
  const previousDow = dow === 1 ? 7 : dow - 1;
  return schedules.flatMap((schedule) => {
    const overnight = schedule.type === "Sleep" &&
      toMinutes(schedule.end_time) < toMinutes(schedule.start_time);
    if (!overnight) return schedule.day_of_week === dow ? [schedule] : [];
    if (schedule.day_of_week === dow) {
      return [{ ...schedule, end_time: "24:00", overnightPart: "starts" }];
    }
    if (schedule.day_of_week === previousDow && toMinutes(schedule.end_time) > 0) {
      return [{ ...schedule, start_time: "00:00", overnightPart: "continues" }];
    }
    return [];
  });
}

/**
 * Searches for the best open slot on a specific day within [windowStart, windowEnd].
 * Returns null if no open slot fits durationMin.
 */
function findBestSlotOnDay(day, durationMin, recurringSchedules, externalBusy, assignedBlocks, windowLimits) {
  const key = dayKey(day);
  const { windowStart, windowEnd } = windowLimits;

  if (windowEnd - windowStart < durationMin) return null;

  // Collect all occupied time intervals for this day
  const busy = [];

  // 1. Recurring weekly classes and routine commitments
  recurringSchedulesForDay(day, recurringSchedules)
    .forEach((s) => busy.push({ start: toMinutes(s.start_time), end: toMinutes(s.end_time) }));

  // 2. Google Calendar events
  externalBusy
    .filter((b) => b.dateKey === key)
    .forEach((b) => busy.push({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));

  // 3. Other previously assigned study blocks & deadline buffers
  assignedBlocks
    .filter((b) => b.dateKey === key)
    .forEach((b) => busy.push({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));

  const isFree = (slotStart) => {
    const slotEnd = slotStart + durationMin;
    if (slotStart < windowStart || slotEnd > windowEnd) return false;
    for (const b of busy) {
      if (slotStart < b.end && slotEnd > b.start) return false;
    }
    return true;
  };

  // Preferred anchor: 6:00 PM (18:00), or clamped to the day's end
  const preferred = Math.max(windowStart, Math.min(18 * 60, windowEnd - durationMin));
  if (isFree(preferred)) return preferred;

  let bestMin = null;
  let minDistance = Infinity;

  const candidates = [windowStart, ...busy.flatMap((block) => [block.end, block.start - durationMin])];
  for (const m of candidates) {
    if (isFree(m)) {
      const distance = Math.abs(m - preferred);
      if (distance < minDistance) {
        minDistance = distance;
        bestMin = m;
      }
    }
  }

  return bestMin;
}

/**
 * Intelligent task segmentation and free-slot finder:
 * - Generates study blocks of up to one hour, including fractional estimates.
 * - Distributes them across available days between now and the due date.
 * - Clamps time to the exact minute of deadline on due date.
 * - Shifts dynamically to other hours or other candidate days if blocked.
 */
export function generateTaskSegments(task, recurringSchedules, existingSegments = [], externalBusy = [], options = {}) {
  if (!task.due_date || task.status === "Complete") return [];

  const totalMinutes = options.minutes ?? estimatedStudyMinutes(task);
  if (totalMinutes <= 0) return [];
  const due = parseDateTime(task.due_date);
  const now = options.now ?? new Date();
  const start = task.created_at && parseDateTime(task.created_at) > now ? parseDateTime(task.created_at) : now;
  if (!due || due <= start) return [];

  const startDay = startOfDay(start);
  const dueDay = startOfDay(due);
  const dueKey = dayKey(due);
  const startKey = dayKey(start);

  const dueTimeMinutes = due.getHours() * 60 + due.getMinutes();
  const startTimeMinutes = start.getHours() * 60 + start.getMinutes();

  // Collect only calendar days that can realistically fit at least one segment
  const validDays = [];
  let curr = new Date(startDay);
  while (curr <= dueDay) {
    const k = dayKey(curr);
    let startLimit = 8 * 60; // 8:00 AM
    let endLimit = 22 * 60;  // 10:00 PM

    // If curr is today, don't schedule in the past
    if (k === startKey) {
      startLimit = Math.max(startLimit, startTimeMinutes);
    }
    // If curr is the due date, don't schedule past the due time
    if (k === dueKey) {
      endLimit = Math.min(endLimit, dueTimeMinutes);
    }

    if (endLimit > startLimit) {
      validDays.push({
        date: new Date(curr),
        limits: { windowStart: startLimit, windowEnd: endLimit },
      });
    }
    curr = addDays(curr, 1);
  }

  if (validDays.length === 0) return [];

  const numSegments = Math.ceil(totalMinutes / 60);

  // Spread initial ideal target days evenly across the window
  const targetDayIndices = [];
  for (let i = 0; i < numSegments; i++) {
    const idx = numSegments > 1
      ? Math.min(validDays.length - 1, Math.round((i * (validDays.length - 1)) / (numSegments - 1)))
      : 0;
    targetDayIndices.push(idx);
  }

  const resultSegments = [];

  for (let i = 0; i < targetDayIndices.length; i++) {
    const durationMin = Math.min(60, totalMinutes - i * 60);
    const primaryIdx = targetDayIndices[i];
    let assignedDay = null;
    let assignedStart = null;

    // Check primary target day first
    const primaryCandidate = validDays[primaryIdx];
    const initialSlot = findBestSlotOnDay(
      primaryCandidate.date,
      durationMin,
      recurringSchedules,
      externalBusy,
      [...existingSegments, ...resultSegments],
      primaryCandidate.limits
    );

    if (initialSlot !== null) {
      assignedDay = primaryCandidate.date;
      assignedStart = initialSlot;
    } else {
      // Primary day is full/blocked -> search other days between start and due date
      let offset = 1;
      while (primaryIdx - offset >= 0 || primaryIdx + offset < validDays.length) {
        const candidates = [primaryIdx - offset, primaryIdx + offset].filter(
          (idx) => idx >= 0 && idx < validDays.length
        );

        for (const cIdx of candidates) {
          const cand = validDays[cIdx];
          const slot = findBestSlotOnDay(
            cand.date,
            durationMin,
            recurringSchedules,
            externalBusy,
            [...existingSegments, ...resultSegments],
            cand.limits
          );
          if (slot !== null) {
            assignedDay = cand.date;
            assignedStart = slot;
            break;
          }
        }
        if (assignedStart !== null) break;
        offset++;
      }
    }

    if (assignedDay !== null && assignedStart !== null) {
      resultSegments.push({
        dateKey: dayKey(assignedDay),
        start_time: toTimeStr(assignedStart),
        end_time: toTimeStr(assignedStart + durationMin),
        segmentNumber: i + 1,
        totalSegments: numSegments,
        task,
      });
    }
  }

  return resultSegments;
}

const pad2 = (n) => String(n).padStart(2, "0");
const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// Google event bounds -> Date. All-day events are "YYYY-MM-DD" (end is exclusive), read as local midnight.
function googleBound(value, allDay) {
  if (allDay) {
    const [y, m, d] = String(value).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

// The parts of the Google events that fall on `date`
export function googleEventsOnDay(date, googleEvents = []) {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const out = [];
  for (const e of googleEvents) {
    const s = googleBound(e.start, e.allDay);
    const en = googleBound(e.end, e.allDay);
    if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) continue;
    const overlaps = s < dayEnd && (en > dayStart || (en.getTime() === s.getTime() && s >= dayStart));
    if (!overlaps) continue;
    const from = s < dayStart ? dayStart : s;
    const to = en > dayEnd ? dayEnd : en;
    out.push({
      event: e,
      allDay: Boolean(e.allDay),
      start_time: hhmm(from),
      end_time: to.getTime() === dayEnd.getTime() ? "24:00" : hhmm(to),
    });
  }
  return out;
}

// Timed Google events that count as "busy", as per-day blocks the segment scheduler can avoid.
export function googleBusyBlocks(googleEvents = []) {
  const blocks = [];
  for (const e of googleEvents) {
    if (e.allDay || e.busy === false) continue;
    const s = new Date(e.start);
    const en = new Date(e.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime()) || en <= s) continue;
    let day = startOfDay(s);
    for (let i = 0; i < 60 && day < en; i++, day = addDays(day, 1)) {
      for (const part of googleEventsOnDay(day, [e])) {
        blocks.push({ dateKey: dayKey(day), start_time: part.start_time, end_time: part.end_time });
      }
    }
  }
  return blocks;
}

export function estimatedStudyMinutes(task) {
  const hours = task.estimated_hours == null ? 1 : Number(task.estimated_hours);
  return Math.max(0, Math.round(hours * 60));
}

export function durationMinutes(session) {
  return toMinutes(session.end_time) - toMinutes(session.start_time);
}

export function calculateStudyPlan(tasks, classes, googleEvents = [], sessions = [], now = new Date()) {
  const cutoff = `${dayKey(now)} ${hhmm(now)}`;
  const history = sessions.filter((session) =>
    session.status !== "Planned" || `${session.session_date} ${session.start_time}` < cutoff
  );
  const occupied = history.map((session) => ({ ...session, dateKey: session.session_date }));
  const allBusy = [...googleBusyBlocks(googleEvents)];
  for (const task of tasks) {
    const due = parseDateTime(task.due_date);
    if (!due) continue;
    const dueMin = due.getHours() * 60 + due.getMinutes();
    allBusy.push({
      dateKey: dayKey(due),
      start_time: toTimeStr(Math.max(0, dueMin - 30)),
      end_time: toTimeStr(Math.min(24 * 60, dueMin + 30)),
    });
  }

  const sortedTasks = [...tasks].sort((a, b) =>
    (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) ||
    (parseDateTime(a.due_date) ?? Infinity) - (parseDateTime(b.due_date) ?? Infinity) || a.id - b.id
  );

  const blocks = [];
  const unscheduled = [];
  for (const task of sortedTasks) {
    if (task.status === "Complete" || !parseDateTime(task.due_date)) continue;
    const accounted = history.filter((s) => s.task_id === task.id).reduce((total, s) =>
      total + (s.status === "Planned" ? durationMinutes(s) : s.completed_minutes), 0);
    const minutes = Math.max(0, estimatedStudyMinutes(task) - accounted);
    const segments = generateTaskSegments(task, classes, occupied, allBusy, { minutes, now });
    occupied.push(...segments);
    blocks.push(...segments.map((s) => ({
      task_id: task.id, session_date: s.dateKey, start_time: s.start_time, end_time: s.end_time,
    })));
    const remaining = minutes - segments.reduce((total, s) => total + durationMinutes(s), 0);
    if (remaining > 0) unscheduled.push({ task, minutes: remaining });
  }
  return { cutoff, blocks, unscheduled };
}

// A target includes the time already credited plus study sessions still on the plan.
export function studyTotals(sessions, from, to) {
  let planned = 0;
  let completed = 0;
  for (const session of sessions) {
    if (session.session_date < from || session.session_date >= to) continue;
    if (session.status === "Planned") planned += durationMinutes(session);
    completed += session.completed_minutes;
  }
  return { target: planned + completed, completed };
}

// Combines commitments, study sessions, Google events and deadlines for a day.
export function eventsForDay(date, tasks, classes, googleEvents = [], studySessions) {
  const key = dayKey(date);
  const classEvents = recurringSchedulesForDay(date, classes).map((c) => ({
    kind: "class", sortTime: c.start_time, data: c,
  }));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const sessions = studySessions ?? calculateStudyPlan(tasks, classes, googleEvents).blocks;
  const segmentEvents = sessions
    .filter((s) => s.session_date === key && tasksById.has(s.task_id))
    .map((s) => ({
      kind: "segment",
      sortTime: s.start_time,
      data: { ...s, task: tasksById.get(s.task_id) },
    }));

  // 6. Events imported from Google Calendar
  const googleOnDay = googleEventsOnDay(date, googleEvents).map((g) => ({
    kind: "google",
    sortTime: g.allDay ? "00:00" : g.start_time,
    data: g,
  }));

  // 7. Final task deadline chip
  const taskEvents = tasks
    .filter((t) => {
      const due = parseDateTime(t.due_date);
      return due && dayKey(due) === key;
    })
    .map((t) => {
      const due = parseDateTime(t.due_date);
      return {
        kind: "task",
        sortTime: `${pad2(due.getHours())}:${pad2(due.getMinutes())}`,
        data: t,
      };
    });

  return [...classEvents, ...segmentEvents, ...googleOnDay, ...taskEvents].sort((a, b) =>
    a.sortTime.localeCompare(b.sortTime)
  );
}