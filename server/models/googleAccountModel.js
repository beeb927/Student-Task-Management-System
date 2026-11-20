const db = require("../config/db");

async function findByGoogleSub(sub) {
  const [rows] = await db.query("SELECT * FROM google_accounts WHERE google_sub = ?", [sub]);
  return rows[0];
}

async function findByUserId(userId) {
  const [rows] = await db.query("SELECT * FROM google_accounts WHERE user_id = ?", [userId]);
  return rows[0];
}

// Create the link, or update it if this user already has one.
// refreshTokenEnc === undefined keeps the stored token (Google only sends a refresh
// token on the first consent, so a later plain sign-in must not wipe it).
async function upsert(userId, { sub, email, refreshTokenEnc, calendarConnected }) {
  const existing = await findByUserId(userId);
  if (!existing) {
    const connected = refreshTokenEnc && calendarConnected ? 1 : 0;
    await db.query(
      `INSERT INTO google_accounts
         (user_id, google_sub, google_email, refresh_token_enc, calendar_connected, connected_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, sub, email, refreshTokenEnc ?? null, connected, connected ? new Date() : null]
    );
    return;
  }
  const token = refreshTokenEnc === undefined ? existing.refresh_token_enc : refreshTokenEnc;
  const connected = token ? (calendarConnected ? 1 : existing.calendar_connected) : 0;
  await db.query(
    `UPDATE google_accounts
     SET google_sub = ?, google_email = ?, refresh_token_enc = ?, calendar_connected = ?,
         connected_at = IF(? = 1 AND calendar_connected = 0, NOW(), connected_at)
     WHERE user_id = ?`,
    [sub, email, token, connected, connected, userId]
  );
}

// Forget the calendar credentials but keep the Google sign-in link.
async function clearCalendar(userId) {
  await db.query(
    "UPDATE google_accounts SET refresh_token_enc = NULL, calendar_connected = 0, connected_at = NULL WHERE user_id = ?",
    [userId]
  );
}

module.exports = { findByGoogleSub, findByUserId, upsert, clearCalendar };
