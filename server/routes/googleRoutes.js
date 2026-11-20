const express = require("express");
const { login, connect, callback, status, events, disconnect } = require("../controllers/googleController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/login", login);                    // public: "Continue with Google"
router.get("/connect", protect, connect);       // logged in: link Google Calendar
router.get("/callback", callback);              // Google redirects back here
router.get("/status", protect, status);
router.get("/events", protect, events);
router.post("/disconnect", protect, disconnect);

module.exports = router;
