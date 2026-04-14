const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/stats',               taskController.getTaskStats);
router.get('/',                    taskController.getTasks);
router.post('/',                   taskController.createTask);
router.get('/:id',                 taskController.getTaskById);
router.put('/:id',                 taskController.updateTask);
router.put('/:id/complete',        taskController.completeTask);
router.put('/:id/fail',            taskController.failTask);
router.put('/:id/checklist/:itemId', taskController.toggleChecklistItem);
router.delete('/:id',              taskController.deleteTask);

module.exports = router;
