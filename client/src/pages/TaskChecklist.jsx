import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SubtaskProgress from "../components/SubtaskProgress";
import { getTask, getChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem } from "../services/api";

function TaskChecklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (isCurrent = () => true) => {
    try {
      const [taskRes, checkRes] = await Promise.all([getTask(id), getChecklist(id)]);
      if (!isCurrent()) return;
      setError("");
      setTask(taskRes.data.task);
      setItems(checkRes.data.items);
    } catch (err) {
      if (isCurrent()) setError(err.response?.data?.message || "Could not load task checklist.");
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadData(() => active);
    });
    return () => { active = false; };
  }, [loadData]);

  const saveChecklist = async (action, fallbackError) => {
    setSaving(true);
    try {
      await action();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || fallbackError);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (saving || !newTitle.trim()) return;
    return saveChecklist(async () => {
      await addChecklistItem(id, newTitle.trim());
      setNewTitle("");
    }, "Could not add item.");
  };

  const handleToggle = (item) =>
    saveChecklist(() => updateChecklistItem(id, item.id, { completed: !item.completed }),
      "Could not update item status.");

  const handleDelete = (itemId) =>
    saveChecklist(() => deleteChecklistItem(id, itemId), "Could not remove item.");

  if (!task || String(task.id) !== id) return error ? <p className="error">{error}</p> : <p>Loading...</p>;

  return (
    <div className="planner-section">
      <button className="secondary" onClick={() => navigate("/dashboard")} style={{ marginBottom: 15 }}>
        &larr; Back to Dashboard
      </button>
      <h2>Subtasks: {task.title}</h2>
      <SubtaskProgress completed={items.filter((item) => item.completed).length} total={items.length} />
      {task.status === "Complete" && <p role="status">Task completed</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Add subtask or step..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={saving}
          required
        />
        <button type="submit" disabled={saving}>Add</button>
      </form>

      {items.length === 0 ? (
        <p className="empty">No subtasks yet. Add items above to track progress!</p>
      ) : (
        <ul className="task-list">
          {items.map((item) => (
            <li key={item.id} className="task-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", textDecoration: item.completed ? "line-through" : "none" }}>
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={Boolean(item.completed)}
                  onChange={() => handleToggle(item)}
                />
                <span style={{ color: item.completed ? "#888" : "inherit" }}>{item.title}</span>
              </label>
              <button className="danger" disabled={saving} onClick={() => handleDelete(item.id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TaskChecklist;
