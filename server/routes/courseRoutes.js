const express = require("express");
const { getCourses, addCourse, editCourse, removeCourse } = require("../controllers/courseController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getCourses);
router.post("/", protect, addCourse);
router.put("/:id", protect, editCourse);
router.delete("/:id", protect, removeCourse);

module.exports = router;
