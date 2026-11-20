const express = require("express");
const protect = require("../middleware/authMiddleware");
const study = require("../models/studySessionModel");
const { validDate, minutesAt, checkInMinutes } = require("../utils/trackingValidation");

const router = express.Router();
router.use(protect);

router.get("/", async (req, res, next) => {
  try {
    return res.json(await study.getPlan(req.user.id));
  } catch (error) {
    return next(error);
  }
});

router.put("/plan", async (req, res, next) => {
  const { revision, cutoff, blocks } = req.body;
  const [date, time, ...extra] = typeof cutoff === "string" ? cutoff.split(" ") : [];
  if (typeof revision !== "string" || !validDate(date) || !Number.isFinite(minutesAt(time)) ||
      extra.length || !Array.isArray(blocks) || blocks.length > 20000) {
    return res.status(400).json({ message: "Invalid study plan." });
  }

  const keys = new Set();
  for (const block of blocks) {
    if (!block || !Number.isInteger(block.task_id) || !validDate(block.session_date)) {
      return res.status(400).json({ message: "Invalid study session." });
    }
    const start = minutesAt(block.start_time);
    const end = minutesAt(block.end_time);
    const key = `${block.task_id}|${block.session_date}|${block.start_time}`;
    if (!(start >= 480 && end <= 1320 && end > start && end - start <= 60) ||
        `${block.session_date} ${block.start_time}` < cutoff || keys.has(key)) {
      return res.status(400).json({ message: "Invalid study session time." });
    }
    keys.add(key);
  }

  try {
    const result = await study.savePlan(req.user.id, { revision, cutoff, blocks });
    if (result.invalid) return res.status(409).json({ message: "Tasks changed. Reload the calendar to update the plan." });
    if (result.conflict) return res.status(409).json({ sessions: result.sessions, revision: result.revision });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(404);
  const { status, minutes } = req.body;
  try {
    const result = await study.checkIn(req.user.id, id, status, (session) =>
      checkInMinutes(status, minutes, minutesAt(session.end_time) - minutesAt(session.start_time))
    );
    if (result.missing) return res.status(404).json({ message: "This session moved. Reload the calendar to find the updated plan." });
    if (result.invalid) return res.status(400).json({ message: "Choose a status and enter valid completed minutes for a partial session." });
    if (result.conflict) return res.status(409).json({ message: "This session already has a check-in." });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
