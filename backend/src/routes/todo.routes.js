const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todo.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/',                              todoController.getTodos);
router.post('/',                             todoController.createTodo);
router.put('/:id',                           todoController.updateTodo);
router.put('/:id/complete',                  todoController.completeTodo);
router.put('/:id/checklist/:itemId/toggle',  todoController.toggleTodoChecklist);
router.delete('/:id',                        todoController.deleteTodo);

module.exports = router;
