const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const WaterLog = require('../models/WaterLog');
const SleepLog = require('../models/SleepLog');
const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const { lastNDaysRange, currentMonthRange, formatMinutes } = require('../utils/dateHelpers');
const { buildInsights } = require('../utils/insights');

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// @route   GET /api/analytics/habits?days=7
// @access  Private
const getHabitAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const { start, end } = lastNDaysRange(days);

  const [habits, logs] = await Promise.all([
    Habit.find({ userId: req.userId, active: true }),
    HabitLog.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
  ]);

  // Daily completion count across all habits
  const dailyCounts = {};
  logs.forEach((log) => {
    if (!log.completed) return;
    const key = dayKey(log.date);
    dailyCounts[key] = (dailyCounts[key] || 0) + 1;
  });

  // Per-habit consistency (completion % over the window)
  const perHabit = habits.map((habit) => {
    const habitLogs = logs.filter((l) => l.habitId.toString() === habit._id.toString() && l.completed);
    return {
      habitId: habit._id,
      name: habit.name,
      completedDays: habitLogs.length,
      completionPercentage: Math.round((habitLogs.length / days) * 100),
    };
  });

  const totalPossible = habits.length * days;
  const totalCompleted = logs.filter((l) => l.completed).length;
  const overallRate = totalPossible > 0 ? totalCompleted / totalPossible : 0;

  res.status(200).json({
    success: true,
    data: {
      days,
      dailyCounts, // { "2026-09-20": 3, ... }
      perHabit,
      overallCompletionRate: overallRate,
      overallCompletionPercentage: Math.round(overallRate * 100),
    },
  });
});

// @route   GET /api/analytics/water?days=7
// @access  Private
const getWaterAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const { start, end } = lastNDaysRange(days);

  const logs = await WaterLog.find({ userId: req.userId, timestamp: { $gte: start, $lt: end } });

  const buckets = {};
  logs.forEach((log) => {
    const key = dayKey(log.timestamp);
    buckets[key] = (buckets[key] || 0) + log.amount;
  });

  const dailyTotals = Object.entries(buckets)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const avg = dailyTotals.length > 0 ? dailyTotals.reduce((s, d) => s + d.total, 0) / dailyTotals.length : 0;
  const goal = req.user.waterGoalMl;
  const goalMetDays = dailyTotals.filter((d) => d.total >= goal).length;

  res.status(200).json({
    success: true,
    data: {
      days,
      dailyTotals,
      weeklyAverage: Math.round(avg),
      goal,
      goalMetDays,
    },
  });
});

// @route   GET /api/analytics/sleep?days=7
// @access  Private
const getSleepAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const { start, end } = lastNDaysRange(days);

  const logs = await SleepLog.find({ userId: req.userId, date: { $gte: start, $lt: end } }).sort({ date: 1 });

  const byDay = logs.map((l) => ({ date: dayKey(l.date), durationMinutes: l.duration }));
  const avgMinutes = logs.length > 0 ? logs.reduce((s, l) => s + l.duration, 0) / logs.length : 0;

  // Consistency: standard deviation of duration (lower = more consistent)
  let consistencyLabel = 'Not enough data';
  if (logs.length >= 2) {
    const mean = avgMinutes;
    const variance = logs.reduce((s, l) => s + (l.duration - mean) ** 2, 0) / logs.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 30) consistencyLabel = 'Very consistent';
    else if (stdDev < 60) consistencyLabel = 'Fairly consistent';
    else consistencyLabel = 'Irregular';
  }

  res.status(200).json({
    success: true,
    data: {
      days,
      byDay,
      averageDuration: Math.round(avgMinutes),
      averageDurationFormatted: formatMinutes(avgMinutes),
      consistencyLabel,
    },
  });
});

// @route   GET /api/analytics/expenses?days=30
// @access  Private
const getExpenseAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const { start, end } = lastNDaysRange(days);

  const [logs, monthLogs] = await Promise.all([
    Expense.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    Expense.find({ userId: req.userId, date: { $gte: currentMonthRange().start, $lt: currentMonthRange().end } }),
  ]);

  const dailyTotals = {};
  logs.forEach((e) => {
    const key = dayKey(e.date);
    dailyTotals[key] = (dailyTotals[key] || 0) + e.amount;
  });

  const categoryTotals = {};
  monthLogs.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const monthTotal = monthLogs.reduce((s, e) => s + e.amount, 0);
  const budget = req.user.monthlyBudget || 0;

  res.status(200).json({
    success: true,
    data: {
      days,
      dailyTotals: Object.entries(dailyTotals)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => (a.date > b.date ? 1 : -1)),
      categoryTotals,
      monthTotal,
      budget,
      budgetUtilization: budget > 0 ? Math.round((monthTotal / budget) * 100) : null,
    },
  });
});

// @route   GET /api/analytics/insights
// @access  Private
// Combines the last 7 days of sleep/water/habit data and the current
// month's expenses into a set of simple, rule-based insight sentences.
const getInsights = asyncHandler(async (req, res) => {
  const { start, end } = lastNDaysRange(7);
  const monthBounds = currentMonthRange();

  const [sleepLogs, waterLogs, habits, habitLogs, expenses] = await Promise.all([
    SleepLog.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    WaterLog.find({ userId: req.userId, timestamp: { $gte: start, $lt: end } }),
    Habit.find({ userId: req.userId, active: true }),
    HabitLog.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    Expense.find({ userId: req.userId, date: { $gte: monthBounds.start, $lt: monthBounds.end } }),
  ]);

  const waterBuckets = {};
  waterLogs.forEach((log) => {
    const key = dayKey(log.timestamp);
    waterBuckets[key] = (waterBuckets[key] || 0) + log.amount;
  });
  const waterDailyTotals = Object.values(waterBuckets);

  const totalPossible = habits.length * 7;
  const totalCompleted = habitLogs.filter((l) => l.completed).length;
  const habitCompletionRate = totalPossible > 0 ? totalCompleted / totalPossible : null;

  const monthlySpent = expenses.reduce((s, e) => s + e.amount, 0);

  const insights = buildInsights({
    sleepLogs,
    expenses,
    waterDailyTotals,
    waterGoalMl: req.user.waterGoalMl,
    habitCompletionRate,
    monthlySpent,
    monthlyBudget: req.user.monthlyBudget,
  });

  res.status(200).json({ success: true, data: { insights } });
});

module.exports = { getHabitAnalytics, getWaterAnalytics, getSleepAnalytics, getExpenseAnalytics, getInsights };
