const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');
const historyController = require('../controllers/materialUsageHistory.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

// All inventory routes are protected
router.use(authMiddleware);

router.get('/', materialController.getMaterials);
router.get('/stock-summary', materialController.getStockSummary);
router.get('/:id/history', historyController.getByMaterial);
router.get('/:id', materialController.getMaterialById);

// Only administrators can modify inventory
router.post('/', authorize('ADMIN'), materialController.createMaterial);
router.put('/:id', authorize('ADMIN'), materialController.updateMaterial);
router.delete('/:id', authorize('ADMIN'), materialController.deleteMaterial);
router.patch('/:id/stock', authorize('ADMIN'), materialController.updateStock);

module.exports = router;
