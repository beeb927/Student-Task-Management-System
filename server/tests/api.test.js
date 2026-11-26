// Integration tests for the Sprint 1 + Sprint 2 API.
// Needs the server running (npm start) against a database built from database/schema.sql.
// Run:  npm test            (optionally API_URL=http://localhost:5000)
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE = (process.env.API_URL || "http://localhost:5000") + "/api";
let cookie = "";

async function call(method, path, body, useCookie = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(useCookie && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set && set.startsWith("token=") && !set.startsWith("token=;")) cookie = set.split(";")[0];
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}

const email = `test_${Date.now()}@example.com`;
let courseId, taskId, classId;

test("auth: register, login, /me, protected routes", async () => {
  assert.equal((await call("GET", "/tasks", null, false)).status, 401);
  assert.equal((await call("POST", "/auth/register", { name: "T", email, password: "123" })).status, 400);
  assert.equal((await call("POST", "/auth/register", { name: "T", email, password: "secret1" })).status, 201);
  assert.equal((await call("POST", "/auth/register", { name: "T", email, password: "secret1" })).status, 409);
  assert.equal((await call("POST", "/auth/login", { email, password: "wrong!!" })).status, 401);
  assert.equal((await call("POST", "/auth/login", { email, password: "secret1" })).status, 200);
  const me = await call("GET", "/auth/me");
  assert.equal(me.data.user.email, email);
});

test("courses: create, validate, list, edit", async () => {
  assert.equal((await call("POST", "/courses", { code: "", name: "x" })).status, 400);
  assert.equal((await call("POST", "/courses", { code: "CPS714", name: "Software Project", color: "red" })).status, 400);
  const r = await call("POST", "/courses", { code: "cps714", name: "Software Project Mgmt", color: "#2e75b6", shellUrl: "https://courses.example.com/cps714" });
  assert.equal(r.status, 201);
  courseId = r.data.courseId;
  const list = await call("GET", "/courses");
  assert.equal(list.data.courses[0].code, "CPS714");
  assert.equal((await call("PUT", `/courses/${courseId}`, { code: "CPS714", name: "Renamed", color: "#112233" })).status, 200);
  assert.equal((await call("PUT", "/courses/999999", { code: "A", name: "B" })).status, 404);
});

test("tasks: create with validation, list with course info", async () => {
  assert.equal((await call("POST", "/tasks", { title: "  " })).status, 400);
  assert.equal((await call("POST", "/tasks", { title: "x", priority: "Urgent" })).status, 400);
  assert.equal((await call("POST", "/tasks", { title: "x", dueDate: "not-a-date" })).status, 400);
  assert.equal((await call("POST", "/tasks", { title: "x", estimatedHours: -2 })).status, 400);
  assert.equal((await call("POST", "/tasks", { title: "x", courseId: 999999 })).status, 400);

  const r = await call("POST", "/tasks", {
    title: "Assignment 2", description: "Write report", dueDate: "2026-10-30T23:59",
    priority: "High", estimatedHours: 4.5, courseId,
  });
  assert.equal(r.status, 201);
  taskId = r.data.taskId;

  const list = (await call("GET", "/tasks")).data.tasks;
  const t = list.find((x) => x.id === taskId);
  assert.equal(t.priority, "High");
  assert.equal(t.status, "Incomplete");
  assert.equal(t.course_code, "CPS714");
  assert.equal(t.due_date, "2026-10-30 23:59:00");
});

test("tasks: edit, complete, reopen", async () => {
  const e = await call("PUT", `/tasks/${taskId}`, { title: "Assignment 2 (final)", dueDate: "2026-11-01T12:00", priority: "Low", estimatedHours: 6, courseId: null });
  assert.equal(e.status, 200);
  let t = (await call("GET", `/tasks/${taskId}`)).data.task;
  assert.equal(t.title, "Assignment 2 (final)");
  assert.equal(t.priority, "Low");
  assert.equal(t.course_id, null);

  assert.equal((await call("PATCH", `/tasks/${taskId}/status`, { status: "Done" })).status, 400);
  assert.equal((await call("PATCH", `/tasks/${taskId}/status`, { status: "Complete" })).status, 200);
  assert.equal((await call("PATCH", `/tasks/${taskId}/status`, { status: "Complete" })).status, 200); // idempotent
  t = (await call("GET", `/tasks/${taskId}`)).data.task;
  assert.equal(t.status, "Complete");
  assert.equal((await call("PATCH", `/tasks/${taskId}/status`, { status: "Incomplete" })).status, 200);
  assert.equal((await call("PATCH", "/tasks/999999/status", { status: "Complete" })).status, 404);
});

