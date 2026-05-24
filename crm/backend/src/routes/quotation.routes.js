const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const qnController = require('../controllers/quotationNumber.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// ── Number management (admin) ──────────────────────────────────────────────
router.get('/counters', authorize('ADMIN'), qnController.getCounters);
router.put('/counters/:productCode', authorize('ADMIN'), qnController.updateCounter);

// ── Reservation (any authenticated user) ──────────────────────────────────
router.post('/reserve', qnController.reserveNumber);
router.delete('/reserve/:id', qnController.releaseReservation);

// ── Product summary ────────────────────────────────────────────────────────
router.get('/product-summary', quotationController.getQuotationsByProduct);

// ── Standard CRUD ─────────────────────────────────────────────────────────
router.get('/', quotationController.getQuotations);
router.post('/', quotationController.createQuotation);
router.get('/:id', quotationController.getQuotationById);
router.get('/:id/pdf', quotationController.generatePDF);
router.get('/:id/docx', quotationController.generateDOCX);
router.post('/:id/convert', quotationController.convertToSale);

// ── Versioning ─────────────────────────────────────────────────────────────
router.get('/:id/next-revision', qnController.getNextRevisionInfo);
router.get('/:id/versions', qnController.getVersionHistory);
router.post('/:id/revise', qnController.reviseQuotation);

module.exports = router;