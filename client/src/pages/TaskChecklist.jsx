import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTask, getChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem } from "../services/api";

function TaskChecklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

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

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await addChecklistItem(id, newTitle.trim());
      setNewTitle("");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add item.");
    }
  };

  const handleToggle = async (item) => {
    try {
      await updateChecklistItem(id, item.id, { completed: !item.completed });
      loadData();
    } catch {
      setError("Could not update item status.");
    }
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteChecklistItem(id, itemId);
      loadData();
    } catch {
      setError("Could not remove item.");
    }
  };

  if (!task || String(task.id) !== id) return error ? <p className="error">{error}</p> : <p>Loading...</p>;

  return (
    <div className="planner-section">
      <button className="secondary" onClick={() => navigate("/dashboard")} style={{ marginBottom: 15 }}>
        &larr; Back to Dashboard
      </button>
      <h2>Subtasks: {task.title}</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Add subtask or step..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          required
        />
        <button type="submit">Add</button>
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
                  checked={Boolean(item.completed)}
                  onChange={() => handleToggle(item)}
                />
                <span style={{ color: item.completed ? "#888" : "inherit" }}>{item.title}</span>
              </label>
              <button className="danger" onClick={() => handleDelete(item.id)} style={{ padding: "4px 8px", fontSize: "12px" }}>
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