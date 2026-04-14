const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLog.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);
router.use(authorize('ADMIN'));

router.get('/', activityLogController.getActivityLogs);

module.exports = router;
