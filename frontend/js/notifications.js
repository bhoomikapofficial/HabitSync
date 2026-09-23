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

  return { isSupported, requestPermission, notify, checkReminders, goalWarning, budgetWarning };
})();
