const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const google = require("../utils/googleService");
const { encrypt, decrypt } = require("../utils/crypto");
const { startSession } = require("../utils/session");
const { findUserByEmail, createUser } = require("../models/userModel");
const googleAccounts = require("../models/googleAccountModel");

const STATE_COOKIE = "g_oauth";
const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // must be lax (not strict): Google sends the browser back with a top-level GET
  maxAge: 10 * 60 * 1000,
};

// Where to send the browser when something goes wrong or finishes.
function failRedirect(res, mode, reason) {
  const page = mode === "connect" ? "calendar" : "login";
  return res.redirect(`${process.env.CLIENT_URL}/${page}?google_error=${encodeURIComponent(reason)}`);
}

// Start the OAuth flow. The random `state` is also stored in a signed cookie, so on the way
// back we can prove this browser started the flow (protects against CSRF / forged callbacks).
function beginFlow(mode) {
  return (req, res) => {
    if (!google.isConfigured()) return failRedirect(res, mode, "not_configured");

    const nonce = crypto.randomBytes(24).toString("hex");
    const signed = jwt.sign({ nonce, mode, uid: mode === "connect" ? req.user.id : null }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });
    res.cookie(STATE_COOKIE, signed, stateCookieOptions);
    res.redirect(google.buildAuthUrl(nonce, { forceConsent: mode === "connect" }));
  };
}

// GET /api/google/login    (public: "Continue with Google")
const login = beginFlow("login");
// GET /api/google/connect  (logged in: link Google Calendar to the current account)
const connect = beginFlow("connect");

// GET /api/google/callback  (Google sends the browser back here)
async function callback(req, res) {
  let flow;
  try {
    flow = jwt.verify(req.cookies[STATE_COOKIE] || "", process.env.JWT_SECRET);
  } catch {
    return failRedirect(res, "login", "invalid_state");
  }
  res.clearCookie(STATE_COOKIE, { ...stateCookieOptions, maxAge: undefined });
  const mode = flow.mode;

  try {
    if (req.query.error) {
      return failRedirect(res, mode, req.query.error === "access_denied" ? "cancelled" : "google_error");
    }
    if (!req.query.code || req.query.state !== flow.nonce) {
      return failRedirect(res, mode, "invalid_state");
    }

    const { profile, refreshToken, calendarGranted } = await google.exchangeCode(req.query.code);
    if (!profile.email || !profile.emailVerified) {
      return failRedirect(res, mode, "email_not_verified");
    }

    let userId;
    const link = await googleAccounts.findByGoogleSub(profile.sub);

    if (mode === "connect") {
      userId = flow.uid;
      if (link && link.user_id !== userId) return failRedirect(res, mode, "google_in_use");
      if (!calendarGranted) return failRedirect(res, mode, "calendar_not_granted");
    } else if (link) {
      userId = link.user_id; // returning Google user
    } else {
      // First Google sign-in: attach to the account with the same (Google-verified) email,
      // or create a new account without a password.
      const existing = await findUserByEmail(profile.email);
      userId = existing ? existing.id : await createUser(profile.name || profile.email.split("@")[0], profile.email, null);
    }

    await googleAccounts.upsert(userId, {
      sub: profile.sub,
      email: profile.email,
      // undefined = keep the stored token (Google only sends one on first consent)
      refreshTokenEnc: refreshToken && calendarGranted ? encrypt(refreshToken) : undefined,
      calendarConnected: calendarGranted,
    });

    if (mode === "login") startSession(res, userId);
    return res.redirect(`${process.env.CLIENT_URL}/${mode === "connect" ? "calendar?google=connected" : "dashboard"}`);
  } catch (error) {
    console.error("Google callback error:", error.message);
    return failRedirect(res, mode, "google_error");
  }
}

// GET /api/google/status
async function status(req, res) {
  try {
    const acc = await googleAccounts.findByUserId(req.user.id);
    res.json({
      configured: google.isConfigured(),
      linked: Boolean(acc),
      connected: Boolean(acc && acc.calendar_connected && acc.refresh_token_enc),
      email: acc ? acc.google_email : null,
    });
  } catch (error) {
    console.error("Google status error:", error);
    res.status(500).json({ message: "Server error while checking Google status." });
  }
}

// GET /api/google/events?timeMin=<ISO>&timeMax=<ISO>
async function events(req, res) {
  try {
    const min = new Date(req.query.timeMin);
    const max = new Date(req.query.timeMax);
    if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime()) || max <= min) {
      return res.status(400).json({ message: "timeMin and timeMax must be valid ISO dates (min before max)." });
    }
    if (max - min > 100 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: "Date range is too large (max 100 days)." });
    }

    const acc = await googleAccounts.findByUserId(req.user.id);
    if (!acc || !acc.calendar_connected || !acc.refresh_token_enc) {
      return res.status(409).json({ code: "not_connected", message: "Google Calendar is not connected." });
    }

    let accessToken;
    try {
      accessToken = await google.getAccessToken(decrypt(acc.refresh_token_enc));
    } catch (error) {
      // Refresh token revoked/expired (e.g. user removed access in their Google account)
      await googleAccounts.clearCalendar(req.user.id);
      return res.status(401).json({ code: "reauth", message: "Google access expired. Please reconnect." });
    }

    const list = await google.listEvents(accessToken, min.toISOString(), max.toISOString());
    res.json({ events: list });
  } catch (error) {
    console.error("Google events error:", error.message);
    res.status(502).json({ message: "Could not load events from Google Calendar." });
  }
}

// POST /api/google/disconnect  (stops syncing; Google sign-in keeps working)
async function disconnect(req, res) {
  try {
    const acc = await googleAccounts.findByUserId(req.user.id);
    if (acc && acc.refresh_token_enc) {
      try { await google.revoke(decrypt(acc.refresh_token_enc)); } catch { /* key changed / corrupt: just clear it */ }
    }
    await googleAccounts.clearCalendar(req.user.id);
    res.json({ message: "Google Calendar disconnected." });
  } catch (error) {
    console.error("Google disconnect error:", error);
    res.status(500).json({ message: "Server error while disconnecting." });
  }
}

module.exports = { login, connect, callback, status, events, disconnect };
