const express = require("express");
const { getClasses, addClass, editClass, removeClass } = require("../controllers/scheduleController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getClasses);
router.post("/", protect, addClass);
router.put("/:id", protect, editClass);
router.delete("/:id", protect, removeClass);

module.exports = router;
