const db = require("../config/db");

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
  const [positionRows] = await db.query(
    `SELECT
       COALESCE(MAX(position) + 1, 0) AS next_position
     FROM task_checklist_items
     WHERE task_id = ?`,
    [taskId]
  );
  const nextPosition = positionRows[0].next_position;

  const [result] = await db.query(
    `INSERT INTO task_checklist_items (task_id, title, position)
     SELECT id, ?, ?
     FROM tasks
     WHERE id = ? AND user_id = ?`,
    [title, nextPosition, taskId, userId]
  );
  return result.insertId || null;
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

  const [result] = await db.query(
    `UPDATE task_checklist_items i
     INNER JOIN tasks t ON t.id = i.task_id
     SET ${fields.join(", ")}
     WHERE i.id = ?
       AND i.task_id = ?
       AND t.user_id = ?`,
    [...params, itemId, taskId, userId]
  );
  return result.affectedRows;
}

async function deleteItem(userId, taskId, itemId) {
  const [result] = await db.query(
    `DELETE i
     FROM task_checklist_items i
     INNER JOIN tasks t ON t.id = i.task_id
     WHERE i.id = ?
       AND i.task_id = ?
       AND t.user_id = ?`,
    [itemId, taskId, userId]
  );
  return result.affectedRows;
}

module.exports = {
  listItems,
  addItem,
  updateItem,
  deleteItem,
};