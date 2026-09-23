const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getReminders,
  getUpcoming,
  createReminder,
  updateReminder,
  deleteReminder,
} = require('../controllers/reminderController');

const router = express.Router();

router.use(protect);

router.route('/').get(getReminders).post(createReminder);
router.get('/upcoming', getUpcoming);
router.route('/:id').put(updateReminder).delete(deleteReminder);

module.exports = router;
