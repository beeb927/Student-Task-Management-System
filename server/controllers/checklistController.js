const taskChecklistModel = require("../models/taskChecklistModel");
const { findTask } = require("../models/taskModel");

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

async function findOwnedTask(req, res) {
  const taskId = req.params.id;
  if (!validId(taskId)) {
    res.status(400).json({ message: "Invalid task ID." });
    return null;
  }
  const task = await findTask(req.user.id, taskId);
  if (!task) {
    res.status(404).json({ message: "Task not found." });
    return null;
  }
  return task;
}

// GET /api/tasks/:id/checklist
async function getChecklist(req, res) {
  try {
    const task = await findOwnedTask(req, res);
    if (!task) return;
    const items = await taskChecklistModel.listItems(req.user.id, req.params.id);
    return res.json({ items });
  } catch (error) {
    console.error("Get checklist error:", error);
    return res.status(500).json({ message: "Server error while loading checklist." });
  }
}

// POST /api/tasks/:id/checklist
async function addChecklistItem(req, res) {
  try {
    const task = await findOwnedTask(req, res);
    if (!task) return;

    const title = String(req.body?.title ?? "").trim();
    if (!title) {
      return res.status(400).json({ message: "Checklist item title is required." });
    }
    if (title.length > 255) {
      return res.status(400).json({ message: "Checklist item title cannot exceed 255 characters." });
    }

    const itemId = await taskChecklistModel.addItem(req.user.id, req.params.id, title);
    if (!itemId) {
      return res.status(404).json({ message: "Task not found." });
    }
    return res.status(201).json({ message: "Checklist item added.", itemId });
  } catch (error) {
    console.error("Add checklist item error:", error);
    return res.status(500).json({ message: "Server error while adding checklist item." });
  }
}

// PATCH /api/tasks/:id/checklist/:itemId
async function updateChecklistItem(req, res) {
  try {
    const task = await findOwnedTask(req, res);
    if (!task) return;

    if (!validId(req.params.itemId)) {
      return res.status(400).json({ message: "Invalid checklist item ID." });
    }

    const changes = {};
    if (req.body?.title !== undefined) {
      if (typeof req.body.title !== "string") {
        return res.status(400).json({ message: "Checklist title must be text." });
      }
      const title = req.body.title.trim();
      if (!title || title.length > 255) {
        return res.status(400).json({ message: "Checklist title must contain 1 to 255 characters." });
      }
      changes.title = title;
    }

    if (req.body?.completed !== undefined) {
      if (typeof req.body.completed !== "boolean") {
        return res.status(400).json({ message: "Completed must be true or false." });
      }
      changes.completed = req.body.completed;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: "Provide a title or completed status to update." });
    }

    const updated = await taskChecklistModel.updateItem(
      req.user.id,
      req.params.id,
      req.params.itemId,
      changes
    );

    if (!updated) {
      return res.status(404).json({ message: "Checklist item not found." });
    }
    return res.json({ message: "Checklist item updated." });
  } catch (error) {
    console.error("Update checklist item error:", error);
    return res.status(500).json({ message: "Server error while updating checklist item." });
  }
}

// DELETE /api/tasks/:id/checklist/:itemId
async function deleteChecklistItem(req, res) {
  try {
    const task = await findOwnedTask(req, res);
    if (!task) return;

    if (!validId(req.params.itemId)) {
      return res.status(400).json({ message: "Invalid checklist item ID." });
    }

    const deleted = await taskChecklistModel.deleteItem(
      req.user.id,
      req.params.id,
      req.params.itemId
    );

    if (!deleted) {
      return res.status(404).json({ message: "Checklist item not found." });
    }
    return res.json({ message: "Checklist item deleted." });
  } catch (error) {
    console.error("Delete checklist item error:", error);
    return res.status(500).json({ message: "Server error while deleting checklist item." });
  }
}

module.exports = {
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
};