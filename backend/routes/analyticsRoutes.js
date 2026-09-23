const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getHabitAnalytics,
  getWaterAnalytics,
  getSleepAnalytics,
  getExpenseAnalytics,
  getInsights,
} = require('../controllers/analyticsController');

const router = express.Router();

router.use(protect);

router.get('/habits', getHabitAnalytics);
router.get('/water', getWaterAnalytics);
router.get('/sleep', getSleepAnalytics);
router.get('/expenses', getExpenseAnalytics);
router.get('/insights', getInsights);

module.exports = router;
