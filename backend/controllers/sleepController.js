const SleepLog = require('../models/SleepLog');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, lastNDaysRange, formatMinutes } = require('../utils/dateHelpers');

// @route   POST /api/sleep
// @access  Private
const addLog = asyncHandler(async (req, res) => {
  const { sleepTime, wakeTime, date } = req.body;

  if (!sleepTime || !wakeTime) {
    return res.status(400).json({ success: false, message: 'Both sleepTime and wakeTime are required' });
  }

  const log = await SleepLog.create({
    userId: req.userId,
    sleepTime: new Date(sleepTime),
    wakeTime: new Date(wakeTime),
    date: startOfDay(date || wakeTime),
  });

  res.status(201).json({ success: true, message: 'Sleep record saved', data: { log } });
});

// @route   PUT /api/sleep/:id
// @access  Private
const updateLog = asyncHandler(async (req, res) => {
  const log = await SleepLog.findOne({ _id: req.params.id, userId: req.userId });

  if (!log) {
    return res.status(404).json({ success: false, message: 'Sleep record not found' });
  }

  const { sleepTime, wakeTime, date } = req.body;

  if (sleepTime !== undefined) log.sleepTime = new Date(sleepTime);
  if (wakeTime !== undefined) log.wakeTime = new Date(wakeTime);
  if (date !== undefined) log.date = startOfDay(date);

  await log.save();

  res.status(200).json({ success: true, message: 'Sleep record updated', data: { log } });
});

// @route   DELETE /api/sleep/:id
// @access  Private
const deleteLog = asyncHandler(async (req, res) => {
  const log = await SleepLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!log) {
    return res.status(404).json({ success: false, message: 'Sleep record not found' });
  }

  res.status(200).json({ success: true, message: 'Sleep record deleted' });
});

// @route   GET /api/sleep/today
// @access  Private
const getToday = asyncHandler(async (req, res) => {
  const today = startOfDay();
  const log = await SleepLog.findOne({ userId: req.userId, date: today }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { log, durationFormatted: log ? formatMinutes(log.duration) : null },
  });
});

// @route   GET /api/sleep/history?days=7
// @access  Private
const getHistory = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const { start, end } = lastNDaysRange(days);

  const logs = await SleepLog.find({
    userId: req.userId,
    date: { $gte: start, $lt: end },
  }).sort({ date: 1 });

  const avgMinutes = logs.length > 0 ? logs.reduce((sum, l) => sum + l.duration, 0) / logs.length : 0;

  res.status(200).json({
    success: true,
    data: {
      logs,
      averageDuration: Math.round(avgMinutes),
      averageDurationFormatted: formatMinutes(avgMinutes),
    },
  });
});

module.exports = { addLog, updateLog, deleteLog, getToday, getHistory };
