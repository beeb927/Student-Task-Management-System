const scheduleModel = require("../models/scheduleModel");
const { findCourse } = require("../models/courseModel");
const { CLASS_TYPES, toMysqlTime } = require("../utils/validate");

async function parseClass(userId, body) {
  const title = String(body.title || "").trim();
  if (!title) return { error: "Class title is required." };

  const type = body.type || "Lecture";
  if (!CLASS_TYPES.includes(type)) {
  return { error: `Type must be one of: ${CLASS_TYPES.join(", ")}.` };
  }

  const dayOfWeek = Number(body.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    return { error: "Day of week must be 1 (Monday) to 7 (Sunday)." };
  }

  const startTime = toMysqlTime(body.startTime);
  const endTime = toMysqlTime(body.endTime);
  if (!startTime || !endTime) return { error: "Start and end time must be valid times (HH:MM)." };
  if (endTime === startTime) return { error: "Start and end time must be different." };
  if (type !== "Sleep" && endTime < startTime) return { error: "End time must be after start time." };

  let courseId = null;
  if (body.courseId !== undefined && body.courseId !== null && body.courseId !== "") {
    const course = await findCourse(userId, body.courseId);
    if (!course) return { error: "Selected course does not exist." };
    courseId = course.id;
  }

  const location = String(body.location || "").trim() || null;
  return { data: { title, type, dayOfWeek, startTime, endTime, courseId, location } };
}

async function getClasses(req, res) {
  try {
    res.json({ classes: await scheduleModel.listClasses(req.user.id) });
  } catch (error) {
    console.error("Get classes error:", error);
    res.status(500).json({ message: "Server error while loading schedule." });
  }
}

async function addClass(req, res) {
  try {
    const { error, data } = await parseClass(req.user.id, req.body);
    if (error) return res.status(400).json({ message: error });
    const classId = await scheduleModel.createClass(req.user.id, data);
    res.status(201).json({ message: "Class added.", classId });
  } catch (error) {
    console.error("Add class error:", error);
    res.status(500).json({ message: "Server error while adding class." });
  }
}

async function editClass(req, res) {
  try {
    const existing = await scheduleModel.findClass(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ message: "Class not found." });
    const { error, data } = await parseClass(req.user.id, req.body);
    if (error) return res.status(400).json({ message: error });
    await scheduleModel.updateClass(req.user.id, req.params.id, data);
    res.json({ message: "Class updated." });
  } catch (error) {
    console.error("Edit class error:", error);
    res.status(500).json({ message: "Server error while updating class." });
  }
}

async function removeClass(req, res) {
  try {
    const deleted = await scheduleModel.deleteClass(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ message: "Class not found." });
    res.json({ message: "Class deleted." });
  } catch (error) {
    console.error("Delete class error:", error);
    res.status(500).json({ message: "Server error while deleting class." });
  }
}

module.exports = { getClasses, addClass, editClass, removeClass };
