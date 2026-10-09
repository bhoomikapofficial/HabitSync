# HabitSync

Personal Habit, Productivity & Digital Wellbeing Tracker — a full-stack
web application built exactly to the project's PRD and technology stack.

> Register → track habits, water, sleep, expenses and reminders → see
> everything summarized on one dashboard → understand your patterns
> through Chart.js analytics and simple rule-based insights.

## Tech stack (per `TECH_STACK.md`)

| Layer            | Technology                     |
|-------------------|---------------------------------|
| Frontend          | HTML5, CSS3, vanilla JavaScript |
| Backend            | Node.js, Express.js            |
| Database           | MongoDB Atlas                  |
| ODM                | Mongoose                       |
| Authentication      | JWT + bcrypt                   |
| Charts             | Chart.js                       |
| Notifications       | Browser Notifications API      |

No frontend framework is used — the client is plain HTML/CSS/JS served
directly by the Express server, exactly as specified.

## Project structure

```
habitsync/
├── backend/
│   ├── server.js                 Express app entry point
│   ├── config/db.js              MongoDB connection
│   ├── models/                   Mongoose schemas (User, Habit, HabitLog,
│   │                              WaterLog, SleepLog, Expense, Reminder, Todo)
│   ├── middleware/                JWT auth guard + centralized error handler
│   ├── controllers/               Business logic per module
│   ├── routes/                    REST endpoint definitions
│   ├── utils/                     Date helpers, async wrapper, insights engine
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html                 Login / register
    ├── dashboard.html             Today's progress across all modules
    ├── habits.html, water.html, sleep.html, expenses.html, reminders.html
    ├── analytics.html             Chart.js visualizations + insights
    ├── css/style.css
    └── js/                        api.js, ui.js, notifications.js, and one
                                    script per page
```

## Getting started

### 1. Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (or a local MongoDB instance) and its connection string

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:

- `MONGO_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — any long random string
- `CLIENT_ORIGIN` — origins allowed to call the API (defaults are fine for local dev)

Start the server:

```bash
npm run dev     # with nodemon, auto-restarts on changes
# or
npm start
```

The server listens on `http://localhost:5000` by default and **also
serves the frontend** as static files, so you can simply open:

```
http://localhost:5000
```

in your browser and the whole app — frontend and API — runs from that
one process. No separate frontend server or build step is needed.

### 3. Create an account and explore

1. Open `http://localhost:5000`
2. Create an account (Register tab)
3. You'll land on the Dashboard — from there, use the sidebar to reach
   Habits, Water, Sleep, Expenses, Reminders, and Analytics
4. Click "Enable notifications" on the dashboard to allow browser
   notifications for upcoming reminders and goal/budget warnings

## API overview

All endpoints are prefixed with `/api` and (except `/auth/register` and
`/auth/login`) require an `Authorization: Bearer <token>` header.

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/me

GET    /api/habits
POST   /api/habits
PUT    /api/habits/:id
DELETE /api/habits/:id
POST   /api/habits/:id/complete
GET    /api/habits/:id/history

GET    /api/todos                    ?status=pending|completed|overdue
POST   /api/todos
GET    /api/todos/:id
PUT    /api/todos/:id
DELETE /api/todos/:id
POST   /api/todos/:id/complete

GET    /api/water
POST   /api/water
DELETE /api/water/:id
GET    /api/water/history
PUT    /api/water/goal

POST   /api/sleep                    { sleepType: 'night' | 'daytime', ... }
PUT    /api/sleep/:id
DELETE /api/sleep/:id
GET    /api/sleep/today
GET    /api/sleep/history

GET    /api/expenses
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id
GET    /api/expenses/summary
PUT    /api/expenses/budget

GET    /api/reminders                ?status=pending|completed|dismissed
GET    /api/reminders/upcoming
POST   /api/reminders
PUT    /api/reminders/:id
DELETE /api/reminders/:id

GET    /api/dashboard

