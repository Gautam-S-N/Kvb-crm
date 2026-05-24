const express = require('express');
const router = express.Router();
const settingController = require('../controllers/setting.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Only admins can tweak global company settings
router.get('/', authorize('ADMIN'), settingController.getSettings);
router.put('/:key', authorize('ADMIN'), settingController.updateSetting);

module.exports = router;
