const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Employee list visible to employees too (for task assignment etc)
router.get('/', userController.getUsers);

// Fetch only valid subordinates for the current user (used in dropdowns)
router.get('/subordinates/list', userController.getSubordinateUsers);

// Admin: count employees with no manager assigned
router.get('/unassigned-count', authorize('ADMIN'), userController.getUnassignedCount);

// Only admins can create new employees directly
router.post('/', authorize('ADMIN'), userController.createUser);

router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.post('/:id/transfer-subordinates', authorize('ADMIN'), userController.transferSubordinates);
router.get('/:id/audit', userController.getPermissionAuditLogs);
router.delete('/:id', authorize('ADMIN'), userController.deleteUser);

module.exports = router;