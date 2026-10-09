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
    // --- Version 2.0: daytime/afternoon sleep support ---
    sleepType: {
      type: String,
      enum: ['night', 'daytime'],
      default: 'night',
    },
    date: {
      // The "sleep-day" this record is grouped under (normalized to
      // midnight UTC). Sleep-day grouping rule (applied consistently for
      // both night and daytime records): a record belongs to the
      // calendar day on which the person went to sleep (sleepTime's
      // date), NOT the day they woke up. This is what lets a daytime nap
      // and the night sleep that follows it later the same evening be
      // combined into one sleep-day total, e.g.:
      //   Sep 24, 2:00 PM -> 4:00 PM   (daytime nap, sleepDay = Sep 24)
      //   Sep 24, 11:00 PM -> Sep 25, 5:30 AM (night sleep, sleepDay = Sep 24)
      //   combined Sep 24 total = 2h + 6h30m = 8h30m
      // while a night sleep that started the previous day
      // (Sep 23 10:30 PM -> Sep 24 6:00 AM) is grouped under Sep 23 and
      // reported on its own.
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
SleepLogSchema.index({ userId: 1, sleepType: 1, date: 1 });

module.exports = mongoose.model('SleepLog', SleepLogSchema);