test("subtasks: checking the final item persists parent completion", async () => {
  const created = await call("POST", "/tasks", { title: "Checklist assignment" });
  assert.equal(created.status, 201);
  const taskPath = `/tasks/${created.data.taskId}`;
  const checklistPath = `${taskPath}/checklist`;

  try {
    const itemIds = [];
    for (const title of ["Research", "Outline", "Draft", "Review"]) {
      const added = await call("POST", checklistPath, { title });
      assert.equal(added.status, 201);
      itemIds.push(added.data.itemId);
    }

    const checkItem = (id) => call("PATCH", `${checklistPath}/${id}`, { completed: true });
    const updates = await Promise.all(itemIds.slice(0, 3).map(checkItem));
    updates.forEach((response) => assert.equal(response.status, 200));

    let task = (await call("GET", taskPath)).data.task;
    assert.equal(task.status, "Incomplete");
    assert.equal(Number(task.checklist_total), 4);
    assert.equal(Number(task.checklist_completed), 3);

    assert.equal((await checkItem(itemIds[3])).status, 200);
    const list = (await call("GET", "/tasks")).data.tasks;
    task = list.find((entry) => entry.id === created.data.taskId);
    assert.equal(task.status, "Complete");
    assert.equal(Number(task.checklist_completed), 4);
  } finally {
    await call("DELETE", taskPath);
  }
});

test("tasks: delete one and clear completed", async () => {
  const a = (await call("POST", "/tasks", { title: "A" })).data.taskId;
  const b = (await call("POST", "/tasks", { title: "B" })).data.taskId;
  await call("PATCH", `/tasks/${a}/status`, { status: "Complete" });
  await call("PATCH", `/tasks/${b}/status`, { status: "Complete" });
  const cleared = await call("DELETE", "/tasks/completed");
  assert.equal(cleared.data.deleted, 2);
  assert.equal((await call("GET", `/tasks/${taskId}`)).status, 200); // incomplete task survives
  assert.equal((await call("DELETE", `/tasks/${taskId}`)).status, 200);
  assert.equal((await call("DELETE", `/tasks/${taskId}`)).status, 404);
});

test("schedule: validate, create, list, edit, delete", async () => {
  const good = { title: "CPS714 Lecture", type: "Lecture", dayOfWeek: 2, startTime: "10:00", endTime: "12:00", location: "ENG 101", courseId };
  assert.equal((await call("POST", "/schedule", { ...good, title: "" })).status, 400);
  assert.equal((await call("POST", "/schedule", { ...good, dayOfWeek: 9 })).status, 400);
  assert.equal((await call("POST", "/schedule", { ...good, startTime: "25:00" })).status, 400);
  assert.equal((await call("POST", "/schedule", { ...good, endTime: "09:00" })).status, 400);
  const r = await call("POST", "/schedule", good);
  assert.equal(r.status, 201);
  classId = r.data.classId;
  const c = (await call("GET", "/schedule")).data.classes[0];
  assert.equal(c.start_time, "10:00");
  assert.equal(c.course_code, "CPS714");
  assert.equal((await call("PUT", `/schedule/${classId}`, { ...good, startTime: "11:00", endTime: "13:00" })).status, 200);
  assert.equal((await call("GET", "/schedule")).data.classes[0].start_time, "11:00");
  assert.equal((await call("DELETE", `/schedule/${classId}`)).status, 200);
  assert.equal((await call("DELETE", `/schedule/${classId}`)).status, 404);
});

test("security: another user cannot see or change my data", async () => {
  const t = (await call("POST", "/tasks", { title: "Private" })).data.taskId;
  cookie = "";
  const other = `other_${Date.now()}@example.com`;
  await call("POST", "/auth/register", { name: "O", email: other, password: "secret1" });
  await call("POST", "/auth/login", { email: other, password: "secret1" });
  assert.equal((await call("GET", `/tasks/${t}`)).status, 404);
  assert.equal((await call("DELETE", `/tasks/${t}`)).status, 404);
  assert.equal((await call("PUT", `/tasks/${t}`, { title: "hack" })).status, 404);
  assert.equal((await call("GET", "/tasks")).data.tasks.length, 0);
  assert.equal((await call("POST", "/tasks", { title: "x", courseId })).status, 400); // not their course
});

test("courses: deleting a course keeps its tasks", async () => {
  cookie = "";
  await call("POST", "/auth/login", { email, password: "secret1" });
  const tid = (await call("POST", "/tasks", { title: "Keep me", courseId })).data.taskId;
  assert.equal((await call("DELETE", `/courses/${courseId}`)).status, 200);
  const t = (await call("GET", `/tasks/${tid}`)).data.task;
  assert.equal(t.course_id, null);
});

test("auth: logout clears the session", async () => {
  await call("POST", "/auth/logout");
  assert.equal((await call("GET", "/auth/me", null, false)).status, 401);
});
