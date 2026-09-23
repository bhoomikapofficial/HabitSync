const express = require('express');
const { protect } = require('../middleware/auth');
const { addLog, updateLog, deleteLog, getToday, getHistory } = require('../controllers/sleepController');

const router = express.Router();

router.use(protect);

router.post('/', addLog);
router.get('/today', getToday);
router.get('/history', getHistory);
router.route('/:id').put(updateLog).delete(deleteLog);

module.exports = router;
