const Reminder = require('../models/Reminder');
const asyncHandler = require('../utils/asyncHandler');

// @route   GET /api/reminders
// @access  Private
// Supports optional ?status=pending|completed|dismissed filter.
const getReminders = asyncHandler(async (req, res) => {
  const query = { userId: req.userId };
  if (req.query.status) {
    query.status = req.query.status;
  }

  const reminders = await Reminder.find(query).sort({ date: 1, time: 1 });
  res.status(200).json({ success: true, data: { reminders } });
});

// @route   GET /api/reminders/upcoming?limit=5
// @access  Private
// Returns the next N pending reminders from today onward, used by the dashboard.
const getUpcoming = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const reminders = await Reminder.find({
    userId: req.userId,
    status: 'pending',
    date: { $gte: todayStart },
  })
    .sort({ date: 1, time: 1 })
    .limit(limit);

  res.status(200).json({ success: true, data: { reminders } });
});

// @route   POST /api/reminders
// @access  Private
const createReminder = asyncHandler(async (req, res) => {
  const { title, date, time, repeatType } = req.body;

  if (!title || !date || !time) {
    return res.status(400).json({ success: false, message: 'title, date and time are required' });
  }

  const reminder = await Reminder.create({
    userId: req.userId,
    title,
    date: new Date(date),
    time,
    repeatType,
  });

  res.status(201).json({ success: true, message: 'Reminder created', data: { reminder } });
});

// @route   PUT /api/reminders/:id
// @access  Private
const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.userId });

  if (!reminder) {
    return res.status(404).json({ success: false, message: 'Reminder not found' });
  }

  const { title, date, time, repeatType, status } = req.body;

  if (title !== undefined) reminder.title = title;
  if (date !== undefined) reminder.date = new Date(date);
  if (time !== undefined) reminder.time = time;
  if (repeatType !== undefined) reminder.repeatType = repeatType;
  if (status !== undefined) reminder.status = status;

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
