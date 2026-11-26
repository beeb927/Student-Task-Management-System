const db = require("../config/db");

// Serialize checklist writes for a task so checking the last item and completing
// its parent happen together, even when several requests arrive concurrently.
async function withChecklistWrite(userId, taskId, write) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [tasks] = await connection.query(
      "SELECT id FROM tasks WHERE id = ? AND user_id = ? FOR UPDATE",
      [taskId, userId]
    );
    const result = tasks.length ? await write(connection) : null;
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listItems(userId, taskId) {
  const [rows] = await db.query(
    `SELECT
       i.id,
       i.task_id,
       i.title,
       i.completed,
       i.position
     FROM task_checklist_items i
     INNER JOIN tasks t ON t.id = i.task_id
     WHERE t.user_id = ?
       AND i.task_id = ?
     ORDER BY i.position ASC, i.id ASC`,
    [userId, taskId]
  );
  return rows;
}

async function addItem(userId, taskId, title) {
  return withChecklistWrite(userId, taskId, async (connection) => {
    const [[{ next_position: nextPosition }]] = await connection.query(
      `SELECT COALESCE(MAX(position) + 1, 0) AS next_position
       FROM task_checklist_items
       WHERE task_id = ?`,
      [taskId]
    );
    const [result] = await connection.query(
      "INSERT INTO task_checklist_items (task_id, title, position) VALUES (?, ?, ?)",
      [taskId, title, nextPosition]
    );
    return result.insertId;
  });
}

async function updateItem(userId, taskId, itemId, changes) {
  const fields = [];
  const params = [];

  if (changes.title !== undefined) {
    fields.push("i.title = ?");
    params.push(changes.title);
  }

  if (changes.completed !== undefined) {
    fields.push("i.completed = ?");
    params.push(changes.completed ? 1 : 0);
  }

  if (fields.length === 0) return 0;

  return withChecklistWrite(userId, taskId, async (connection) => {
    const [result] = await connection.query(
      `UPDATE task_checklist_items i
       SET ${fields.join(", ")}
       WHERE i.id = ? AND i.task_id = ?`,
      [...params, itemId, taskId]
    );

    if (result.affectedRows && changes.completed === true) {
      // A matched item guarantees the checklist is nonempty.
      await connection.query(
        `UPDATE tasks
         SET status = 'Complete'
         WHERE id = ? AND user_id = ? AND status <> 'Complete'
           AND NOT EXISTS (
             SELECT 1 FROM task_checklist_items WHERE task_id = ? AND completed = 0
           )`,
        [taskId, userId, taskId]
      );
    }
    return result.affectedRows;
  });
}

async function deleteItem(userId, taskId, itemId) {
  return withChecklistWrite(userId, taskId, async (connection) => {
    const [result] = await connection.query(
      "DELETE FROM task_checklist_items WHERE id = ? AND task_id = ?",
      [itemId, taskId]
    );
    return result.affectedRows;
  });
}

module.exports = {
  listItems,
  addItem,
  updateItem,
  deleteItem,
};