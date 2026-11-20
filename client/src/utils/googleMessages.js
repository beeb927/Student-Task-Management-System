// Turns the ?google_error=<code> the server redirects back with into text for the user.
const MESSAGES = {
  cancelled: "Google sign-in was cancelled.",
  not_configured: "Google sign-in is not set up on the server yet (missing Google keys in server/.env).",
  invalid_state: "The Google sign-in session expired. Please try again.",
  email_not_verified: "Your Google account's email is not verified, so it can't be used here.",
  google_in_use: "That Google account is already linked to a different user.",
  calendar_not_granted: "Calendar access was not granted. Tick the calendar permission on Google's screen to sync.",
  google_error: "Something went wrong talking to Google. Please try again.",
};

export function googleErrorMessage(code) {
  if (!code) return "";
  return MESSAGES[code] || MESSAGES.google_error;
}
