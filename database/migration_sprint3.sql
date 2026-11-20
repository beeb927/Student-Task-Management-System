USE student_task_manager;

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
