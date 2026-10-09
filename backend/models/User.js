const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    waterGoalMl: {
      type: Number,
      default: 3000, // 3 Litres default daily goal
      min: 0,
    },
    monthlyBudget: {
      type: Number,
      default: 0,
      min: 0,
    },
    // --- Version 2.0: evening "remaining water" reminder preferences ---
    waterEveningReminderEnabled: {
      type: Boolean,
      default: true,
    },
    waterEveningReminderTime: {
      // "HH:MM" 24-hour string, expected to be 21:00 or 22:00 per the
      // PRD (~9 or 10 PM), but stored free-form so the user can adjust it.
      type: String,
      default: '21:00',
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM 24-hour format'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
