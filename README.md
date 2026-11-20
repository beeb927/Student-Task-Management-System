# Student Task Management System

A full-stack student planner built by a three-person team for CPS714. The app uses React (Vite), Node.js, Express, and MySQL.

## What is in this version
**Sprint 1 (core task management)**
- Register, login, logout, JWT cookie sessions
- Create, view, edit, delete tasks (title, description, due date, priority, estimated hours)
- Mark complete / reopen, "Clear completed" in one click
- Dashboard sorted by priority, with a progress bar

**Sprint 2 (schedule and awareness)**
- Courses (code, name, colour, optional course-shell link) and task-to-course assignment (US-14, US-15)
- Weekly class schedule: lectures, labs, tutorials (US-8)
- Calendar with day / week / month views showing classes and task deadlines (US-16, US-17)
- Overdue tasks detected and pinned to the top of the dashboard (US-11)
- Deadline reminders: in-app banner plus optional browser notifications, checked every minute (US-12)

**Sprint 3 (sleep and study tracking)**
- Sleep Log (US-19): enter actual hours and minutes by wake date, edit or delete entries, and view totals for Monday–Sunday weeks.
- Study targets (US-21): Calendar shows credited study time against today's and this week's targets. The target combines credited minutes with the time still planned for that period, so it changes when work moves to another day.
- Session check-ins (US-22): select a Work block and record Complete, Partially Complete, or Missed. A partial check-in credits the minutes entered. The calendar finds new slots for unfinished work and reports time it cannot fit before the deadline. Past sessions stay available for check-in.

**Google sign-in and Google Calendar sync**
- "Continue with Google" on the Login and Register pages (OAuth 2.0 authorization-code flow, handled by the server)
- Signing in with a Gmail address that already has an account links to that account; otherwise a new account is created
- Calendar page can show your Google Calendar events (primary calendar, read-only) next to classes and task deadlines
- Auto-scheduled study blocks avoid your busy Google events
- "Sync now" and "Disconnect" buttons; disconnecting revokes access at Google

**Interface and attachments**
- The shared sidebar works across sections, and the dashboard and calendar adapt to mobile screens.
- Tasks can have one JPEG, PNG or WebP attachment up to 5 MiB. Add it when creating or editing a task. The dashboard displays a thumbnail for saved attachments.

## Run locally

Use Node.js 24 and a running MySQL 8 server on port 3306. Run the commands below from the project root unless a step gives a different directory.

1. Import `database/schema.sql` as a MySQL administrator. It creates all tables for a clean install. In the MySQL terminal, use `SOURCE database/schema.sql` if you opened the client from the project root. Otherwise use the actual path with forward slashes.
2. In the MySQL terminal, create a local application account. Choose your own password, and reuse it in the next step.

   ```sql
   CREATE USER 'task_app'@'localhost' IDENTIFIED BY 'your_local_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON student_task_manager.* TO 'task_app'@'localhost';
   ```

3. In `server`, copy `.env.example` to `.env` using `copy .env.example .env` in Windows Command Prompt or `cp .env.example .env` in macOS/Linux shells.
   Set `DB_USER=task_app`, `DB_PASSWORD` to the password you chose, and `JWT_SECRET` to a random string. Generate a value with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. In the same `server` terminal, run `npm ci`, then `npm start`. Leave it open.
5. In a second terminal, open `client`, run `npm ci`, then `npm run dev`. Open <http://localhost:5173> and register a local account.

### Optional local image storage

Uncomment the five S3 settings in `server/.env` and restart the backend. Run
`npm run s3:local` from `server` in a third terminal and leave it open. The
emulator uses `127.0.0.1:4569` and stores files in `server/.local-s3/`. The sample
credentials are for this local emulator. No AWS account is needed.

### Mobile preview

Use the browser's device toolbar to preview responsive layouts. To try the app on
a phone on the same Wi-Fi, start the backend as above and run
`npm run dev -- --mode mobile --host 0.0.0.0` in `client` in place of the normal
Vite command. Open the displayed Network URL on the phone and use email/password
login. The mobile Vite mode proxies API requests to the local backend.

### Updating an older database

Use the applicable migrations in `database/` in version order. Apply the Google
migration before Sprint 3 if your database lacks Google support, and apply
`migration_task_images.sql` if it lacks the image table.

## Google setup
You need your own Google OAuth keys (free). The app works without them; the Google buttons just show a "not set up" message.
1. Go to https://console.cloud.google.com, create a project, then **APIs & Services > Library > Google Calendar API > Enable**.
2. **APIs & Services > OAuth consent screen**: choose *External*, fill in the app name and your email. Under *Audience*, keep it in **Testing** and add every Gmail address that will sign in under **Test users**.
3. Under *Data Access* (or *Scopes*), add `.../auth/calendar.events.readonly` (plus the default `openid`, `email`, `profile`).
4. **APIs & Services > Credentials > Create credentials > OAuth client ID**, type **Web application**.
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5000/api/google/callback` (must match `GOOGLE_REDIRECT_URI` exactly)
5. Uncomment the Google settings in `server/.env` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Set `TOKEN_ENCRYPTION_KEY` to 32+ random characters (`openssl rand -hex 32`). It encrypts the Google refresh tokens stored in the database. Changing it later means users must reconnect their calendar.
6. Restart the server. Google will warn "Google hasn't verified this app" while it is in Testing: click *Advanced > Continue* (expected for test users).

If the client runs somewhere other than `http://localhost:5000/api`, set `VITE_API_URL` for the client.

## Tests

- From `client`, run `node --test tests/*.test.js` for the scheduler and UI utility tests, and `npm run lint` and `npm run build` to check the frontend.
- From `server`, run `node --test tests/*.test.js` with the backend and S3 emulator running against a disposable test database. The tests create accounts and records.

## Known limits
- The study plan updates while Calendar is open. When no eligible slot remains before the deadline, Calendar lists the unscheduled time.
- Reminders only fire while the app is open in a browser tab (no push when closed).
- Overdue/"due soon" use the browser's local time; due dates are stored without a timezone.
- Google Calendar sync is one-way (Google -> this app) and read-only; it reads your primary calendar only.
- While the Google app is in *Testing* mode, Google expires refresh tokens after 7 days, so you may need to click "Connect Google Calendar" again. Sensitive scopes need Google's verification before anyone outside the test-user list can use it.
- All-day Google events and events marked "free" are shown but do not block study time.
- Class schedule is weekly-recurring only (no one-off events or term start/end dates).
