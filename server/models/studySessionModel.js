const { createHash } = require("node:crypto");
const db = require("../config/db");

const SELECT = `
  SELECT s.id, s.task_id, s.session_date, TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(s.end_time, '%H:%i') AS end_time, s.status, s.completed_minutes
  FROM study_sessions s JOIN tasks t ON t.id = s.task_id
  WHERE t.user_id = ?
`;

async function getPlan(userId, conn = db) {
  const [sessions] = await conn.query(`${SELECT} ORDER BY s.id`, [userId]);
  const revision = createHash("sha256").update(JSON.stringify(sessions)).digest("hex");
  return { sessions, revision };
}

async function withPlanLock(userId, work) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function savePlan(userId, { revision, cutoff, blocks }) {
  return withPlanLock(userId, async (conn) => {
    const existing = await getPlan(userId, conn);
    if (revision !== existing.revision) return { conflict: true, ...existing };

    const [tasks] = await conn.query(
      "SELECT id, due_date, status FROM tasks WHERE user_id = ? FOR UPDATE", [userId]
    );
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    for (const block of blocks) {
      const task = tasksById.get(block.task_id);
      const end = `${block.session_date} ${block.end_time}:00`;
      if (!task || task.status === "Complete" || !task.due_date || end > task.due_date) {
        return { invalid: true };
      }
    }

    const key = (session) => `${session.task_id}|${session.session_date}|${session.start_time}|${session.end_time}`;
    const proposed = new Set(blocks.map(key));
    const retained = new Set();
    const obsolete = [];
    for (const session of existing.sessions) {
      if (session.status !== "Planned" || `${session.session_date} ${session.start_time}` < cutoff ||
          proposed.has(key(session))) {
        retained.add(key(session));
      } else {
        obsolete.push(session.id);
      }
    }
    if (obsolete.length) await conn.query("DELETE FROM study_sessions WHERE id IN (?)", [obsolete]);
    const additions = blocks.filter((block) => !retained.has(key(block)));
    if (additions.length) {
      await conn.query(
        "INSERT INTO study_sessions (task_id, session_date, start_time, end_time) VALUES ?",
        [additions.map((block) => [block.task_id, block.session_date, block.start_time, block.end_time])]
      );
    }
    return getPlan(userId, conn);
  });
}

async function checkIn(userId, id, status, getCompletedMinutes) {
  return withPlanLock(userId, async (conn) => {
    const [rows] = await conn.query(`${SELECT} AND s.id = ? FOR UPDATE`, [userId, id]);
    const session = rows[0];
    if (!session) return { missing: true };
    const completed = getCompletedMinutes(session);
    if (completed === null) return { invalid: true };
    if (session.status !== "Planned") {
      if (session.status === status && session.completed_minutes === completed) return getPlan(userId, conn);
      return { conflict: true };
    }
    await conn.query("UPDATE study_sessions SET status = ?, completed_minutes = ? WHERE id = ?", [status, completed, id]);
    return getPlan(userId, conn);
  });
}

module.exports = { getPlan, savePlan, checkIn };
