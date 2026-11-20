const express = require("express");
const {
  getTasks,
  getTask,
  addTask,
  editTask,
  changeStatus,
  removeTask,
  clearCompleted,
} = require("../controllers/taskController");

const {
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} = require("../controllers/checklistController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();
router.use("/:id/image", require("./imageRoutes"));

// Task endpoints
router.get("/", protect, getTasks);
router.post("/", protect, addTask);
router.delete("/completed", protect, clearCompleted);
router.get("/:id", protect, getTask);
router.put("/:id", protect, editTask);
router.patch("/:id/status", protect, changeStatus);
router.delete("/:id", protect, removeTask);

// Subtask Checklist endpoints
router.get("/:id/checklist", protect, getChecklist);
router.post("/:id/checklist", protect, addChecklistItem);
router.patch("/:id/checklist/:itemId", protect, updateChecklistItem);
router.delete("/:id/checklist/:itemId", protect, deleteChecklistItem);

module.exports = router;