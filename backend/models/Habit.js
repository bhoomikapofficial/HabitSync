const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    target: {
      type: String, // e.g. "2 hours", "10 pages" - kept free-form per PRD example
      trim: true,
      default: '',
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    reminderTime: {
      type: String, // stored as "HH:MM" 24-hour string
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

HabitSchema.index({ userId: 1, active: 1 });

module.exports = mongoose.model('Habit', HabitSchema);
