const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const { authMiddleware } = require('../middleware/auth.middleware');
const { requireModule, requireElevated } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/materialRequest.controller');

// Voice upload storage (mirrors existing tasks voice pattern)
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/voice/material-requests');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `mr-voice-${Date.now()}.webm`),
});
const upload = multer({ storage: voiceStorage });

router.use(authMiddleware);
router.use(requireModule('MATERIAL_REQUESTS'));

// Read — any authenticated user with module access
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// Write — requires elevated perm OR admin (checked in requireElevated — admin bypasses)
router.post('/',    requireElevated('canCreateMaterialRequests'), ctrl.create);
router.put('/:id',  requireElevated('canCreateMaterialRequests'), ctrl.update);
router.delete('/:id', requireElevated('canCreateMaterialRequests'), ctrl.remove);

// Status update — assignee or elevated (permission checked in controller)
router.patch('/:id/status', upload.single('voiceNote'), ctrl.updateStatus);

// Toggle purchase status on individual items — admin/elevated or assignee
router.patch(
  '/:id/items/:itemId/purchased',
  ctrl.toggleItemPurchased
);

module.exports = router;
