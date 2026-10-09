const { addDays, addMonths } = require('./dateHelpers');

/**
 * Combines a reminder's date (Y/M/D) with its "HH:MM" time string into a
 * single Date, using UTC accessors to stay consistent with the rest of
 * the app's UTC-normalized date handling (see dateHelpers.js).
 */
const combineDateTime = (date, time) => {
  const d = new Date(date);
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    d.setUTCHours(hh, mm, 0, 0);
  }
  return d;
};

/**
 * Returns the next weekday (as a Date) strictly after `currentDate` whose
 * UTC day-of-week (0=Sun..6=Sat) is in `repeatDays`, or null if
 * repeatDays is empty.
 */
const nextWeekdayMatch = (currentDate, repeatDays) => {
  if (!repeatDays || repeatDays.length === 0) return null;
  const sorted = [...new Set(repeatDays)];
  const cur = new Date(currentDate);
  const curDow = cur.getUTCDay();
  for (let offset = 1; offset <= 7; offset += 1) {
    const dow = (curDow + offset) % 7;
    if (sorted.includes(dow)) {
      const next = new Date(cur);
      next.setUTCDate(next.getUTCDate() + offset);
      return next;
    }
  }
  return null;
};

/**
 * Computes this reminder's next occurrence date given its current
 * `date` and repeat configuration. Returns null when there is no further
 * occurrence (e.g. a 'custom' reminder with no remaining future dates).
 */
const nextOccurrenceAfter = (reminder) => {
  const { repeatType, date, repeatDays, customDates } = reminder;

  if (repeatType === 'daily') {
    return addDays(date, 1);
  }

  if (repeatType === 'weekly') {
    if (repeatDays && repeatDays.length > 0) {
      return nextWeekdayMatch(date, repeatDays);
    }
    return addDays(date, 7);
  }

  if (repeatType === 'monthly') {
    return addMonths(date, 1);
  }

  if (repeatType === 'custom') {
    const currentTime = new Date(date).getTime();
    const upcoming = (customDates || [])
      .map((d) => new Date(d))
      .filter((d) => d.getTime() > currentTime)
      .sort((a, b) => a.getTime() - b.getTime());
    return upcoming[0] || null;
  }

  return null;
};

/**
 * Rolls a pending, recurring reminder forward past any occurrences whose
 * date+time have already passed, so a "Daily" (or weekly/monthly/custom)
 * reminder keeps automatically re-scheduling itself every time it's
 * fetched - without requiring a background job/scheduler, which this
 * stack does not include. Stops (setting status to 'completed') once
 * there is no further occurrence, or once the next occurrence would fall
 * after the reminder's optional endDate.
 *
 * Mutates `reminder` in place and returns true if anything changed (so
 * the caller knows to persist it).
 */
const advanceReminderIfDue = (reminder, now = new Date()) => {
  if (reminder.status !== 'pending') return false;
  if (reminder.repeatType === 'none') return false;

  let changed = false;
  let guard = 0;
  const MAX_ITERATIONS = 3660; // ~10 years of daily occurrences - a safe upper bound

  while (combineDateTime(reminder.date, reminder.time).getTime() < now.getTime() && guard < MAX_ITERATIONS) {
    guard += 1;
    const next = nextOccurrenceAfter(reminder);

    if (!next) {
      reminder.status = 'completed';
      changed = true;
      break;
    }

    if (reminder.endDate && next.getTime() > new Date(reminder.endDate).getTime()) {
      reminder.status = 'completed';
      changed = true;
      break;
    }

    reminder.lastTriggeredAt = combineDateTime(reminder.date, reminder.time);
    reminder.date = next;
    changed = true;
  }

  if (changed && reminder.status === 'pending') {
    reminder.nextTriggerAt = combineDateTime(reminder.date, reminder.time);
  }

  return changed;
};

module.exports = { combineDateTime, nextWeekdayMatch, nextOccurrenceAfter, advanceReminderIfDue };
