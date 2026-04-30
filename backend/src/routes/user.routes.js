const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Employee list visible to employees too (for task assignment etc)
router.get('/', userController.getUsers);

// Fetch only valid subordinates for the current user (used in dropdowns)
router.get('/subordinates/list', userController.getSubordinateUsers);

// Only admins can create new employees directly
router.post('/', authorize('ADMIN'), userController.createUser);

router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.get('/:id/audit', userController.getPermissionAuditLogs);

module.exports = router;