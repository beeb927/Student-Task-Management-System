require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const db = require("./config/db");
const { cleanDetached } = require("./models/imageModel");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const courseRoutes = require("./routes/courseRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const sleepRoutes = require("./routes/sleepRoutes");
const studyRoutes = require("./routes/studyRoutes");
const googleRoutes = require("./routes/googleRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/google", googleRoutes);
app.use("/api/sleep", sleepRoutes);
app.use("/api/study-sessions", studyRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error.message);
  return res.status(error.status === 400 ? 400 : 500).json({
    message: error.status === 400 ? "Invalid request." : "Could not save or load tracking data.",
  });
});

app.get("/", (req, res) => {
  res.json({ message: "Student Task Manager Unified API is running." });
});

async function startServer() {
  try {
    await db.query("SELECT 1");
    console.log("Connected to MySQL database.");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      void cleanDetached();
      setInterval(cleanDetached, 15000).unref();
    });
  } catch (error) {
    console.error("Could not connect to MySQL:", error.message);
    process.exit(1);
  }
}

startServer();