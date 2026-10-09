const express = require('express');
const { protect } = require('../middleware/auth');
const { getTodos, getTodoById, createTodo, updateTodo, deleteTodo, markComplete } = require('../controllers/todoController');

const router = express.Router();

router.use(protect);

router.route('/').get(getTodos).post(createTodo);
router.route('/:id').get(getTodoById).put(updateTodo).delete(deleteTodo);
router.post('/:id/complete', markComplete);

module.exports = router;
