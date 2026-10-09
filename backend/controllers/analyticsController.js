const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const WaterLog = require('../models/WaterLog');
const Expense = require('../models/Expense');
const Todo = require('../models/Todo');
const asyncHandler = require('../utils/asyncHandler');
const { lastNDaysRange, currentMonthRange, lastNDaysKeys, dayKey, zeroFillByKey, formatMinutes } = require('../utils/dateHelpers');
const { buildInsights } = require('../utils/insights');
const { buildSleepSummary } = require('../utils/sleepAggregation');
const { isOverdue } = require('./todoController');

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
      dailyCounts, // { "2026-09-20": 3, ... } - kept for backward compatibility
      dailyCompletionSeries: zeroFillByKey(dailyCounts, lastNDaysKeys(days)),
      perHabit,
      overallCompletionRate: overallRate,
      overallCompletionPercentage: Math.round(overallRate * 100),
    },
  });
});

// @route   GET /api/analytics/water?days=7
// @access  Private
// The daily chart is zero-filled across the full range so days without a
// logged entry show as 0 instead of being silently omitted (this was the
// water chart bug: a day with no log used to vanish from the x-axis
// entirely rather than displaying).
const getWaterAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const { start, end } = lastNDaysRange(days);

  const logs = await WaterLog.find({ userId: req.userId, timestamp: { $gte: start, $lt: end } });

  const buckets = {};
  logs.forEach((log) => {
    const key = dayKey(log.timestamp);
    buckets[key] = (buckets[key] || 0) + log.amount;
  });

  const dailyTotals = zeroFillByKey(buckets, lastNDaysKeys(days));

  const goal = req.user.waterGoalMl;
  const totalMl = dailyTotals.reduce((s, d) => s + d.total, 0);
  const avg = dailyTotals.length > 0 ? totalMl / dailyTotals.length : 0;
  const goalMetDays = goal > 0 ? dailyTotals.filter((d) => d.total >= goal).length : 0;

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
// Combined (night + daytime) sleep totals per sleep-day, zero-filled.
const getSleepAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const summary = await buildSleepSummary(req.userId, days);

  res.status(200).json({
    success: true,
    data: {
      days,
      byDay: summary.summaryByDay,
      averageDuration: summary.averageDuration,
      averageDurationFormatted: summary.averageDurationFormatted,
      consistencyLabel: summary.consistencyLabel,
    },
  });
});

