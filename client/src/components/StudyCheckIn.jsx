import { useEffect, useRef, useState } from "react";
import { durationMinutes } from "../utils/calendarUtils";
import { formatMinutes } from "../utils/duration";

export default function StudyCheckIn({ session, onClose, onSave }) {
  const dialog = useRef(null);
  const [status, setStatus] = useState("Complete");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const duration = durationMinutes(session);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(session, status, status === "Partially Complete" ? Number(minutes) : undefined);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this check-in. Try again.");
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="study-check-in-title" onCancel={(event) => {
      event.preventDefault();
      if (!saving) onClose();
    }}>
      <form className="inline-form" onSubmit={submit}>
        <h3 id="study-check-in-title">Study session check-in</h3>
        <p>{session.task.title} · {session.session_date} · {session.start_time}–{session.end_time} ({formatMinutes(duration)})</p>
        <label htmlFor="study-status">Session result</label>
        <select id="study-status" value={status} onChange={(event) => setStatus(event.target.value)} disabled={saving}>
          <option>Complete</option>
          <option disabled={duration < 2}>Partially Complete</option>
          <option>Missed</option>
        </select>
        {status === "Partially Complete" && (
          <>
            <label htmlFor="study-minutes">Minutes completed</label>
            <input id="study-minutes" type="number" min="1" max={duration - 1} value={minutes}
              onChange={(event) => setMinutes(event.target.value)} disabled={saving} required />
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="button-row">
          <button disabled={saving}>Save check-in</button>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}
