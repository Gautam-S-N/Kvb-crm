const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/collectionTask.controller');

router.use(authMiddleware);

// Employees see their own tasks; admins can filter by assignedToId
router.get('/', ctrl.getMyTasks);

// Employee marks a task collected
router.patch('/:taskId/collect', ctrl.markCollected);

module.exports = router;
