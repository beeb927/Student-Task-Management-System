const { OAuth2Client } = require("google-auth-library");

// Least privilege: we only READ events. "openid email profile" is the sign-in part.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const SCOPES = ["openid", "email", "profile", CALENDAR_SCOPE];

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI
  );
}

function createClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// forceConsent: make Google show the consent screen again so it re-issues a refresh token
// (needed when connecting the calendar; plain sign-ins skip it so they stay one click).
function buildAuthUrl(state, { forceConsent }) {
  return createClient().generateAuthUrl({
    access_type: "offline", // gives us a refresh token so we can sync later
    scope: SCOPES,
    state,
    prompt: forceConsent ? "consent select_account" : "select_account",
  });
}

async function exchangeCode(code) {
  const client = createClient();
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  return {
    profile: { sub: p.sub, email: String(p.email || "").toLowerCase(), emailVerified: p.email_verified, name: p.name },
    refreshToken: tokens.refresh_token || null,
    calendarGranted: String(tokens.scope || "").split(" ").includes(CALENDAR_SCOPE),
  };
}

async function getAccessToken(refreshToken) {
  const client = createClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  return token;
}

// Revoking is best effort: the user is disconnecting either way.
async function revoke(refreshToken) {
  try {
    await createClient().revokeToken(refreshToken);
  } catch {
    /* already revoked / network issue */
  }
}

// Google event -> the small shape the React calendar uses.
// All-day events carry { date } (end is exclusive); timed events carry { dateTime } with an offset.
function normalizeEvent(e) {
  if (!e || e.status === "cancelled" || e.eventType === "workingLocation") return null;
  const me = (e.attendees || []).find((a) => a.self);
  if (me && me.responseStatus === "declined") return null;

  const allDay = Boolean(e.start && e.start.date && !e.start.dateTime);
  const start = allDay ? e.start.date : e.start && e.start.dateTime;
  const end = allDay ? e.end && e.end.date : e.end && e.end.dateTime;
  if (!start || !end) return null;

  return {
    id: e.id,
    title: e.summary || "(No title)",
    start,
    end,
    allDay,
    location: e.location || null,
    link: e.htmlLink || null,
    busy: e.transparency !== "transparent", // "free" events should not block study time
  };
}

async function listEvents(accessToken, timeMin, timeMax) {
  const events = [];
  let pageToken;
  for (let page = 0; page < 4; page++) {
    const params = new URLSearchParams({
      singleEvents: "true", // expand recurring events into individual occurrences
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const err = new Error(`Google Calendar API error (${res.status})`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    for (const item of data.items || []) {
      const n = normalizeEvent(item);
      if (n) events.push(n);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return events;
}

module.exports = {
  CALENDAR_SCOPE, isConfigured, buildAuthUrl, exchangeCode, getAccessToken, revoke,
  normalizeEvent, listEvents,
};
