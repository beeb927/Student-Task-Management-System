const courseModel = require("../models/courseModel");

function parseCourse(body) {
  const code = String(body.code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const color = body.color || "#2e75b6";
  const shellUrl = String(body.shellUrl || "").trim() || null;

  if (!code) return { error: "Course code is required (e.g. CPS714)." };
  if (!name) return { error: "Course name is required." };
  if (code.length > 30 || name.length > 150) return { error: "Code or name is too long." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Color must look like #2e75b6." };
  if (shellUrl && !/^https?:\/\/\S+$/i.test(shellUrl)) {
    return { error: "Course link must start with http:// or https://" };
  }
  return { data: { code, name, color, shellUrl } };
}

async function getCourses(req, res) {
  try {
    res.json({ courses: await courseModel.listCourses(req.user.id) });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ message: "Server error while loading courses." });
  }
}

async function addCourse(req, res) {
  try {
    const { error, data } = parseCourse(req.body);
    if (error) return res.status(400).json({ message: error });
    const courseId = await courseModel.createCourse(req.user.id, data);
    res.status(201).json({ message: "Course created.", courseId });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ message: "Server error while creating course." });
  }
}

async function editCourse(req, res) {
  try {
    const { error, data } = parseCourse(req.body);
    if (error) return res.status(400).json({ message: error });
    const existing = await courseModel.findCourse(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ message: "Course not found." });
    await courseModel.updateCourse(req.user.id, req.params.id, data);
    res.json({ message: "Course updated." });
  } catch (error) {
    console.error("Edit course error:", error);
    res.status(500).json({ message: "Server error while updating course." });
  }
}

// Deleting a course keeps its tasks/classes (course_id becomes NULL).
async function removeCourse(req, res) {
  try {
    const deleted = await courseModel.deleteCourse(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ message: "Course not found." });
    res.json({ message: "Course deleted." });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({ message: "Server error while deleting course." });
  }
}

module.exports = { getCourses, addCourse, editCourse, removeCourse };
