const mongoose = require('mongoose');

const WaterLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      // amount in millilitres
      type: Number,
      required: [true, 'Water amount (ml) is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

WaterLogSchema.index({ userId: 1, timestamp: 1 });

module.exports = mongoose.model('WaterLog', WaterLogSchema);
