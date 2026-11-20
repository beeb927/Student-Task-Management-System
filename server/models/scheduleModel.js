const db = require("../config/db");

const SELECT = `
  SELECT s.id, s.user_id, s.course_id, s.title, s.type, s.day_of_week,
         TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
         s.location, c.code AS course_code, c.color AS course_color
  FROM class_schedules s
  LEFT JOIN courses c ON c.id = s.course_id`;

async function listClasses(userId) {
  const [rows] = await db.query(
    `${SELECT} WHERE s.user_id = ? ORDER BY s.day_of_week, s.start_time`,
    [userId]
  );
  return rows;
}

async function findClass(userId, id) {
  const [rows] = await db.query(`${SELECT} WHERE s.id = ? AND s.user_id = ?`, [id, userId]);
  return rows[0];
}

async function createClass(userId, c) {
  const [result] = await db.query(
    `INSERT INTO class_schedules
      (user_id, course_id, title, type, day_of_week, start_time, end_time, location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, c.courseId, c.title, c.type, c.dayOfWeek, c.startTime, c.endTime, c.location]
  );
  return result.insertId;
}

async function updateClass(userId, id, c) {
  const [result] = await db.query(
    `UPDATE class_schedules
     SET course_id = ?, title = ?, type = ?, day_of_week = ?,
         start_time = ?, end_time = ?, location = ?
     WHERE id = ? AND user_id = ?`,
    [c.courseId, c.title, c.type, c.dayOfWeek, c.startTime, c.endTime, c.location, id, userId]
  );
  return result.affectedRows;
}

async function deleteClass(userId, id) {
  const [result] = await db.query(
    "DELETE FROM class_schedules WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  return result.affectedRows;
}

module.exports = { listClasses, findClass, createClass, updateClass, deleteClass };
