const express = require('express');
const router = express.Router();
const purchaseItemController = require('../controllers/purchaseItem.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

router.route('/')
  .get(purchaseItemController.getPurchaseItems)
  .post(authorize('ADMIN', 'EMPLOYEE'), purchaseItemController.createPurchaseItem);

router.route('/:id')
  .get(purchaseItemController.getPurchaseItem)
  .put(authorize('ADMIN', 'EMPLOYEE'), purchaseItemController.updatePurchaseItem)
  .delete(authorize('ADMIN'), purchaseItemController.deletePurchaseItem);

module.exports = router;
