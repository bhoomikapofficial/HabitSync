const Reminder = require('../models/Reminder');
const asyncHandler = require('../utils/asyncHandler');
const { advanceReminderIfDue, combineDateTime } = require('../utils/recurrence');

/**
 * Rolls every pending, recurring reminder in `reminders` forward past any
 * occurrences that have already passed, persisting any that changed.
 * Non-recurring or already non-pending reminders are left untouched.
 */
const advanceAndPersist = async (reminders) => {
  const changed = reminders.filter((r) => advanceReminderIfDue(r));
  if (changed.length > 0) {
    await Promise.all(changed.map((r) => r.save()));
  }
  return reminders;
};

// @route   GET /api/reminders
// @access  Private
// Supports optional ?status=pending|completed|dismissed filter.
const getReminders = asyncHandler(async (req, res) => {
  const query = { userId: req.userId };
  if (req.query.status) {
    query.status = req.query.status;
  }

  let reminders = await Reminder.find(query).sort({ date: 1, time: 1 });
  reminders = await advanceAndPersist(reminders);
  reminders.sort((a, b) => a.date - b.date || (a.time > b.time ? 1 : -1));

  res.status(200).json({ success: true, data: { reminders } });
});

// @route   GET /api/reminders/upcoming?limit=5
// @access  Private
// Returns the next N pending reminders from today onward, used by the dashboard.
const getUpcoming = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);

  // Recurring reminders are rolled forward first, over the full pending
  // set, so a reminder whose stored date has drifted into the past (but
  // recurs) is correctly brought back into the "upcoming" window before
  // filtering.
  let pending = await Reminder.find({ userId: req.userId, status: 'pending' });
  pending = await advanceAndPersist(pending);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const reminders = pending
    .filter((r) => r.date >= todayStart)
    .sort((a, b) => a.date - b.date || (a.time > b.time ? 1 : -1))
    .slice(0, limit);

  res.status(200).json({ success: true, data: { reminders } });
});

// @route   POST /api/reminders
// @access  Private
const createReminder = asyncHandler(async (req, res) => {
  const { title, date, time, repeatType, repeatDays, customDates, endDate, notificationEnabled } = req.body;

  if (!title || !date || !time) {
    return res.status(400).json({ success: false, message: 'title, date and time are required' });
  }

  const reminder = await Reminder.create({
    userId: req.userId,
    title,
    date: new Date(date),
    time,
    repeatType,
    repeatDays: Array.isArray(repeatDays) && repeatDays.length ? repeatDays : undefined,
    customDates: Array.isArray(customDates) && customDates.length ? customDates.map((d) => new Date(d)) : undefined,
    endDate: endDate ? new Date(endDate) : null,
    notificationEnabled: notificationEnabled !== undefined ? Boolean(notificationEnabled) : true,
  });

  reminder.nextTriggerAt = combineDateTime(reminder.date, reminder.time);
  await reminder.save();

  res.status(201).json({ success: true, message: 'Reminder created', data: { reminder } });
});

// @route   PUT /api/reminders/:id
// @access  Private
const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.userId });

  if (!reminder) {
    return res.status(404).json({ success: false, message: 'Reminder not found' });
  }

  const { title, date, time, repeatType, repeatDays, customDates, endDate, notificationEnabled, status } = req.body;

  if (title !== undefined) reminder.title = title;
  if (date !== undefined) reminder.date = new Date(date);
  if (time !== undefined) reminder.time = time;
  if (repeatType !== undefined) reminder.repeatType = repeatType;
  if (repeatDays !== undefined) reminder.repeatDays = Array.isArray(repeatDays) && repeatDays.length ? repeatDays : undefined;
  if (customDates !== undefined) {
    reminder.customDates = Array.isArray(customDates) && customDates.length ? customDates.map((d) => new Date(d)) : undefined;
  }
  if (endDate !== undefined) reminder.endDate = endDate ? new Date(endDate) : null;
  if (notificationEnabled !== undefined) reminder.notificationEnabled = Boolean(notificationEnabled);
  if (status !== undefined) reminder.status = status;

  reminder.nextTriggerAt = reminder.status === 'pending' ? combineDateTime(reminder.date, reminder.time) : null;

  await reminder.save();

  res.status(200).json({ success: true, message: 'Reminder updated', data: { reminder } });
});

// @route   DELETE /api/reminders/:id
// @access  Private
const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!reminder) {
    return res.status(404).json({ success: false, message: 'Reminder not found' });
  }

  res.status(200).json({ success: true, message: 'Reminder deleted' });
});

module.exports = { getReminders, getUpcoming, createReminder, updateReminder, deleteReminder };
