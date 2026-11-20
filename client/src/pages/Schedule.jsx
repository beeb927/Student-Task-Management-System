import { useEffect, useState } from "react";
import {
  createClass, deleteClass, getClasses, getCourses, updateClass,
} from "../services/api";
import { DAY_NAMES } from "../utils/calendarUtils";

const EMPTY = {
  title: "", type: "Lecture", dayOfWeek: "1", startTime: "09:00",
  endTime: "10:00", location: "", courseId: "",
};

function Schedule() {
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    Promise.all([getClasses(), getCourses()])
      .then(([cl, co]) => {
        if (!active) return;
        setClasses(cl.data.classes);
        setCourses(co.data.courses);
      })
      .catch((err) => active && setError(err.response?.data?.message || "Could not load schedule."));
    return () => { active = false; };
  }, [version]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const start = form.startTime.slice(0, 5);
    const end = form.endTime.slice(0, 5);
    if (end === start) {
      setError("Start and end time must be different.");
      return;
    }
    if (form.type !== "Sleep" && end < start) {
      setError("End time must be after start time.");
      return;
    }
    try {
      if (editingId) await updateClass(editingId, form);
      else await createClass(form);
      setForm(EMPTY);
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save class.");
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({
      title: c.title, type: c.type, dayOfWeek: String(c.day_of_week),
      startTime: c.start_time, endTime: c.end_time,
      location: c.location || "", courseId: c.course_id ?? "",
    });
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.title}" from your schedule?`)) return;
    try { await deleteClass(c.id); reload(); }
    catch (err) { setError(err.response?.data?.message || "Could not delete class."); }
  };

  return (
    <div className="planner-section">
      <h2>Class Schedule</h2>
      <p>Add your weekly lectures, labs and tutorials. They repeat every week on the calendar.</p>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="inline-form">
        <h3>{editingId ? "Edit class" : "Add a class"}</h3>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" placeholder="e.g. Sleep, Gym, CPS714 Lab" value={form.title} onChange={handleChange} required />
        <label htmlFor="type">Type</label>
        <select id="type" name="type" value={form.type} onChange={handleChange}>
          <option value="Lecture">Lecture</option>
          <option value="Lab">Lab</option>
          <option value="Tutorial">Tutorial</option>
          <option value="Sleep">Sleep Routine</option>
          <option value="Hobby">Hobby / Gym / Personal</option>
          <option value="Work">Work / Job</option>
          <option value="Other">Other</option>
        </select>
        <label htmlFor="courseId">Course</label>
        <select id="courseId" name="courseId" value={form.courseId} onChange={handleChange}>
          <option value="">No course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
        </select>
        <label htmlFor="dayOfWeek">{form.type === "Sleep" ? "Day sleep starts" : "Day"}</label>
        <select id="dayOfWeek" name="dayOfWeek" value={form.dayOfWeek} onChange={handleChange}>
          {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </select>
        <label htmlFor="startTime">Start</label>
        <input id="startTime" name="startTime" type="time" value={form.startTime} onChange={handleChange} required />
        <label htmlFor="endTime">End</label>
        <input id="endTime" name="endTime" type="time" value={form.endTime} onChange={handleChange} required />
        {form.type === "Sleep" && <p>An earlier end time means you wake up the next day. For example, 23:00–07:00 is eight hours overnight.</p>}
        <label htmlFor="location">Location (optional)</label>
        <input id="location" name="location" placeholder="Room / link" value={form.location} onChange={handleChange} />
        <div className="button-row">
          <button type="submit">{editingId ? "Save changes" : "Add class"}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {classes.length === 0 ? (
        <p className="empty">No classes added yet.</p>
      ) : (
        DAY_NAMES.map((day, i) => {
          const todays = classes.filter((c) => c.day_of_week === i + 1);
          if (todays.length === 0) return null;
          return (
            <section key={day}>
              <h3>{day}</h3>
              <ul className="task-list">
                {todays.map((c) => (
                  <li key={c.id} className="task-card" style={{ borderLeft: `6px solid ${c.course_color || "#888"}` }}>
                    <div className="task-main">
                      <div className="task-title">
                        {c.start_time} - {c.end_time}{c.type === "Sleep" && c.end_time < c.start_time ? " (next day)" : ""}: {c.title}
                        <span className="badge">{c.type}</span>
                      </div>
                      <div className="task-meta">
                        {c.course_code && `${c.course_code} `}{c.location && `| ${c.location}`}
                      </div>
                    </div>
                    <div className="task-actions">
                      <button className="secondary" onClick={() => startEdit(c)}>Edit</button>
                      <button className="danger" onClick={() => remove(c)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

export default Schedule;
