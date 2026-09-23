const mongoose = require('mongoose');

const SleepLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sleepTime: {
      type: Date,
      required: [true, 'Sleep time is required'],
    },
    wakeTime: {
      type: Date,
      required: [true, 'Wake time is required'],
    },
    duration: {
      // duration in minutes, calculated automatically
      type: Number,
      default: 0,
    },
    date: {
      // the "sleep date" this record belongs to (normalized day, UTC)
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

SleepLogSchema.pre('validate', function calculateDuration(next) {
  if (this.sleepTime && this.wakeTime) {
    let diffMs = new Date(this.wakeTime).getTime() - new Date(this.sleepTime).getTime();
    // Handle overnight sleep where wakeTime's clock time is "before"
    // sleepTime's clock time but the actual date crosses midnight.
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    this.duration = Math.round(diffMs / 60000); // minutes
  }
  next();
});

SleepLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('SleepLog', SleepLogSchema);
