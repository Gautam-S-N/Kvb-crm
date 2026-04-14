const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Public routes (all authenticated users)
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Admin only routes
router.post('/', authorize('ADMIN'), productController.createProduct);
router.put('/:id', authorize('ADMIN'), productController.updateProduct);
router.delete('/:id', authorize('ADMIN'), productController.deleteProduct);

module.exports = router;