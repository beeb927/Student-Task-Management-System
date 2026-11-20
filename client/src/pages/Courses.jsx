import { useEffect, useState } from "react";
import { createCourse, deleteCourse, getCourses, updateCourse } from "../services/api";

const EMPTY = { code: "", name: "", color: "#2e75b6", shellUrl: "" };

function Courses() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    getCourses()
      .then((r) => active && setCourses(r.data.courses))
      .catch((err) => active && setError(err.response?.data?.message || "Could not load courses."));
    return () => { active = false; };
  }, [version]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await updateCourse(editingId, form);
      else await createCourse(form);
      setForm(EMPTY);
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save course.");
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({ code: c.code, name: c.name, color: c.color, shellUrl: c.shell_url || "" });
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.code}? Its tasks and classes are kept without a course.`)) return;
    try { await deleteCourse(c.id); reload(); }
    catch (err) { setError(err.response?.data?.message || "Could not delete course."); }
  };

  return (
    <div className="planner-section">
      <h2>Courses</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="inline-form">
        <h3>{editingId ? "Edit course" : "Add a course"}</h3>
        <label htmlFor="code">Course code</label>
        <input id="code" name="code" placeholder="CPS714" value={form.code} onChange={handleChange} required />
        <label htmlFor="name">Course name</label>
        <input id="name" name="name" placeholder="Software Project Management" value={form.name} onChange={handleChange} required />
        <label htmlFor="shellUrl">Course shell link (optional)</label>
        <input id="shellUrl" name="shellUrl" type="url" placeholder="https://..." value={form.shellUrl} onChange={handleChange} />
        <label htmlFor="color">Colour</label>
        <input id="color" name="color" type="color" value={form.color} onChange={handleChange} />
        <div className="button-row">
          <button type="submit">{editingId ? "Save changes" : "Add course"}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {courses.length === 0 ? (
        <p className="empty">No courses yet. Add one above to tag your tasks and classes.</p>
      ) : (
        <ul className="task-list">
          {courses.map((c) => (
            <li key={c.id} className="task-card" style={{ borderLeft: `6px solid ${c.color}` }}>
              <div className="task-main">
                <div className="task-title">{c.code} - {c.name}</div>
                {c.shell_url && (
                  <div className="task-meta">
                    <a href={c.shell_url} target="_blank" rel="noreferrer">Open course shell</a>
                  </div>
                )}
              </div>
              <div className="task-actions">
                <button className="secondary" onClick={() => startEdit(c)}>Edit</button>
                <button className="danger" onClick={() => remove(c)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Courses;
