const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSummary,
  setBudget,
} = require('../controllers/expenseController');

const router = express.Router();

router.use(protect);

router.route('/').get(getExpenses).post(createExpense);
router.get('/summary', getSummary);
router.put('/budget', setBudget);
router.route('/:id').put(updateExpense).delete(deleteExpense);

module.exports = router;
