const express = require('express');
const { protect } = require('../middleware/auth');
const { getToday, addLog, deleteLog, getHistory, setGoal } = require('../controllers/waterController');

const router = express.Router();

router.use(protect);

router.route('/').get(getToday).post(addLog);
router.delete('/:id', deleteLog);
router.get('/history', getHistory);
router.put('/goal', setGoal);

module.exports = router;
