const db = require("../config/db");
const storage = require("../utils/imageStorage");

async function lookup(userId, taskId) {
  const [rows] = await db.execute(
    `SELECT i.id, i.storage_key, i.filename, i.content_type, i.size_bytes
     FROM tasks t LEFT JOIN task_images i ON i.task_id = t.id
     WHERE t.id = ? AND t.user_id = ?`, [taskId, userId]
  );
  return rows[0];
}

async function change(userId, taskId, image, bytes) {
  const conn = await db.getConnection();
  let uploadStarted = false;
  let commitStarted = false;
  try {
    await conn.beginTransaction();
    const [tasks] = await conn.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ? FOR UPDATE", [taskId, userId]);
    if (!tasks.length) {
      await conn.rollback();
      return false;
    }
    if (image) {
      uploadStarted = true;
      await storage.put(image.storage_key, bytes, image.content_type);
    }
    // A detached row stays in MySQL until its object has been deleted successfully.
    await conn.execute("UPDATE task_images SET task_id = NULL WHERE task_id = ?", [taskId]);
    if (image) {
      await conn.execute(
        "INSERT INTO task_images (id, task_id, storage_key, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)",
        [image.id, taskId, image.storage_key, image.filename, image.content_type, image.size_bytes]
      );
    }
    commitStarted = true;
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback().catch(() => {});
    // After an ambiguous commit, the object may already be referenced by a task.
    if (uploadStarted && !commitStarted) {
      try { await storage.remove(image.storage_key); }
      catch (cleanupError) {
        console.error("Could not roll back image upload:", cleanupError.message);
        await conn.execute(
          "INSERT INTO task_images (id, storage_key, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)",
          [image.id, image.storage_key, image.filename, image.content_type, image.size_bytes]
        ).catch((err) => console.error("Could not record image cleanup:", err.message));
      }
    }
    throw error;
  } finally {
    conn.release();
  }
}

let cleaning = false;
async function cleanDetached() {
  if (cleaning || !storage.enabled()) return;
  cleaning = true;
  try {
    const [rows] = await db.query("SELECT id, storage_key FROM task_images WHERE task_id IS NULL LIMIT 25");
    for (const image of rows) {
      try {
        await storage.remove(image.storage_key);
        await db.execute("DELETE FROM task_images WHERE id = ? AND task_id IS NULL", [image.id]);
      } catch (error) {
        console.error("Image cleanup will retry:", error.message);
      }
    }
  } catch (error) {
    console.error("Image cleanup unavailable:", error.message);
  } finally {
    cleaning = false;
  }
}
module.exports = { lookup, change, cleanDetached };
