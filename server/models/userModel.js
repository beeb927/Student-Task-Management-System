const db = require("../config/db");

// Find a user by email (used for login and duplicate check).
// Returns the full row including the hashed password.
async function findUserByEmail(email) {
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0]; // undefined if not found
}

// Find a user by id (used by the "who am I?" route).
// We do NOT select the password here.
async function findUserById(id) {
  const [rows] = await db.query(
    "SELECT id, name, email, created_at FROM users WHERE id = ?",
    [id]
  );
  return rows[0];
}

// Insert a new user. The password must already be hashed.
async function createUser(name, email, hashedPassword) {
  const [result] = await db.query(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, hashedPassword]
  );
  return result.insertId;
}

module.exports = { findUserByEmail, findUserById, createUser };