const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  markComplete,
  getHistory,
} = require('../controllers/habitController');

const router = express.Router();

router.use(protect);

router.route('/').get(getHabits).post(createHabit);
router.route('/:id').put(updateHabit).delete(deleteHabit);
router.post('/:id/complete', markComplete);
router.get('/:id/history', getHistory);

module.exports = router;
