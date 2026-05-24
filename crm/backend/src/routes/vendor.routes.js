const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/',     vendorController.getVendors);
router.post('/',    authorize('ADMIN'), vendorController.createVendor);
router.get('/:id',  vendorController.getVendorById);
router.put('/:id',  authorize('ADMIN'), vendorController.updateVendor);
router.delete('/:id', authorize('ADMIN'), vendorController.deleteVendor);

module.exports = router;
