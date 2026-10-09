const SleepLog = require('../models/SleepLog');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, formatMinutes } = require('../utils/dateHelpers');
const { buildSleepSummary } = require('../utils/sleepAggregation');

// @route   POST /api/sleep
// @access  Private
// Accepts sleepType: 'night' (default) or 'daytime'. The sleep-day this
// record is grouped under is always derived from sleepTime (see the
// grouping rule documented on the SleepLog model) - any client-supplied
// "date" is ignored so the rule is applied consistently.
const addLog = asyncHandler(async (req, res) => {
  const { sleepTime, wakeTime, sleepType } = req.body;

  if (!sleepTime || !wakeTime) {
    return res.status(400).json({ success: false, message: 'Both sleepTime and wakeTime are required' });
  }

  const sTime = new Date(sleepTime);
  const wTime = new Date(wakeTime);

  if (Number.isNaN(sTime.getTime()) || Number.isNaN(wTime.getTime())) {
    return res.status(400).json({ success: false, message: 'sleepTime and wakeTime must be valid dates' });
  }
  if (wTime.getTime() <= sTime.getTime()) {
    return res.status(400).json({ success: false, message: 'Wake time must be after sleep time' });
  }

  const type = sleepType === 'daytime' ? 'daytime' : 'night';

  const log = await SleepLog.create({
    userId: req.userId,
    sleepTime: sTime,
    wakeTime: wTime,
    sleepType: type,
    date: startOfDay(sTime),
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

  const { sleepTime, wakeTime, sleepType } = req.body;

  if (sleepTime !== undefined) log.sleepTime = new Date(sleepTime);
  if (wakeTime !== undefined) log.wakeTime = new Date(wakeTime);
  if (sleepType !== undefined) log.sleepType = sleepType === 'daytime' ? 'daytime' : 'night';

  if (log.wakeTime.getTime() <= log.sleepTime.getTime()) {
    return res.status(400).json({ success: false, message: 'Wake time must be after sleep time' });
  }

  // Re-derive the sleep-day from sleepTime whenever it changes, so the
  // grouping rule stays consistent after an edit.
  log.date = startOfDay(log.sleepTime);

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
// Returns the most recently logged night sleep (shown as "Last night"
// regardless of which sleep-day it's grouped under) plus any daytime
// naps logged for today's sleep-day.
const getToday = asyncHandler(async (req, res) => {
  const today = startOfDay();

  const [lastNight, todayNaps] = await Promise.all([
    SleepLog.findOne({ userId: req.userId, sleepType: 'night' }).sort({ wakeTime: -1 }),
    SleepLog.find({ userId: req.userId, sleepType: 'daytime', date: today }).sort({ sleepTime: 1 }),
  ]);

  const napsTotalMinutes = todayNaps.reduce((sum, l) => sum + l.duration, 0);

  res.status(200).json({
    success: true,
    data: {
      // Kept for backward compatibility with the original single-log shape.
      log: lastNight,
      durationFormatted: lastNight ? formatMinutes(lastNight.duration) : null,
      lastNight,
      todayNaps,
      napsTotalMinutes,
      napsTotalFormatted: formatMinutes(napsTotalMinutes),
    },
  });
});

// @route   GET /api/sleep/history?days=7
// @access  Private
// Returns the raw log list plus a zero-filled, per-sleep-day combined
// summary (night + daytime) for charts and the "Last 7 days" / history
// views on the Sleep page.
const getHistory = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const summary = await buildSleepSummary(req.userId, days);

  res.status(200).json({ success: true, data: { days, ...summary } });
});

module.exports = { addLog, updateLog, deleteLog, getToday, getHistory };
