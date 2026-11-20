// app/server/utils/validate.js

const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["Incomplete", "Complete"];
// Updated to support sleep, hobbies, and work commitments:
const CLASS_TYPES = ["Lecture", "Lab", "Tutorial", "Sleep", "Work", "Hobby", "Other"];

function toMysqlDateTime(value) {
  if (value === undefined || value === null || value === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    String(value).trim()
  );
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s = "00"] = m;
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  if (date.getMonth() !== +mo - 1 || date.getDate() !== +d) return undefined;
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function toMysqlTime(value) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || "").trim());
  if (!m) return undefined;
  const h = +m[1];
  const mi = +m[2];
  if (h > 23 || mi > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${m[2]}:${m[3] || "00"}`;
}

module.exports = { PRIORITIES, STATUSES, CLASS_TYPES, toMysqlDateTime, toMysqlTime };