const taskModel = require("../models/taskModel");
const { findCourse } = require("../models/courseModel");
const { PRIORITIES, STATUSES, toMysqlDateTime } = require("../utils/validate");

// Validates the body shared by create and update. Returns { error } or { data }.
async function parseTaskBody(userId, body, existing = {}) {
  const { title, description, dueDate, priority, estimatedHours, courseId, status } = body;

  if (!title || !String(title).trim()) {
    return { error: "Task title is required." };
  }

  const due = toMysqlDateTime(dueDate);
  if (due === undefined) {
    return { error: "Due date is not a valid date/time." };
  }

  const prio = priority || existing.priority || "Medium";
  if (!PRIORITIES.includes(prio)) {
    return { error: "Priority must be Low, Medium, or High." };
  }

  let hours = null;
  if (estimatedHours !== undefined && estimatedHours !== null && estimatedHours !== "") {
    hours = Number(estimatedHours);
    if (Number.isNaN(hours) || hours < 0 || hours > 999) {
      return { error: "Estimated hours must be a number between 0 and 999." };
    }
  }

  const stat = status || undefined;
  if (stat !== undefined && !STATUSES.includes(stat)) {
    return { error: "Status must be Incomplete or Complete." };
  }

  let course = null;
  if (courseId !== undefined && courseId !== null && courseId !== "") {
    const found = await findCourse(userId, courseId);
    if (!found) return { error: "Selected course does not exist." };
    course = found.id;
  }

  return {
    data: {
      title: String(title).trim(),
      description: description ? String(description).trim() || null : null,
      dueDate: due,
      priority: prio,
      estimatedHours: hours,
      courseId: course,
      status: stat,
    },
  };
}

// GET /api/tasks
async function getTasks(req, res) {
  try {
    res.json({ tasks: await taskModel.listTasks(req.user.id) });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Server error while loading tasks." });
  }
}

// GET /api/tasks/:id
async function getTask(req, res) {
  try {
    const task = await taskModel.findTask(req.user.id, req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json({ task });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ message: "Server error while loading task." });
  }
}

// POST /api/tasks
async function addTask(req, res) {
  try {
    const userId = req.user.id;
    const { error, data } = await parseTaskBody(userId, req.body);
    if (error) return res.status(400).json({ message: error });

    const taskId = await taskModel.createTask(
      userId,
      data.title,
      data.description,
      data.dueDate,
      data.priority,
      data.estimatedHours,
      data.courseId
    );

    return res.status(201).json({ message: "Task created successfully.", taskId });
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({ message: "Server error while creating task." });
  }
}

// PUT /api/tasks/:id  (edit any field)
async function editTask(req, res) {
  try {
    const userId = req.user.id;
    const existing = await taskModel.findTask(userId, req.params.id);
    if (!existing) return res.status(404).json({ message: "Task not found." });

    const { error, data } = await parseTaskBody(userId, req.body, existing);
    if (error) return res.status(400).json({ message: error });

    await taskModel.updateTask(userId, req.params.id, data);
    res.json({ message: "Task updated successfully." });
  } catch (error) {
    console.error("Edit task error:", error);
    res.status(500).json({ message: "Server error while updating task." });
  }
}

// PATCH /api/tasks/:id/status  (mark complete / incomplete)
async function changeStatus(req, res) {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Status must be Incomplete or Complete." });
    }
    const changed = await taskModel.setTaskStatus(req.user.id, req.params.id, status);
    if (!changed) {
      // affectedRows is 0 if the task is missing OR the status was already that value
      const exists = await taskModel.findTask(req.user.id, req.params.id);
      if (!exists) return res.status(404).json({ message: "Task not found." });
    }
    res.json({ message: "Status updated.", status });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ message: "Server error while updating status." });
  }
}

// DELETE /api/tasks/:id
async function removeTask(req, res) {
  try {
    const deleted = await taskModel.deleteTask(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task deleted." });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Server error while deleting task." });
  }
}

// DELETE /api/tasks/completed  (clear all completed tasks in one click)
async function clearCompleted(req, res) {
  try {
    const deleted = await taskModel.clearCompletedTasks(req.user.id);
    res.json({ message: `Cleared ${deleted} completed task(s).`, deleted });
  } catch (error) {
    console.error("Clear completed error:", error);
    res.status(500).json({ message: "Server error while clearing tasks." });
  }
}

module.exports = {
  getTasks,
  getTask,
  addTask,
  editTask,
  changeStatus,
  removeTask,
  clearCompleted,
};
