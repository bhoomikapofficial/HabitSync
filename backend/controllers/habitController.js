const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, lastNDaysRange } = require('../utils/dateHelpers');

// @route   GET /api/habits
// @access  Private
const getHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ userId: req.userId, active: true }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: { habits } });
});

// @route   POST /api/habits
// @access  Private
const createHabit = asyncHandler(async (req, res) => {
  const { name, description, target, frequency, reminderTime } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Habit name is required' });
  }

  const habit = await Habit.create({
    userId: req.userId,
    name: name.trim(),
    description,
    target,
    frequency,
    reminderTime,
  });

  res.status(201).json({ success: true, message: 'Habit created', data: { habit } });
});

// @route   PUT /api/habits/:id
// @access  Private
const updateHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, userId: req.userId });

  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found' });
  }

  const { name, description, target, frequency, reminderTime, active } = req.body;

  if (name !== undefined) habit.name = name;
  if (description !== undefined) habit.description = description;
  if (target !== undefined) habit.target = target;
  if (frequency !== undefined) habit.frequency = frequency;
  if (reminderTime !== undefined) habit.reminderTime = reminderTime;
  if (active !== undefined) habit.active = active;

  await habit.save();

  res.status(200).json({ success: true, message: 'Habit updated', data: { habit } });
});

// @route   DELETE /api/habits/:id
// @access  Private
const deleteHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found' });
  }

  await HabitLog.deleteMany({ habitId: habit._id });

  res.status(200).json({ success: true, message: 'Habit deleted' });
});

// @route   POST /api/habits/:id/complete
// @access  Private
// Marks (or unmarks) a habit as completed for a given date (default: today).
const markComplete = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, userId: req.userId });

  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found' });
  }

  const date = startOfDay(req.body.date);
  const completed = req.body.completed !== undefined ? Boolean(req.body.completed) : true;

  const log = await HabitLog.findOneAndUpdate(
    { habitId: habit._id, date },
    { userId: req.userId, habitId: habit._id, date, completed },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ success: true, message: 'Habit log updated', data: { log } });
});

// @route   GET /api/habits/:id/history
// @access  Private
// Returns completion history for a habit over the last N days (default 30).
const getHistory = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, userId: req.userId });

  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found' });
  }

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const { start, end } = lastNDaysRange(days);

  const logs = await HabitLog.find({
    habitId: habit._id,
    date: { $gte: start, $lt: end },
  }).sort({ date: 1 });

  const completedCount = logs.filter((l) => l.completed).length;
  const completionPercentage = logs.length > 0 ? Math.round((completedCount / days) * 100) : 0;

  res.status(200).json({
    success: true,
    data: { habit, logs, completedCount, totalDays: days, completionPercentage },
  });
});

module.exports = { getHabits, createHabit, updateHabit, deleteHabit, markComplete, getHistory };
