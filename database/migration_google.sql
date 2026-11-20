-- Run ONCE on an existing database to add Google sign-in + Google Calendar support.
-- (New installs can just run schema.sql, which already includes this.)
USE student_task_manager;

-- Users who sign in with Google have no password.
ALTER TABLE users MODIFY password VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS google_accounts (
    user_id INT PRIMARY KEY,
    google_sub VARCHAR(64) NOT NULL UNIQUE,      -- Google's stable account id
    google_email VARCHAR(255) NOT NULL,
    refresh_token_enc TEXT NULL,                  -- AES-256-GCM encrypted; NULL = calendar not connected
    calendar_connected TINYINT(1) NOT NULL DEFAULT 0,
    connected_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
