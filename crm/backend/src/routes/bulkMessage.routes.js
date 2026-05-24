const express = require('express');
const router = express.Router();
const bulkMessageController = require('../controllers/bulkMessage.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/',     bulkMessageController.getCampaigns);
router.post('/',    bulkMessageController.createCampaign);
router.get('/:id',  bulkMessageController.getCampaignById);

module.exports = router;