// @route   GET /api/analytics/expenses?days=30
// @access  Private
// The daily chart is zero-filled so zero-spending days are included
// rather than omitted (matching the water chart fix above).
const getExpenseAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const { start, end } = lastNDaysRange(days);

  const [logs, monthLogs] = await Promise.all([
    Expense.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    Expense.find({ userId: req.userId, date: { $gte: currentMonthRange().start, $lt: currentMonthRange().end } }),
  ]);

  const dailyBuckets = {};
  logs.forEach((e) => {
    const key = dayKey(e.date);
    dailyBuckets[key] = (dailyBuckets[key] || 0) + e.amount;
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
      dailyTotals: zeroFillByKey(dailyBuckets, lastNDaysKeys(days)),
      categoryTotals,
      monthTotal,
      budget,
      budgetDifference: budget > 0 ? budget - monthTotal : null,
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

  const [waterLogs, habits, habitLogs, expenses, sleepSummary] = await Promise.all([
    WaterLog.find({ userId: req.userId, timestamp: { $gte: start, $lt: end } }),
    Habit.find({ userId: req.userId, active: true }),
    HabitLog.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    Expense.find({ userId: req.userId, date: { $gte: monthBounds.start, $lt: monthBounds.end } }),
    buildSleepSummary(req.userId, 7),
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

  // Reuse the combined per-sleep-day totals (night + daytime) so the
  // insight matches what the Sleep page itself shows.
  const sleepLogsForInsight = sleepSummary.summaryByDay
    .filter((d) => d.combinedMinutes > 0)
    .map((d) => ({ duration: d.combinedMinutes }));

  const insights = buildInsights({
    sleepLogs: sleepLogsForInsight,
    expenses,
    waterDailyTotals,
    waterGoalMl: req.user.waterGoalMl,
    habitCompletionRate,
    monthlySpent,
    monthlyBudget: req.user.monthlyBudget,
  });

  res.status(200).json({ success: true, data: { insights } });
});

// @route   GET /api/analytics/history?days=14
// @access  Private
// Returns a day-by-day breakdown of the authenticated user's own data
// for the last N days (default 14): sleep (with daytime + combined
// total), water intake and goal status, expenses (plus week-wise
// totals), habits assigned/completed, and todos completed. Every query
// below is scoped to req.userId, so this never exposes another user's
// records.
const getHistory = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);
  const { start, end } = lastNDaysRange(days);
  const keys = lastNDaysKeys(days);

  const [habits, habitLogs, waterLogs, sleepSummary, expenses, todos] = await Promise.all([
    Habit.find({ userId: req.userId, active: true }),
    HabitLog.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    WaterLog.find({ userId: req.userId, timestamp: { $gte: start, $lt: end } }),
    buildSleepSummary(req.userId, days),
    Expense.find({ userId: req.userId, date: { $gte: start, $lt: end } }),
    Todo.find({ userId: req.userId }),
  ]);

  const habitCompletedByDay = {};
  habitLogs.forEach((l) => {
    if (!l.completed) return;
    const key = dayKey(l.date);
    habitCompletedByDay[key] = (habitCompletedByDay[key] || 0) + 1;
  });

  const waterByDay = {};
  waterLogs.forEach((l) => {
    const key = dayKey(l.timestamp);
    waterByDay[key] = (waterByDay[key] || 0) + l.amount;
  });

  const expenseByDay = {};
  expenses.forEach((e) => {
    const key = dayKey(e.date);
    expenseByDay[key] = (expenseByDay[key] || 0) + e.amount;
  });

  const sleepByDay = {};
  sleepSummary.summaryByDay.forEach((d) => {
    sleepByDay[d.date] = d;
  });

  const todosCompletedByDay = {};
  todos.forEach((t) => {
    if (t.completed && t.completedAt) {
      const key = dayKey(t.completedAt);
      todosCompletedByDay[key] = (todosCompletedByDay[key] || 0) + 1;
    }
  });

  const goal = req.user.waterGoalMl;

  const history = keys
    .map((date) => {
      const sleep = sleepByDay[date] || { nightMinutes: 0, daytimeMinutes: 0, combinedMinutes: 0, combinedFormatted: formatMinutes(0) };
      const waterTotal = waterByDay[date] || 0;
      return {
        date,
        sleep: {
          nightMinutes: sleep.nightMinutes,
          daytimeMinutes: sleep.daytimeMinutes,
          combinedMinutes: sleep.combinedMinutes,
          combinedFormatted: sleep.combinedFormatted,
        },
        water: { total: waterTotal, goal, goalReached: goal > 0 && waterTotal >= goal },
        expenses: { total: expenseByDay[date] || 0 },
        habits: { assigned: habits.length, completed: habitCompletedByDay[date] || 0 },
        todos: { completed: todosCompletedByDay[date] || 0 },
      };
    })
    .reverse(); // most recent day first, for display

  // Week-wise spending totals: bucket each day into the Monday-starting
  // week it falls in, and sum expenses per week.
  const mondayOf = (dateStr) => {
    const d = new Date(dateStr);
    const dow = d.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = (dow + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diffToMonday);
    return dayKey(d);
  };

  const weeklyMap = {};
  keys.forEach((date) => {
    const wk = mondayOf(date);
    weeklyMap[wk] = (weeklyMap[wk] || 0) + (expenseByDay[date] || 0);
  });
  const weeklySpending = Object.entries(weeklyMap)
    .map(([weekStart, total]) => ({ weekStart, total }))
    .sort((a, b) => (a.weekStart > b.weekStart ? 1 : -1));

  const pendingTodos = todos.filter((t) => !t.completed);
  const overdueTodos = pendingTodos.filter((t) => isOverdue(t));

  res.status(200).json({
    success: true,
    data: {
      days,
      history,
      weeklySpending,
      pendingTodosCount: pendingTodos.length,
      overdueTodosCount: overdueTodos.length,
    },
  });
});

module.exports = {
  getHabitAnalytics,
  getWaterAnalytics,
  getSleepAnalytics,
  getExpenseAnalytics,
  getInsights,
  getHistory,
};
