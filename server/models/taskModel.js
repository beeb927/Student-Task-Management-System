const db = require("../config/db");
const { enabled: imagesEnabled } = require("../utils/imageStorage");

// ============================================
// TASK SELECT QUERY
// ============================================
// Retrieves task details, course information, and checklist progress
const TASK_SELECT = (includeImage = false) => `
  SELECT
    t.*,
    ${includeImage ? "image.id AS image_id," : ""}
    c.code AS course_code,
    c.name AS course_name,
    c.color AS course_color,
    c.shell_url AS course_shell_url,
    COALESCE(checklist.checklist_total, 0) AS checklist_total,
    COALESCE(checklist.checklist_completed, 0) AS checklist_completed
  FROM tasks t
  ${includeImage ? "LEFT JOIN task_images image ON image.task_id = t.id" : ""}
  LEFT JOIN courses c
    ON c.id = t.course_id
  LEFT JOIN (
    SELECT
      task_id,
      COUNT(*) AS checklist_total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS checklist_completed
    FROM task_checklist_items
    GROUP BY task_id
  ) checklist
    ON checklist.task_id = t.id
`;

// ============================================
// GET ALL TASKS
// ============================================
async function listTasks(userId) {
  const [rows] = await db.query(
    `${TASK_SELECT(imagesEnabled())}
     WHERE t.user_id = ?
     ORDER BY
       t.due_date IS NULL,
       t.due_date ASC,
       t.id ASC`,
    [userId]
  );
  return rows;
}

// ============================================
// GET ONE TASK
// ============================================
async function findTask(userId, id) {
  const [rows] = await db.query(
    `${TASK_SELECT()}
     WHERE t.id = ?
       AND t.user_id = ?`,
    [id, userId]
  );
  return rows[0];
}

// ============================================
// CREATE A TASK
// Supports both positional arguments and object notation
// ============================================
async function createTask(
  userId,
  titleOrObj,
  description,
  dueDate,
  priority,
  estimatedHours,
  courseId = null
) {
  let title, desc, due, prio, estHours, cId;

  if (typeof titleOrObj === "object" && titleOrObj !== null) {
    ({
      title,
      description: desc,
      dueDate: due,
      priority: prio,
      estimatedHours: estHours,
      courseId: cId,
    } = titleOrObj);
  } else {
    title = titleOrObj;
    desc = description;
    due = dueDate;
    prio = priority;
    estHours = estimatedHours;
    cId = courseId;
  }

  const [result] = await db.query(
    `INSERT INTO tasks
      (
        user_id,
        course_id,
        title,
        description,
        due_date,
        priority,
        estimated_hours
      )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      cId || null,
      title,
      desc || null,
      due || null,
      prio || "Medium",
      estHours ?? null,
    ]
  );

  return result.insertId;
}

// ============================================
// UPDATE A TASK
// ============================================
async function updateTask(
  userId,
  id,
  {
    title,
    description,
    dueDate,
    priority,
    estimatedHours,
    courseId,
    status,
  }
) {
  const [result] = await db.query(
    `UPDATE tasks
     SET
       title = ?,
       description = ?,
       due_date = ?,
       priority = ?,
       estimated_hours = ?,
       course_id = ?,
       status = ?
     WHERE id = ?
       AND user_id = ?`,
    [
      title,
      description || null,
      dueDate || null,
      priority,
      estimatedHours ?? null,
      courseId || null,
      status,
      id,
      userId,
    ]
  );

  return result.affectedRows;
}

// ============================================
// CHANGE TASK COMPLETION STATUS
// ============================================
async function setTaskStatus(userId, id, status) {
  const [result] = await db.query(
    `UPDATE tasks
     SET status = ?
     WHERE id = ?
       AND user_id = ?`,
    [status, id, userId]
  );
  return result.affectedRows;
}

// ============================================
// DELETE ONE TASK
// ============================================
async function deleteTask(userId, id) {
  const [result] = await db.query(
    `DELETE FROM tasks
     WHERE id = ?
       AND user_id = ?`,
    [id, userId]
  );
  return result.affectedRows;
}

// ============================================
// DELETE ALL COMPLETED TASKS
// ============================================
async function clearCompletedTasks(userId) {
  const [result] = await db.query(
    `DELETE FROM tasks
     WHERE user_id = ?
       AND status = 'Complete'`,
    [userId]
  );
  return result.affectedRows;
}

// ============================================
// EXPORT MODEL FUNCTIONS
// ============================================
module.exports = {
  listTasks,
  findTask,
  createTask,
  updateTask,
  setTaskStatus,
  deleteTask,
  clearCompletedTasks,
};