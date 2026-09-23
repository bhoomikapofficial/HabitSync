const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const WaterLog = require('../models/WaterLog');
const SleepLog = require('../models/SleepLog');
const Expense = require('../models/Expense');
const Reminder = require('../models/Reminder');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, todayRange, formatMinutes } = require('../utils/dateHelpers');

// @route   GET /api/dashboard
// @access  Private
// Combines today's progress across all modules into a single response,
// exactly matching the "Today's Progress" summary described in the PRD.
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const today = startOfDay();
  const { start: todayStart, end: todayEnd } = todayRange();

  const [habits, habitLogsToday, waterLogsToday, sleepLogToday, expensesToday, upcomingReminders] = await Promise.all([
    Habit.find({ userId, active: true }),
    HabitLog.find({ userId, date: today }),
    WaterLog.find({ userId, timestamp: { $gte: todayStart, $lt: todayEnd } }),
    SleepLog.findOne({ userId, date: today }).sort({ createdAt: -1 }),
    Expense.find({ userId, date: { $gte: todayStart, $lt: todayEnd } }),
    Reminder.find({ userId, status: 'pending', date: { $gte: todayStart } })
      .sort({ date: 1, time: 1 })
      .limit(5),
  ]);

  const habitsCompletedCount = habitLogsToday.filter((l) => l.completed).length;
  const waterTotal = waterLogsToday.reduce((sum, l) => sum + l.amount, 0);
  const expensesTotal = expensesToday.reduce((sum, e) => sum + e.amount, 0);

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
      },
      sleep: {
        durationMinutes: sleepLogToday ? sleepLogToday.duration : null,
        durationFormatted: sleepLogToday ? formatMinutes(sleepLogToday.duration) : null,
      },
      expenses: {
        total: expensesTotal,
      },
      reminders: {
        upcoming: upcomingReminders,
        upcomingCount: upcomingReminders.length,
      },
    },
  });
});

module.exports = { getDashboard };
