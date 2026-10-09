const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const WaterLog = require('../models/WaterLog');
const SleepLog = require('../models/SleepLog');
const Expense = require('../models/Expense');
const Reminder = require('../models/Reminder');
const Todo = require('../models/Todo');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, todayRange, formatMinutes } = require('../utils/dateHelpers');
const { isOverdue } = require('./todoController');

// @route   GET /api/dashboard
// @access  Private
// Combines today's progress across all modules into a single response,
// exactly matching the "Today's Progress" summary described in the PRD.
// A failure in any one section is isolated so the rest of the dashboard
// still loads (see the Promise.allSettled below).
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const today = startOfDay();
  const { start: todayStart, end: todayEnd } = todayRange();

  const results = await Promise.allSettled([
    Habit.find({ userId, active: true }),
    HabitLog.find({ userId, date: today }),
    WaterLog.find({ userId, timestamp: { $gte: todayStart, $lt: todayEnd } }),
    // "Today's" sleep for the dashboard is the most recently logged night
    // sleep, plus any daytime naps logged under today's sleep-day - this
    // mirrors the same combined view used on the Sleep page.
    SleepLog.findOne({ userId, sleepType: 'night' }).sort({ wakeTime: -1 }),
    SleepLog.find({ userId, sleepType: 'daytime', date: today }),
    Expense.find({ userId, date: { $gte: todayStart, $lt: todayEnd } }),
    Reminder.find({ userId, status: 'pending', date: { $gte: todayStart } })
      .sort({ date: 1, time: 1 })
      .limit(5),
    Todo.find({ userId, completed: false }),
  ]);

  const value = (i, fallback) => (results[i].status === 'fulfilled' ? results[i].value : fallback);

  const habits = value(0, []);
  const habitLogsToday = value(1, []);
  const waterLogsToday = value(2, []);
  const lastNightSleep = value(3, null);
  const todayNaps = value(4, []);
  const expensesToday = value(5, []);
  const upcomingReminders = value(6, []);
  const pendingTodos = value(7, []);

  const habitsCompletedCount = habitLogsToday.filter((l) => l.completed).length;
  const waterTotal = waterLogsToday.reduce((sum, l) => sum + l.amount, 0);
  const expensesTotal = expensesToday.reduce((sum, e) => sum + e.amount, 0);
  const napsMinutes = todayNaps.reduce((sum, l) => sum + l.duration, 0);
  const combinedSleepMinutes = (lastNightSleep ? lastNightSleep.duration : 0) + napsMinutes;

  const overdueTodos = pendingTodos.filter((t) => isOverdue(t));

  res.status(200).json({
    success: true,
    data: {
      date: today,
      habits: {
        completed: habitsCompletedCount,
        total: habits.length,
      },
      water: {
        current: waterTotal,
        goal: req.user.waterGoalMl,
        remaining: Math.max(0, req.user.waterGoalMl - waterTotal),
      },
      sleep: {
        // Backward-compatible single-value fields (last night only)...
        durationMinutes: lastNightSleep ? lastNightSleep.duration : null,
        durationFormatted: lastNightSleep ? formatMinutes(lastNightSleep.duration) : null,
        // ...plus the combined (night + today's naps) total.
        combinedMinutes: combinedSleepMinutes > 0 ? combinedSleepMinutes : null,
        combinedFormatted: combinedSleepMinutes > 0 ? formatMinutes(combinedSleepMinutes) : null,
      },
      expenses: {
        total: expensesTotal,
      },
      reminders: {
        upcoming: upcomingReminders,
        upcomingCount: upcomingReminders.length,
      },
      todos: {
        pending: pendingTodos.length,
        overdue: overdueTodos.length,
      },
    },
  });
});

module.exports = { getDashboard };
