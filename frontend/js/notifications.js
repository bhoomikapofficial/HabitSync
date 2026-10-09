/**
 * Wraps the browser Notification API (per PRD section 17 - "Browser
 * notifications will be considered for the initial web application").
 * Falls back to an in-app toast whenever the Notification API is
 * unsupported or the user has not granted permission.
 */
const NotificationsHelper = (() => {
  function isSupported() {
    return 'Notification' in window;
  }

  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    return Notification.permission;
  }

  function notify(title, body) {
    if (isSupported() && Notification.permission === 'granted') {
      try {
        // eslint-disable-next-line no-new
        new Notification(title, { body, icon: undefined });
        return;
      } catch {
        // fall through to toast
      }
    }
    UI.toast(`${title}: ${body}`, 'warning', 6000);
  }

  /**
   * Checks upcoming reminders (already scoped to today+ by the API) and
   * fires a browser notification for any that are due within the next
   * `windowMinutes` minutes and haven't been notified yet this session.
   */
  const notifiedIds = new Set();

  function checkReminders(reminders, windowMinutes = 15) {
    const now = new Date();

    reminders.forEach((reminder) => {
      if (notifiedIds.has(reminder._id)) return;

      const [hh, mm] = reminder.time.split(':').map(Number);
      const reminderDate = new Date(reminder.date);
      reminderDate.setHours(hh, mm, 0, 0);

      const diffMinutes = (reminderDate.getTime() - now.getTime()) / 60000;

      if (diffMinutes >= 0 && diffMinutes <= windowMinutes) {
        notify('Upcoming reminder', reminder.title);
        notifiedIds.add(reminder._id);
      }
    });
  }

  function goalWarning(percent, label) {
    if (percent >= 100) {
      notify('Goal reached', `You've hit your ${label} goal for today.`);
    } else if (percent >= 90) {
      notify('Almost there', `You're at ${percent}% of your ${label} goal.`);
    }
  }

  function budgetWarning(message) {
    if (message) notify('Budget warning', message);
  }

  /**
   * localStorage is used purely to avoid re-sending the same reminder
   * notification repeatedly within the same browser. It is never the
   * source of truth for reminder/todo data (that always comes from the
   * API) and every access is guarded, since some browser contexts
   * (private mode, disabled storage) can throw.
   */
  function readStageLog(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  function writeStageLog(key, stages) {
    try {
      localStorage.setItem(key, JSON.stringify(stages));
    } catch {
      // Storage unavailable - reminders will simply be able to repeat
      // within the session, which is a harmless degradation.
    }
  }

  /**
   * Combines a todo's deadlineDate + optional deadlineTime into a local
   * Date for comparison against "now". Missing time defaults to 23:59,
   * mirroring the backend's deadlineAsDate().
   */
  function todoDeadlineDate(todo) {
    const d = new Date(todo.deadlineDate);
    if (todo.deadlineTime) {
      const [hh, mm] = todo.deadlineTime.split(':').map(Number);
      d.setHours(hh, mm, 0, 0);
    } else {
      d.setHours(23, 59, 0, 0);
    }
    return d;
  }

  /**
   * Implements the PRD's todo reminder schedule:
   *  - more than 2 days out: one reminder ~2 days before the deadline
   *  - inside that window: one reminder ~5-6 hours before the deadline
   *  - while still incomplete and inside the final hour, an hourly nudge
   *  - once completed (or reminders disabled), nothing fires
   * Each stage is only ever sent once per todo (tracked in localStorage)
   * so repeated calls (e.g. a periodic check) don't spam the user.
   */
  function checkTodoReminders(todos) {
    if (!Array.isArray(todos)) return;
    const now = Date.now();

    todos.forEach((todo) => {
      if (todo.completed || todo.reminderEnabled === false) return;

      const deadline = todoDeadlineDate(todo);
      const msLeft = deadline.getTime() - now;
      if (msLeft <= 0) return; // overdue - no more forward-looking reminders

      const hoursLeft = msLeft / 3600000;
      const storageKey = `habitsync_todo_notified_${todo._id}`;
      const stages = readStageLog(storageKey);
      let changed = false;

      if (hoursLeft <= 48 && hoursLeft > 6 && !stages.includes('2day')) {
        notify('Todo due soon', `"${todo.title}" is due in about 2 days.`);
        stages.push('2day');
        changed = true;
      }

      if (hoursLeft <= 6 && hoursLeft > 1 && !stages.includes('6hr')) {
        notify('Todo due soon', `"${todo.title}" is due in a few hours.`);
        stages.push('6hr');
        changed = true;
      }

      if (hoursLeft <= 1) {
        const hourBucket = `hour_${Math.floor(now / 3600000)}`;
        if (!stages.includes(hourBucket)) {
          notify('Todo due soon', `"${todo.title}" is due within the hour.`);
          stages.push(hourBucket);
          changed = true;
        }
      }

      if (changed) writeStageLog(storageKey, stages);
    });
  }

  /**
   * Fires the evening "remaining water" reminder once per calendar day,
   * around the user's configured time (default 9 PM). remaining = daily
   * goal - today's recorded intake; if the goal has already been
   * reached, the notification says so instead.
   */
  function checkWaterEveningReminder({ remaining, goal, goalReached, enabled, reminderTime }) {
    if (!enabled) return;

    const now = new Date();
    const [hh, mm] = (reminderTime || '21:00').split(':').map(Number);
    const triggerAt = new Date(now);
    triggerAt.setHours(hh, mm, 0, 0);

    // Fire any time from the configured moment through the following
    // hour, so a page opened shortly after the trigger time still gets
    // the reminder.
    const windowEnd = new Date(triggerAt.getTime() + 60 * 60000);
    if (now < triggerAt || now > windowEnd) return;

    const todayKey = now.toISOString().slice(0, 10);
    const storageKey = `habitsync_water_evening_notified_${todayKey}`;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      // If storage can't be read, fall through and notify anyway rather
      // than silently never reminding the user.
    }

    if (goalReached) {
      notify('Water goal reached', "You've already hit your water goal for today. Nice work!");
    } else {
      notify('Evening water check-in', `You still need ${remaining} ml to reach your ${goal} ml goal today.`);
    }

    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Non-fatal - worst case the reminder can repeat this session.
    }
  }

  return {
    isSupported,
    requestPermission,
    notify,
    checkReminders,
    goalWarning,
    budgetWarning,
    checkTodoReminders,
    checkWaterEveningReminder,
  };
})();
