const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', saleController.getSales);
router.post('/', saleController.createSale);
router.get('/:id', saleController.getSaleById);
router.put('/:id', saleController.updateSale);
router.post('/:id/payments', saleController.recordPayment);
router.get('/:id/invoice', saleController.generateInvoice);

module.exports = router;
