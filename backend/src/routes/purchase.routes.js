const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/',           purchaseController.getPurchaseOrders);
router.post('/',          purchaseController.createPurchaseOrder);
router.get('/:id',        purchaseController.getPurchaseOrderById);
router.put('/:id',        purchaseController.updatePurchaseOrder);
router.get('/:id/pdf',    purchaseController.generatePOPDF);
router.get('/:id/docx',   purchaseController.generatePODOCX);
router.get('/:id/xlsx',   purchaseController.generatePOXLSX);

module.exports = router;
