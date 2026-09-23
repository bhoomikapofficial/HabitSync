const mongoose = require('mongoose');

const CATEGORIES = ['Food', 'Travel', 'Shopping/Materials', 'Education', 'Entertainment', 'Other'];

const ExpenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    category: {
      type: String,
      enum: CATEGORIES,
      default: 'Other',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

ExpenseSchema.index({ userId: 1, date: 1 });
ExpenseSchema.index({ userId: 1, category: 1 });

ExpenseSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Expense', ExpenseSchema);
