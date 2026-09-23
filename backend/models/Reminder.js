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
      enum: ['none', 'daily', 'weekly', 'monthly'],
      default: 'none',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'dismissed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

ReminderSchema.index({ userId: 1, date: 1, status: 1 });

module.exports = mongoose.model('Reminder', ReminderSchema);
