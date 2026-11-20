function validDate(value) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value;
}

function minutesAt(time) {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function checkInMinutes(status, minutes, duration) {
  if (status === "Complete") return duration;
  if (status === "Missed") return 0;
  if (status === "Partially Complete" && Number.isInteger(minutes) && minutes > 0 && minutes < duration) {
    return minutes;
  }
  return null;
}

module.exports = { validDate, minutesAt, checkInMinutes };
