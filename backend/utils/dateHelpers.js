/**
 * Returns a Date normalized to midnight UTC for the given input date
 * (or today, if none is given). Used to key daily records (HabitLog,
 * SleepLog "date" field) consistently regardless of time-of-day.
 */
const startOfDay = (input) => {
  const d = input ? new Date(input) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Returns start/end Date bounds for "today".
 */
const todayRange = () => {
  const start = startOfDay();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

/**
 * Returns start/end Date bounds for the last N days (inclusive of today).
 */
const lastNDaysRange = (n = 7) => {
  const end = new Date(startOfDay());
  end.setUTCDate(end.getUTCDate() + 1); // exclusive end = start of tomorrow
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - n);
  return { start, end };
};

/**
 * Returns start/end Date bounds for the current calendar month.
 */
const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
};

/**
 * Formats a duration given in minutes as "Xh Ym".
 */
const formatMinutes = (totalMinutes) => {
  const mins = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

/**
 * Returns a "YYYY-MM-DD" key (UTC) for a given date. Used to bucket
 * records by calendar day consistently across controllers.
 */
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Returns an array of "YYYY-MM-DD" keys for the last N days, oldest
 * first, ending with today. e.g. lastNDaysKeys(3) on Sep 25 returns
 * ["2026-09-23", "2026-09-24", "2026-09-25"].
 */
const lastNDaysKeys = (n = 7) => {
  const keys = [];
  const start = startOfDay();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
};

/**
 * Given a map of { "YYYY-MM-DD": number } and an ordered list of day
 * keys, returns an array of { date, total } covering every key in the
 * range, defaulting missing days to 0. This is what lets charts show a
 * continuous history (including zero-activity days) instead of only the
 * days that happen to have a record.
 */
const zeroFillByKey = (map, keys) => keys.map((k) => ({ date: k, total: (map && map[k]) || 0 }));

/**
 * Adds N days to a date and returns a new Date (UTC-safe).
 */
const addDays = (input, n) => {
  const d = new Date(input);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

/**
 * Adds N months to a date, clamping the day-of-month if the target
 * month is shorter (e.g. Jan 31 + 1 month -> Feb 28/29).
 */
const addMonths = (input, n) => {
  const d = new Date(input);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const daysInTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
  return d;
};

module.exports = {
  startOfDay,
  todayRange,
  lastNDaysRange,
  currentMonthRange,
  formatMinutes,
  dayKey,
  lastNDaysKeys,
  zeroFillByKey,
  addDays,
  addMonths,
};
