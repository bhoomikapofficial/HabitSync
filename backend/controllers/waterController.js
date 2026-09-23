const WaterLog = require('../models/WaterLog');
const asyncHandler = require('../utils/asyncHandler');
const { todayRange, lastNDaysRange } = require('../utils/dateHelpers');

// @route   GET /api/water
// @access  Private
// Returns today's water logs and total, plus the user's daily goal.
const getToday = asyncHandler(async (req, res) => {
  const { start, end } = todayRange();

  const logs = await WaterLog.find({
    userId: req.userId,
    timestamp: { $gte: start, $lt: end },
  }).sort({ timestamp: 1 });

  const total = logs.reduce((sum, l) => sum + l.amount, 0);

  res.status(200).json({
    success: true,
    data: { logs, total, goal: req.user.waterGoalMl },
  });
});

// @route   POST /api/water
// @access  Private
const addLog = asyncHandler(async (req, res) => {
  const { amount, timestamp } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'A positive water amount (ml) is required' });
  }

  const log = await WaterLog.create({
    userId: req.userId,
    amount,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });

  res.status(201).json({ success: true, message: 'Water intake recorded', data: { log } });
});

// @route   DELETE /api/water/:id
// @access  Private
const deleteLog = asyncHandler(async (req, res) => {
  const log = await WaterLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!log) {
    return res.status(404).json({ success: false, message: 'Water log not found' });
  }

  res.status(200).json({ success: true, message: 'Water log deleted' });
});

// @route   GET /api/water/history?days=7
// @access  Private
// Returns per-day totals for the last N days, useful for charts.
const getHistory = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const { start, end } = lastNDaysRange(days);

  const logs = await WaterLog.find({
    userId: req.userId,
    timestamp: { $gte: start, $lt: end },
  }).sort({ timestamp: 1 });

  // Bucket logs by calendar day (UTC)
  const buckets = {};
  logs.forEach((log) => {
    const key = new Date(log.timestamp).toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + log.amount;
  });

  const dailyTotals = Object.entries(buckets)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  res.status(200).json({ success: true, data: { dailyTotals, goal: req.user.waterGoalMl } });
});

// @route   PUT /api/water/goal
// @access  Private
const setGoal = asyncHandler(async (req, res) => {
  const { goalMl } = req.body;

  if (!goalMl || goalMl <= 0) {
    return res.status(400).json({ success: false, message: 'A positive goal (ml) is required' });
  }

  req.user.waterGoalMl = goalMl;
  await req.user.save();

  res.status(200).json({ success: true, message: 'Water goal updated', data: { goal: req.user.waterGoalMl } });
});

module.exports = { getToday, addLog, deleteLog, getHistory, setGoal };
