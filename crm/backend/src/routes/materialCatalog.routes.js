const express = require('express');
const router = express.Router();
const materialCatalogController = require('../controllers/materialCatalog.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

// All catalog routes are protected
router.use(authMiddleware);

router.get('/', materialCatalogController.getMaterials);
router.get('/:id', materialCatalogController.getMaterialById);

// Only administrators can modify material catalog
router.post('/', authorize('ADMIN'), materialCatalogController.createMaterial);
router.put('/:id', authorize('ADMIN'), materialCatalogController.updateMaterial);
router.delete('/:id', authorize('ADMIN'), materialCatalogController.deleteMaterial);

module.exports = router;
