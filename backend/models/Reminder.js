const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Reminder title is required'],
      trim: true,
      maxlength: 150,
    },
    date: {
      type: Date,
      required: [true, 'Reminder date is required'],
    },
    time: {
      type: String, // "HH:MM" 24-hour string
      required: [true, 'Reminder time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM 24-hour format'],
    },
    repeatType: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly', 'custom'],
      default: 'none',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'dismissed'],
      default: 'pending',
    },
    // --- Version 2.0: recurrence customization ---
    repeatDays: {
      // Used when repeatType === 'weekly' to select specific days of the
      // week (0 = Sunday ... 6 = Saturday). Empty/absent means "repeat
      // weekly on the same weekday as the original date".
      type: [Number],
      default: undefined,
      validate: {
        validator: (arr) => !arr || arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: 'repeatDays must contain integers between 0 (Sunday) and 6 (Saturday)',
      },
    },
    customDates: {
      // Used when repeatType === 'custom' for a fixed list of one-off
      // dates (e.g. "Sep 28, Oct 3, and Oct 10").
      type: [Date],
      default: undefined,
    },
    endDate: {
      // Optional. Once the next computed occurrence would fall after
      // this date, the reminder's recurrence stops automatically.
      type: Date,
      default: null,
    },
    notificationEnabled: {
      // Lets a user keep a reminder active without receiving browser
      // notifications for it.
      type: Boolean,
      default: true,
    },
    nextTriggerAt: {
      // Cached combined date+time of this reminder's next occurrence,
      // recomputed whenever the reminder is created, edited, or rolled
      // forward past a due occurrence. Useful for sorting/filtering.
      type: Date,
      default: null,
    },
    lastTriggeredAt: {
      // Set when a pending occurrence's date/time has passed and the
      // reminder is rolled forward to its next occurrence.
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

ReminderSchema.index({ userId: 1, date: 1, status: 1 });
ReminderSchema.index({ userId: 1, nextTriggerAt: 1 });

module.exports = mongoose.model('Reminder', ReminderSchema);
