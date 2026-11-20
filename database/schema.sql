CREATE DATABASE IF NOT EXISTS student_task_manager;

USE student_task_manager;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NULL,  -- NULL for accounts that only use Google sign-in
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 2: courses (US-14, US-15)
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#2e75b6',
    shell_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATETIME,
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    status ENUM('Incomplete', 'Complete') DEFAULT 'Incomplete',
    estimated_hours DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- Sprint 2: weekly class schedule (US-8)
-- day_of_week: 1 = Monday ... 7 = Sunday
CREATE TABLE IF NOT EXISTS class_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NULL,
    title VARCHAR(150) NOT NULL,
    type ENUM('Lecture', 'Lab', 'Tutorial', 'Sleep', 'Work', 'Hobby', 'Other') DEFAULT 'Lecture',
    day_of_week TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- Google sign-in + Google Calendar sync
CREATE TABLE IF NOT EXISTS google_accounts (
    user_id INT PRIMARY KEY,
    google_sub VARCHAR(64) NOT NULL UNIQUE,      -- Google's stable account id
    google_email VARCHAR(255) NOT NULL,
    refresh_token_enc TEXT NULL,                  -- AES-256-GCM encrypted; NULL = calendar not connected
    calendar_connected TINYINT(1) NOT NULL DEFAULT 0,
    connected_at TIMESTAMP NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sprint 3: sleep logs, study sessions, and task checklists
CREATE TABLE IF NOT EXISTS sleep_logs (
    user_id INT NOT NULL,
    sleep_date DATE NOT NULL,
    minutes_slept SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, sleep_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (minutes_slept BETWEEN 1 AND 1440)
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('Planned', 'Complete', 'Partially Complete', 'Missed') NOT NULL DEFAULT 'Planned',
    completed_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE (task_id, session_date, start_time),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_checklist_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Task image attachments
CREATE TABLE IF NOT EXISTS task_images (
    id CHAR(36) NOT NULL PRIMARY KEY,
    task_id INT NULL UNIQUE,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
