const db = require("../config/db");

async function listCourses(userId) {
  const [rows] = await db.query(
    "SELECT * FROM courses WHERE user_id = ? ORDER BY code",
    [userId]
  );
  return rows;
}

async function findCourse(userId, id) {
  const [rows] = await db.query(
    "SELECT * FROM courses WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  return rows[0];
}

async function createCourse(userId, { code, name, color, shellUrl }) {
  const [result] = await db.query(
    "INSERT INTO courses (user_id, code, name, color, shell_url) VALUES (?, ?, ?, ?, ?)",
    [userId, code, name, color, shellUrl]
  );
  return result.insertId;
}

async function updateCourse(userId, id, { code, name, color, shellUrl }) {
  const [result] = await db.query(
    `UPDATE courses SET code = ?, name = ?, color = ?, shell_url = ?
     WHERE id = ? AND user_id = ?`,
    [code, name, color, shellUrl, id, userId]
  );
  return result.affectedRows;
}

async function deleteCourse(userId, id) {
  const [result] = await db.query(
    "DELETE FROM courses WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  return result.affectedRows;
}

module.exports = { listCourses, findCourse, createCourse, updateCourse, deleteCourse };
