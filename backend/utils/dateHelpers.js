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

module.exports = { startOfDay, todayRange, lastNDaysRange, currentMonthRange, formatMinutes };
