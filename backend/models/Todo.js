const mongoose = require('mongoose');

/**
 * Todo entity (Version 2.0). Lives alongside Habits on the Habits page as
 * a separate, independent list — creating/editing/deleting/completing a
 * todo never touches Habit or HabitLog documents.
 */
const TodoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Todo title is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    deadlineDate: {
      // Normalized to midnight UTC of the deadline's calendar day.
      type: Date,
      required: [true, 'Deadline date is required'],
    },
    deadlineTime: {
      // Optional "HH:MM" 24-hour string. When absent, the deadline is
      // treated as end-of-day (23:59) for reminder/overdue calculations.
      type: String,
      default: null,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM 24-hour format'],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    reminderEnabled: {
      type: Boolean,
      default: true,
    },
    reminderMode: {
      // 'default' follows the standard PRD reminder schedule (2 days out,
      // then 5-6h out, then hourly while incomplete near the deadline).
      // 'off' is equivalent to reminderEnabled=false and is kept only so
      // the field is self-describing when read directly from the DB.
      type: String,
      enum: ['default', 'off'],
      default: 'default',
    },
  },
  { timestamps: true }
);

TodoSchema.index({ userId: 1, completed: 1, deadlineDate: 1 });

module.exports = mongoose.model('Todo', TodoSchema);
