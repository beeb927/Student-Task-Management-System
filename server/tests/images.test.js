// Run with the task image migration, local S3, and API active.
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");

const base = (process.env.API_URL || "http://localhost:5000") + "/api";
const json = (body) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function account() {
  const credentials = { email: `${randomUUID()}@example.com`, password: "test-password" };
  const registered = await fetch(base + "/auth/register", { method: "POST", ...json({ name: "Image test", ...credentials }) });
  assert.equal(registered.status, 201);
  const loggedIn = await fetch(base + "/auth/login", { method: "POST", ...json(credentials) });
  assert.equal(loggedIn.status, 200);
  const cookie = loggedIn.headers.get("set-cookie").split(";")[0];
  return (path, options) => fetch(base + path, {
    ...options, headers: { ...options?.headers, Cookie: cookie },
  });
}

test("private attachment upload, validation, replacement and removal", async () => {
  const owner = await account();
  const other = await account();
  const task = await owner("/tasks", { method: "POST", ...json({ title: "Image test" }) });
  assert.equal(task.status, 201);
  const { taskId } = await task.json();
  const path = `/tasks/${taskId}/image`;
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
  const upload = (body) => ({ method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body });

  try {
    assert.equal((await fetch(base + path)).status, 401);
    assert.deepEqual(await (await owner(path)).json(), { enabled: true, image: null });
    assert.equal((await other(path, upload(image))).status, 404);
    assert.equal((await owner(path, upload(Buffer.from("not an image")))).status, 415);
    assert.equal((await owner(path, upload(Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 413);
    const first = await owner(path + "?filename=test.png", upload(image));
    assert.equal(first.status, 200);
    const data = (await first.json()).image;
    const content = path + "/content/" + data.id;
    assert.equal(data.filename, "test.png");
    assert.deepEqual(await (await owner(path)).json(), { enabled: true, image: data });
    assert.equal((await other(path)).status, 404);
    assert.equal((await other(content)).status, 404);
    assert.equal((await other(path, { method: "DELETE" })).status, 404);
    const saved = await owner(content);
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get("content-type"), "image/png");
    assert.equal((await sharp(Buffer.from(await saved.arrayBuffer())).metadata()).width, 10);
    const replacement = await owner(path + "?filename=new.png", upload(image));
    assert.equal(replacement.status, 200);
    assert.notEqual((await replacement.json()).image.id, data.id);
    assert.equal((await owner(content)).status, 404);
    assert.equal((await owner(path, { method: "DELETE" })).status, 204);
    assert.equal((await (await owner(path)).json()).image, null);
    assert.equal((await owner(path, upload(image))).status, 200);
    assert.equal((await owner(`/tasks/${taskId}`, { method: "DELETE" })).status, 200);
    assert.equal((await owner(path)).status, 404);
  } finally {
    await owner(`/tasks/${taskId}`, { method: "DELETE" });
  }
});
