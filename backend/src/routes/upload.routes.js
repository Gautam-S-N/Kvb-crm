const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// POST /api/upload/voice/:taskId/:noteType  (assign | complete)
router.post('/voice/:taskId/:noteType', uploadController.uploadVoiceNote);

// GET  /api/files/voice/tasks/:taskId/:filename
router.get('/voice/tasks/:taskId/:filename', uploadController.serveVoiceFile);

// POST /api/upload/image/:taskId
router.post('/image/:taskId', uploadController.uploadImage);

// GET /api/files/images/tasks/:taskId/:filename
router.get('/image/tasks/:taskId/:filename', uploadController.serveImageFile);

module.exports = router;
