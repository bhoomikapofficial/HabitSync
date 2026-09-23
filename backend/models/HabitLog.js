const mongoose = require('mongoose');

const HabitLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
      index: true,
    },
    date: {
      // Normalized to YYYY-MM-DD (start of day, UTC) so a habit has at
      // most one log entry per calendar day.
      type: Date,
      required: true,
    },
    completed: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A habit can only be logged once per day
HabitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });
HabitLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('HabitLog', HabitLogSchema);
