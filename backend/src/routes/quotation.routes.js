const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/product-summary', quotationController.getQuotationsByProduct);
router.get('/', quotationController.getQuotations);
router.post('/', quotationController.createQuotation);
router.get('/:id', quotationController.getQuotationById);
router.get('/:id/pdf', quotationController.generatePDF);
router.get('/:id/docx', quotationController.generateDOCX);
router.post('/:id/convert', quotationController.convertToSale);

module.exports = router;