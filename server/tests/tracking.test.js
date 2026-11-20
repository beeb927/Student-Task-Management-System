// Requires a running API with the Sprint 3 migration applied.
const test = require("node:test");
const assert = require("node:assert/strict");
const base = (process.env.API_URL || "http://localhost:5000") + "/api";

function client() {
  let cookie;
  return async (method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    return { status: response.status, data: await response.json().catch(() => null) };
  };
}

test("sleep logs are dated, editable and private; check-ins persist and reject stale plans", async () => {
  const a = client();
  const b = client();
  const prefix = Date.now();
  assert.equal((await a("GET", "/study-sessions")).status, 401);
  assert.equal((await a("GET", "/sleep?from=2030-01-07&to=2030-01-14")).status, 401);
  for (const [name, call] of [["A", a], ["B", b]]) {
    const credentials = { email: `tracking-${name}-${prefix}@example.com`, password: "test-password" };
    assert.equal((await call("POST", "/auth/register", { name, ...credentials })).status, 201);
    assert.equal((await call("POST", "/auth/login", credentials)).status, 200);
  }

  const range = "/sleep?from=2030-01-07&to=2030-01-14";
  assert.equal((await a("PUT", "/sleep/2030-02-30", { minutes: 480 })).status, 400);
  assert.equal((await a("PUT", "/sleep/2030-01-07", { minutes: 0 })).status, 400);
  for (const [date, minutes] of [["06", 480], ["07", 450], ["07", 475], ["13", 430], ["14", 440]]) {
    assert.equal((await a("PUT", `/sleep/2030-01-${date}`, { minutes })).status, 200);
  }
  assert.deepEqual((await b("GET", range)).data.logs, []);
  assert.equal((await b("DELETE", "/sleep/2030-01-07")).status, 204);
  assert.deepEqual((await a("GET", range)).data.logs, [
    { sleep_date: "2030-01-07", minutes_slept: 475 }, { sleep_date: "2030-01-13", minutes_slept: 430 },
  ]);
  assert.equal((await a("DELETE", "/sleep/2030-01-13")).status, 204);
  assert.equal((await a("GET", range)).data.logs.length, 1);

  const task = await a("POST", "/tasks", { title: "Tracking test", dueDate: "2030-01-10T21:00", estimatedHours: 3 });
  assert.equal(task.status, 201);
  const block = { task_id: task.data.taskId, session_date: "2030-01-07", start_time: "18:00", end_time: "19:00" };
  const initial = (await a("GET", "/study-sessions")).data;
  const other = (await b("GET", "/study-sessions")).data;
  const payload = { revision: initial.revision, cutoff: "2030-01-07 08:00", blocks: [
    block, { ...block, session_date: "2030-01-08" }, { ...block, session_date: "2030-01-09" },
  ] };
  assert.equal((await b("PUT", "/study-sessions/plan", { ...payload, revision: other.revision })).status, 409);
  const saved = await a("PUT", "/study-sessions/plan", payload);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.sessions.length, 3);
  assert.equal((await a("PUT", "/study-sessions/plan", payload)).status, 409);

  const [partial, missed, complete] = saved.data.sessions;
  const url = (session) => `/study-sessions/${session.id}`;
  assert.equal((await b("PATCH", url(partial), { status: "Complete" })).status, 404);
  assert.equal((await a("PATCH", url(partial), { status: "Partially Complete", minutes: 60 })).status, 400);
  assert.equal((await a("PATCH", url(partial), { status: "Partially Complete", minutes: 25 })).status, 200);
  assert.equal((await a("PATCH", url(missed), { status: "Missed" })).status, 200);
  assert.equal((await a("PATCH", url(complete), { status: "Complete" })).status, 200);
  assert.equal((await a("PATCH", url(complete), { status: "Complete" })).status, 200);
  assert.equal((await a("PATCH", url(complete), { status: "Missed" })).status, 409);
  const current = (await a("GET", "/study-sessions")).data;
  assert.deepEqual(current.sessions.map((session) => session.completed_minutes), [25, 0, 60]);

  const replanned = await a("PUT", "/study-sessions/plan", {
    ...payload, revision: current.revision, blocks: [
      { ...block, session_date: "2030-01-10" },
      { ...block, session_date: "2030-01-10", start_time: "19:00", end_time: "19:35" },
    ],
  });
  assert.equal(replanned.status, 200);
  assert.equal(replanned.data.sessions.length, 5);
  assert.equal((await a("DELETE", `/tasks/${task.data.taskId}`)).status, 200);
  assert.deepEqual((await a("GET", "/study-sessions")).data.sessions, []);
});
