// Unit tests for the Google helpers (no server, database or Google account needed).
// Run: npm run test:unit
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.TOKEN_ENCRYPTION_KEY = "unit-test-key-unit-test-key-unit-test";
const { encrypt, decrypt } = require("../utils/crypto");
const { normalizeEvent } = require("../utils/googleService");

test("crypto: round trip, random IV, tamper detection", () => {
  const token = "1//0gExampleRefreshToken";
  const a = encrypt(token);
  const b = encrypt(token);
  assert.notEqual(a, b); // fresh IV each time
  assert.equal(decrypt(a), token);
  assert.ok(!a.includes(token));

  const [iv, tag, data] = a.split(".");
  const flipped = Buffer.from(data, "base64");
  flipped[0] ^= 1;
  assert.throws(() => decrypt([iv, tag, flipped.toString("base64")].join(".")));
});

test("crypto: refuses to run without a usable key", () => {
  const saved = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = "short";
  assert.throws(() => encrypt("x"), /TOKEN_ENCRYPTION_KEY/);
  process.env.TOKEN_ENCRYPTION_KEY = saved;
});

test("normalizeEvent: timed, all-day, free, cancelled, declined", () => {
  const timed = normalizeEvent({
    id: "1", summary: "Study group", location: "Library", htmlLink: "https://calendar.google.com/x",
    start: { dateTime: "2026-10-22T10:00:00-04:00" }, end: { dateTime: "2026-10-22T11:00:00-04:00" },
  });
  assert.deepEqual(timed, {
    id: "1", title: "Study group", start: "2026-10-22T10:00:00-04:00", end: "2026-10-22T11:00:00-04:00",
    allDay: false, location: "Library", link: "https://calendar.google.com/x", busy: true,
  });

  const allDay = normalizeEvent({ id: "2", start: { date: "2026-10-22" }, end: { date: "2026-10-23" }, transparency: "transparent" });
  assert.equal(allDay.allDay, true);
  assert.equal(allDay.title, "(No title)");
  assert.equal(allDay.busy, false);

  assert.equal(normalizeEvent({ id: "3", status: "cancelled", start: { date: "2026-10-22" }, end: { date: "2026-10-23" } }), null);
  assert.equal(normalizeEvent({ id: "4", eventType: "workingLocation", start: { date: "2026-10-22" }, end: { date: "2026-10-23" } }), null);
  assert.equal(
    normalizeEvent({ id: "5", attendees: [{ self: true, responseStatus: "declined" }], start: { date: "2026-10-22" }, end: { date: "2026-10-23" } }),
    null
  );
  assert.equal(normalizeEvent({ id: "6" }), null); // malformed
});
