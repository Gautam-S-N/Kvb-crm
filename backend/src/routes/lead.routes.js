const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Lead CRUD
router.get('/', leadController.getLeads);
router.get('/check-duplicate', leadController.checkDuplicate);
router.post('/', leadController.createLead);
router.post('/import', leadController.importLeads);
router.get('/:id', leadController.getLeadById);
router.put('/:id', leadController.updateLead);
router.delete('/:id', authorize('ADMIN'), leadController.deleteLead);

// Lead assignment
router.post('/:id/assign', authorize('ADMIN', 'EMPLOYEE'), leadController.assignLead);

// Lead Notes tracking
router.post('/:id/notes', leadController.addNote);

// Detail Tabs tracking
router.post('/:id/followups', leadController.addFollowUp);
router.post('/:id/interactions', leadController.logInteraction);
router.post('/:id/products', leadController.addLeadProduct);
router.delete('/:id/products/:productId', leadController.removeLeadProduct);
router.post('/:id/timeline', leadController.addTimelineEvent);

module.exports = router;