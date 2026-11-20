USE student_task_manager;

CREATE TABLE IF NOT EXISTS task_images (
    id CHAR(36) NOT NULL PRIMARY KEY,
    task_id INT NULL UNIQUE,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
