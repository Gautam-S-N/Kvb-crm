const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { requireElevated } = require('../middleware/permission.middleware');

router.use(authMiddleware);

router.get('/stats',               taskController.getTaskStats);
router.get('/',                    taskController.getTasks);
router.post('/',                   requireElevated('canAssignTasks'), taskController.createTask);
router.get('/:id',                 taskController.getTaskById);
router.put('/:id',                 requireElevated('canAssignTasks'), taskController.updateTask);
router.put('/:id/complete',        taskController.completeTask);
router.put('/:id/fail',            taskController.failTask);
router.put('/:id/checklist/:itemId', taskController.toggleChecklistItem);
router.delete('/:id',              requireElevated('canAssignTasks'), taskController.deleteTask);

module.exports = router;
