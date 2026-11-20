import { useEffect, useState } from "react";
import { deleteSleepLog, getSleepLogs, saveSleepLog } from "../services/api";
import { addDays, dayKey, startOfWeek } from "../utils/calendarUtils";
import { formatMinutes } from "../utils/duration";

export default function SleepLog() {
  const today = dayKey(new Date());
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [loaded, setLoaded] = useState(null);
  const [wakeDate, setWakeDate] = useState(today);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("0");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const from = dayKey(week);
  const to = dayKey(addDays(week, 7));
  const logs = loaded?.from === from ? loaded.logs : null;

  useEffect(() => {
    let active = true;
    getSleepLogs(from, to)
      .then(({ data }) => {
        if (active) {
          setLoaded({ from, logs: data.logs });
          setLoadError("");
        }
      })
      .catch(() => { if (active) setLoadError("Could not load sleep logs."); });
    return () => { active = false; };
  }, [from, to, version]);

  function edit(log) {
    setWakeDate(log.sleep_date);
    setHours(String(Math.floor(log.minutes_slept / 60)));
    setMinutes(String(log.minutes_slept % 60));
  }

  async function save(event) {
    event.preventDefault();
    const total = Number(hours) * 60 + Number(minutes);
    if (!wakeDate || wakeDate > today || !Number.isInteger(total) || total < 1 || total > 1440) {
      setError("Enter a wake date up to today and a duration from 1 minute to 24 hours.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await saveSleepLog(wakeDate, total);
      setWeek(startOfWeek(new Date(wakeDate + "T12:00:00")));
      setVersion((value) => value + 1);
      setHours("");
      setMinutes("0");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save sleep.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(date) {
    setError("");
    setSaving(true);
    try {
      await deleteSleepLog(date);
      setVersion((value) => value + 1);
    } catch {
      setError("Could not delete sleep entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="planner-section">
      <h2>Sleep Log</h2>
      <p>Enter how long you slept and the date you woke up. Saving the same date updates that night’s entry.</p>
      {(error || loadError) && <p className="error" role="alert">{error || loadError}</p>}
      <form className="inline-form" onSubmit={save}>
        <label htmlFor="wake-date">Wake date</label>
        <input id="wake-date" type="date" value={wakeDate} max={today} onChange={(event) => setWakeDate(event.target.value)} required />
        <label htmlFor="sleep-hours">Hours slept</label>
        <input id="sleep-hours" type="number" min="0" max="24" value={hours} onChange={(event) => setHours(event.target.value)} required />
        <label htmlFor="sleep-minutes">Additional minutes</label>
        <input id="sleep-minutes" type="number" min="0" max="59" value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
        <div className="button-row"><button disabled={saving}>Save sleep</button></div>
      </form>
      <div className="cal-toolbar">
        <button className="secondary" onClick={() => setWeek(addDays(week, -7))}>Previous week</button>
        <strong>Week of {week.toLocaleDateString()}</strong>
        <button className="secondary" onClick={() => setWeek(addDays(week, 7))}>Next week</button>
      </div>
      {logs ? (
        <>
          <p role="status"><strong>Weekly total:</strong> {formatMinutes(logs.reduce((sum, log) => sum + log.minutes_slept, 0))} across {logs.length} {logs.length === 1 ? "night" : "nights"}</p>
          {logs.length === 0 && <p>No sleep logged this week.</p>}
          <ul className="task-list">
            {logs.map((log) => (
              <li className="task-card" key={log.sleep_date}>
                <span>{log.sleep_date} · {formatMinutes(log.minutes_slept)}</span>
                <div className="task-actions">
                  <button className="secondary" disabled={saving} onClick={() => edit(log)}>Edit</button>
                  <button className="danger" disabled={saving} onClick={() => remove(log.sleep_date)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : !loadError && <p>Loading sleep logs…</p>}
    </div>
  );
}
