const Todo = require('../models/Todo');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay } = require('../utils/dateHelpers');

/**
 * Combines a todo's deadlineDate + optional deadlineTime into a single
 * Date used for overdue/reminder calculations. Missing time defaults to
 * end-of-day (23:59) so a todo isn't considered overdue before its day
 * has actually finished.
 */
const deadlineAsDate = (todo) => {
  const d = new Date(todo.deadlineDate);
  if (todo.deadlineTime) {
    const [hh, mm] = todo.deadlineTime.split(':').map(Number);
    d.setUTCHours(hh, mm, 0, 0);
  } else {
    d.setUTCHours(23, 59, 0, 0);
  }
  return d;
};

const isOverdue = (todo) => !todo.completed && deadlineAsDate(todo).getTime() < Date.now();

const serialize = (todo) => {
  const obj = todo.toObject ? todo.toObject() : todo;
  return { ...obj, overdue: isOverdue(obj) };
};

// @route   GET /api/todos?status=pending|completed|overdue
// @access  Private
const getTodos = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const query = { userId: req.userId };
  if (status === 'completed') query.completed = true;
  if (status === 'pending' || status === 'overdue') query.completed = false;

  let todos = await Todo.find(query).sort({ deadlineDate: 1, deadlineTime: 1 });
  todos = todos.map(serialize);

  if (status === 'overdue') {
    todos = todos.filter((t) => t.overdue);
  } else if (status === 'pending') {
    todos = todos.filter((t) => !t.overdue);
  }

  res.status(200).json({ success: true, data: { todos } });
});

// @route   GET /api/todos/:id
// @access  Private
const getTodoById = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId });

  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }

  res.status(200).json({ success: true, data: { todo: serialize(todo) } });
});

// @route   POST /api/todos
// @access  Private
const createTodo = asyncHandler(async (req, res) => {
  const { title, description, deadlineDate, deadlineTime, reminderEnabled } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Todo title is required' });
  }
  if (!deadlineDate) {
    return res.status(400).json({ success: false, message: 'A deadline date is required' });
  }

  const todo = await Todo.create({
    userId: req.userId,
    title: title.trim(),
    description,
    deadlineDate: startOfDay(deadlineDate),
    deadlineTime: deadlineTime || null,
    reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : true,
  });

  res.status(201).json({ success: true, message: 'Todo created', data: { todo: serialize(todo) } });
});

// @route   PUT /api/todos/:id
// @access  Private
const updateTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId });

  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }

  const { title, description, deadlineDate, deadlineTime, reminderEnabled, completed } = req.body;

  if (title !== undefined) todo.title = title.trim();
  if (description !== undefined) todo.description = description;
  if (deadlineDate !== undefined) todo.deadlineDate = startOfDay(deadlineDate);
  if (deadlineTime !== undefined) todo.deadlineTime = deadlineTime || null;
  if (reminderEnabled !== undefined) todo.reminderEnabled = Boolean(reminderEnabled);

  // Completion can also be toggled through this endpoint for convenience,
  // but the dedicated /complete endpoint below is the primary path.
  if (completed !== undefined) {
    todo.completed = Boolean(completed);
    todo.completedAt = todo.completed ? new Date() : null;
  }

  await todo.save();

  res.status(200).json({ success: true, message: 'Todo updated', data: { todo: serialize(todo) } });
});

// @route   DELETE /api/todos/:id
// @access  Private
const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }

  res.status(200).json({ success: true, message: 'Todo deleted' });
});

// @route   POST /api/todos/:id/complete
// @access  Private
// Marks (or unmarks) a todo as completed. Completing a todo stops all
// future reminders for it (reminders are only ever computed for
// incomplete todos - see the frontend's checkTodoReminders).
const markComplete = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId });

  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }

  const completed = req.body.completed !== undefined ? Boolean(req.body.completed) : true;
  todo.completed = completed;
  todo.completedAt = completed ? new Date() : null;
  await todo.save();

  res.status(200).json({ success: true, message: completed ? 'Todo completed' : 'Todo reopened', data: { todo: serialize(todo) } });
});

module.exports = { getTodos, getTodoById, createTodo, updateTodo, deleteTodo, markComplete, deadlineAsDate, isOverdue };
