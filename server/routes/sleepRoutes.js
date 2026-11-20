const express = require("express");
const db = require("../config/db");
const protect = require("../middleware/authMiddleware");
const { validDate } = require("../utils/trackingValidation");

const router = express.Router();
router.use(protect);

router.get("/", async (req, res, next) => {
  const { from, to } = req.query;
  if (!validDate(from) || !validDate(to) || from >= to) {
    return res.status(400).json({ message: "Choose a valid date range." });
  }
  try {
    const [logs] = await db.query(
      "SELECT sleep_date, minutes_slept FROM sleep_logs WHERE user_id = ? AND sleep_date >= ? AND sleep_date < ? ORDER BY sleep_date",
      [req.user.id, from, to]
    );
    return res.json({ logs });
  } catch (error) {
    return next(error);
  }
});

router.put("/:date", async (req, res, next) => {
  const date = req.params.date;
  const { minutes } = req.body;
  if (!validDate(date) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return res.status(400).json({ message: "Enter a valid wake date and a duration between 1 minute and 24 hours." });
  }
  try {
    await db.query(
      `INSERT INTO sleep_logs (user_id, sleep_date, minutes_slept) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE minutes_slept = ?`,
      [req.user.id, date, minutes, minutes]
    );
    return res.json({ sleep_date: date, minutes_slept: minutes });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:date", async (req, res, next) => {
  if (!validDate(req.params.date)) return res.status(400).json({ message: "Choose a valid wake date." });
  try {
    await db.query("DELETE FROM sleep_logs WHERE user_id = ? AND sleep_date = ?", [req.user.id, req.params.date]);
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
