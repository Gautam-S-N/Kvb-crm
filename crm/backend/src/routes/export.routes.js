const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/:type', exportController.exportData);

module.exports = router;
