const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const { todayRange, currentMonthRange } = require('../utils/dateHelpers');
const { budgetWarningInsight } = require('../utils/insights');

// @route   GET /api/expenses
// @access  Private
// Supports optional ?from=&to=&category= query filters; defaults to current month.
const getExpenses = asyncHandler(async (req, res) => {
  const { from, to, category } = req.query;

  const query = { userId: req.userId };

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  } else {
    const { start, end } = currentMonthRange();
    query.date = { $gte: start, $lt: end };
  }

  if (category) {
    query.category = category;
  }

  const expenses = await Expense.find(query).sort({ date: -1 });
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  res.status(200).json({ success: true, data: { expenses, total, categories: Expense.CATEGORIES } });
});

// @route   POST /api/expenses
// @access  Private
const createExpense = asyncHandler(async (req, res) => {
  const { amount, category, description, date } = req.body;

  if (amount === undefined || amount === null || amount < 0) {
    return res.status(400).json({ success: false, message: 'A valid non-negative amount is required' });
  }

  const expense = await Expense.create({
    userId: req.userId,
    amount,
    category,
    description,
    date: date ? new Date(date) : new Date(),
  });

  res.status(201).json({ success: true, message: 'Expense added', data: { expense } });
});

// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, userId: req.userId });

  if (!expense) {
    return res.status(404).json({ success: false, message: 'Expense not found' });
  }

  const { amount, category, description, date } = req.body;

  if (amount !== undefined) expense.amount = amount;
  if (category !== undefined) expense.category = category;
  if (description !== undefined) expense.description = description;
  if (date !== undefined) expense.date = new Date(date);

  await expense.save();

  res.status(200).json({ success: true, message: 'Expense updated', data: { expense } });
});

// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!expense) {
    return res.status(404).json({ success: false, message: 'Expense not found' });
  }

  res.status(200).json({ success: true, message: 'Expense deleted' });
});

// @route   GET /api/expenses/summary
// @access  Private
// Returns today's total, current month's total, category breakdown, and
// a budget warning message if applicable.
const getSummary = asyncHandler(async (req, res) => {
  const todayBounds = todayRange();
  const monthBounds = currentMonthRange();

  const [todayExpenses, monthExpenses] = await Promise.all([
    Expense.find({ userId: req.userId, date: { $gte: todayBounds.start, $lt: todayBounds.end } }),
    Expense.find({ userId: req.userId, date: { $gte: monthBounds.start, $lt: monthBounds.end } }),
  ]);

  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryBreakdown = {};
  monthExpenses.forEach((e) => {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
  });

  const budget = req.user.monthlyBudget || 0;
  const budgetWarning = budgetWarningInsight(monthTotal, budget);
  const budgetUtilization = budget > 0 ? Math.round((monthTotal / budget) * 100) : null;
  // Budget difference = Monthly budget - Current-month expense.
  // Negative means overspending; only meaningful once a budget is set.
  const budgetDifference = budget > 0 ? budget - monthTotal : null;
  const overspending = budgetDifference !== null && budgetDifference < 0;

  res.status(200).json({
    success: true,
    data: {
      todayTotal,
      monthTotal,
      categoryBreakdown,
      budget,
      budgetUtilization,
      budgetDifference,
      overspending,
      budgetWarning,
    },
  });
});

// @route   PUT /api/expenses/budget
// @access  Private
const setBudget = asyncHandler(async (req, res) => {
  const { monthlyBudget } = req.body;

  if (monthlyBudget === undefined || monthlyBudget < 0) {
    return res.status(400).json({ success: false, message: 'A valid non-negative monthly budget is required' });
  }

  req.user.monthlyBudget = monthlyBudget;
  await req.user.save();

  res.status(200).json({ success: true, message: 'Monthly budget updated', data: { monthlyBudget: req.user.monthlyBudget } });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense, getSummary, setBudget };