GET    /api/analytics/habits
GET    /api/analytics/water
GET    /api/analytics/sleep
GET    /api/analytics/expenses
GET    /api/analytics/insights
GET    /api/analytics/history         ?days=14
```

## Security notes (per PRD section 23)

- Passwords are hashed with bcrypt (10 salt rounds) and never stored or
  returned in plain text.
- All non-auth routes require a valid JWT; requests are scoped to
  `req.userId` so users can only ever read or modify their own data,
  including the new Todo model and the 14-day analytics history.
- Input is validated both by `express-validator` (auth routes) and by
  Mongoose schema validation (all other routes).
- Centralized error handling returns consistent, meaningful messages
  without leaking stack traces in production.

## Version 2.0 enhancements

Built additively on top of Version 1 per the PRD's "Upcoming
Requirements / Version 2.0 Enhancement" section. Nothing below removed
or rewrote unrelated V1 functionality.

- **Dashboard** — added a Todos summary card and a 7-day water trend
  chart; every dashboard section now fetches independently
  (`Promise.allSettled`) so one failing section never blanks the rest
  of the page, and chart failures fall back to a plain-text message
  instead of a blank canvas.
- **Habits — Todo List** (new `Todo` model, `/api/todos`) — a fully
  independent todo list next to habits: title, description, deadline
  date/time, completion, and per-todo reminder toggle. Reminders follow
  the PRD schedule (~2 days out, then ~5-6 hours out, then hourly in
  the final hour) and stop automatically once a todo is completed.
- **Water** — fixed the chart (days with no logged intake used to be
  dropped from the chart instead of showing 0 — the backend now
  zero-fills every day in range). Added a configurable evening
  "remaining water" reminder (`remaining = goal - today's intake`,
  default 9 PM, can be disabled).
- **Sleep** — added daytime/afternoon sleep (`sleepType: 'night' |
  'daytime'`) alongside the existing night-sleep flow. A sleep-day
  grouping rule (a record belongs to the calendar day its *sleepTime*
  falls on) combines same-day naps with the night sleep that follows
  them, matching the PRD's worked example exactly (`2h nap + 6h30m
  night sleep = 8h30m combined`). The Sleep page now shows Night Sleep,
  Daytime Sleep, a Combined Summary, a Last-7-Days table, and History,
  with edit/delete on both record types.
- **Expenses** — fixed a real bug where the category chart's "no data"
  state replaced the `<canvas>` element itself via `innerHTML`,
  permanently breaking that chart for the rest of the session; it now
  toggles a sibling empty-state element instead. The 30-day daily chart
  is now zero-filled the same way as water. Added budget difference /
  remaining amount (`budget - current-month expense`) with an
  overspending indicator.
- **Reminders** — added real recurrence: daily, weekly (with selected
  days of week), custom one-off dates, and an optional end date. Past-due
  recurring reminders are automatically rolled forward to their next
  occurrence whenever fetched (no scheduler/cron needed, since this
  stack doesn't include one) and stop once past their end date.
  Notifications can be disabled per reminder.
- **Analytics** — fixed the same canvas-destruction bug in the expense
  breakdown chart; all four charts (habits, water, sleep, expenses) are
  zero-filled and wrapped so a Chart.js failure shows a friendly message
  instead of a blank area. Added `GET /api/analytics/history?days=14`:
  a day-by-day breakdown of sleep (incl. daytime sleep), water, expenses
  (plus week-wise totals), habits, and todos — scoped strictly to the
  authenticated user.

## What's implemented vs. future scope

This build covers the full **MVP — Version 1** scope from the PRD
(section 6) plus the **Version 2.0 Enhancement** scope described above:
authentication, dashboard, habit/todo/water/sleep/expense/reminder
tracking, analytics (including 14-day history), rule-based personalized
insights, and browser notifications.

**Digital Wellbeing and the Android companion app (PRD sections 7, 18,
21 "Future Mobile Technology") are intentionally out of scope** for
this build, as the PRD defines them as future phases (Phase 7–8) that
depend on native mobile app-usage APIs unavailable to a web app. The
`AppLimit` database entity described as "Future" in the PRD's data
model was likewise not implemented, for the same reason. The backend's
modular route/controller structure (one file per domain) is intended
to make adding that module later straightforward without touching
existing code, per the PRD's scalability requirement.

## Development phases mapping

This build completes PRD Phases 1–6 (Foundation, Authentication, Core
Modules, Dashboard, Analytics, Notifications) plus the Version 2.0
Enhancement scope. Phases 7–8 (Digital Wellbeing, Android integration)
are future work as noted above.
