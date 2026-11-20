import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Shared by the Create Task and Edit Task pages.
function TaskForm({ initial, courses, onSubmit, submitLabel, showStatus = false, sidePanel, lockFields = false }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...formData,
        status: formData.completed ? "Complete" : "Incomplete",
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not save task.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={sidePanel ? "planner-edit-form" : undefined}>
      {error && <p className="error" role="alert">{error}</p>}

      <fieldset className="task-form-fields" disabled={saving || lockFields}>
        <label htmlFor="title">Task Title</label>
        <input id="title" type="text" name="title" value={formData.title} onChange={handleChange} required />

        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" value={formData.description} onChange={handleChange} />

        <label htmlFor="courseId">Course</label>
        <select id="courseId" name="courseId" value={formData.courseId} onChange={handleChange}>
          <option value="">No course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
          ))}
        </select>

        <div className="task-form-date-priority">
          <div className="task-form-field">
            <label htmlFor="dueDate">Due Date</label>
            <input id="dueDate" type="datetime-local" name="dueDate" value={formData.dueDate} onChange={handleChange} />

          </div>
          <div className="task-form-field">
            <label htmlFor="priority">Priority</label>
            <select id="priority" name="priority" value={formData.priority} onChange={handleChange}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              </select>

          </div>
        </div>

        <label htmlFor="estimatedHours">Estimated Hours</label>
        <input id="estimatedHours" type="number" name="estimatedHours" min="0" step="0.5"
          value={formData.estimatedHours} onChange={handleChange} />

        {showStatus && (
          <label className="check">
            <input type="checkbox" name="completed" checked={formData.completed} onChange={handleChange} />
            Completed
          </label>
        )}
      </fieldset>
      {typeof sidePanel === "function" ? sidePanel(saving) : sidePanel}

      <div className="button-row">
        <button type="submit" disabled={saving}>{saving ? "Saving..." : submitLabel}</button>
        <button type="button" className="secondary" disabled={saving} onClick={() => navigate("/dashboard")}>{lockFields ? "Back to Dashboard" : "Cancel"}</button>
      </div>
    </form>
  );
}

export default TaskForm;
