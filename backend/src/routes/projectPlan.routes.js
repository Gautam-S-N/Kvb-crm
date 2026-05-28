const express = require('express');
const router  = express.Router();
const { authMiddleware }  = require('../middleware/auth.middleware');
const { requireModule, requireElevated } = require('../middleware/permission.middleware');
const ctrl        = require('../controllers/projectPlan.controller');
const historyCtrl = require('../controllers/materialUsageHistory.controller');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { eq } = require('drizzle-orm');

// Ownership check middleware: allow Admins, globally elevated users, or the plan creator
const requirePlanOwnerOrElevated = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (req.user.role === 'ADMIN') return next();

    // Check global permission
    if (req.user.canCreateProjectPlans === true) return next();

    // Otherwise, check plan creator
    const planId = req.params.id;
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID required' });

    const plan = await db.select({ createdById: schema.projectPlans.createdById })
      .from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, planId))
      .limit(1)
      .then(r => r[0]);

    if (!plan) return res.status(404).json({ success: false, message: 'Project plan not found' });

    if (plan.createdById === req.user.id) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied: You must be the creator of this project plan or an Admin to edit it'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Authorization check failed' });
  }
};

router.use(authMiddleware);
router.use(requireModule('PROJECT_PLANS'));

// Plan CRUD
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/history', historyCtrl.getByProject);

router.post('/',   requireElevated('canCreateProjectPlans'), ctrl.create);
router.put('/:id', requirePlanOwnerOrElevated, ctrl.update);
router.delete('/:id', requirePlanOwnerOrElevated, ctrl.remove);
router.patch('/:id/status', requirePlanOwnerOrElevated, ctrl.updateStatus);

// Item management
router.post('/:id/items',           requirePlanOwnerOrElevated, ctrl.addItems);
router.put('/:id/items/:itemId',    requirePlanOwnerOrElevated, ctrl.updateItem);
router.delete('/:id/items/:itemId', requirePlanOwnerOrElevated, ctrl.removeItem);

// Fulfillment actions
router.post('/:id/items/:itemId/reserve',          requireElevated('canCreateProjectPlans'), ctrl.reserveFromInventory);
router.post('/:id/items/:itemId/po',               requireElevated('canCreateProjectPlans'), ctrl.raisePurchaseOrder);
router.post('/:id/items/:itemId/collection-tasks', requireElevated('canCreateProjectPlans'), ctrl.assignCollectionTask);

module.exports = router;
