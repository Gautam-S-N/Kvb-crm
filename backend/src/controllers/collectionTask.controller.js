const { eq, and, inArray, sql, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// ── GET /api/collection-tasks ─────────────────────────────────────────────────
exports.getMyTasks = async (req, res) => {
  try {
    const { assignedToId, status } = req.query;
    const user = req.user;

    // Employees only see their own tasks
    const targetId = (user.role === 'ADMIN' && assignedToId) ? assignedToId : user.id;

    const conditions = [eq(schema.projectCollectionTasks.assignedToId, targetId)];
    if (status) conditions.push(eq(schema.projectCollectionTasks.status, status));

    const tasks = await db.select({
      id:            schema.projectCollectionTasks.id,
      projectPlanId: schema.projectCollectionTasks.projectPlanId,
      projectItemId: schema.projectCollectionTasks.projectItemId,
      assignedToId:  schema.projectCollectionTasks.assignedToId,
      assignedById:  schema.projectCollectionTasks.assignedById,
      qtyToCollect:  schema.projectCollectionTasks.qtyToCollect,
      qtyCollected:  schema.projectCollectionTasks.qtyCollected,
      status:        schema.projectCollectionTasks.status,
      note:          schema.projectCollectionTasks.note,
      collectedAt:   schema.projectCollectionTasks.collectedAt,
      createdAt:     schema.projectCollectionTasks.createdAt,
      projectName:   schema.projectPlans.projectName,
      place:         schema.projectPlans.place,
      itemName:      schema.projectPlanItems.itemName,
      size:          schema.projectPlanItems.size,
      category:      schema.projectPlanItems.category,
    })
    .from(schema.projectCollectionTasks)
    .leftJoin(schema.projectPlans, eq(schema.projectCollectionTasks.projectPlanId, schema.projectPlans.id))
    .leftJoin(schema.projectPlanItems, eq(schema.projectCollectionTasks.projectItemId, schema.projectPlanItems.id))
    .where(and(...conditions))
    .orderBy(desc(schema.projectCollectionTasks.createdAt));

    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/collection-tasks/:taskId/collect ───────────────────────────────
exports.markCollected = async (req, res) => {
  try {
    const { actualQty, note } = req.body;
    const qty = Number(actualQty);
    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'actualQty must be a positive number' });
    }

    const task = await db.select().from(schema.projectCollectionTasks)
      .where(eq(schema.projectCollectionTasks.id, req.params.taskId)).limit(1).then(r => r[0]);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (task.assignedToId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (task.status === 'COLLECTED') {
      return res.status(400).json({ success: false, message: 'Task already marked as collected' });
    }

    // Get the project plan item for materialId and history
    const item = await db.select().from(schema.projectPlanItems)
      .where(eq(schema.projectPlanItems.id, task.projectItemId)).limit(1).then(r => r[0]);
    if (!item || !item.inventoryItemId) {
      return res.status(400).json({ success: false, message: 'No inventory item linked to this task' });
    }

    const plan = await db.select().from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, task.projectPlanId)).limit(1).then(r => r[0]);

    await db.transaction(async (tx) => {
      // 1. Update collection task
      await tx.update(schema.projectCollectionTasks)
        .set({
          status: 'COLLECTED',
          qtyCollected: String(qty),
          collectedAt: new Date(),
          note: note || task.note,
          updatedAt: new Date(),
        })
        .where(eq(schema.projectCollectionTasks.id, req.params.taskId));

      // 2. Update item collected qty
      await tx.update(schema.projectPlanItems)
        .set({
          collectedQty: sql`collectedQty + ${qty}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.projectPlanItems.id, task.projectItemId));

      // 3. Hard deduction from inventory (actual balance reduction happens here)
      await tx.update(schema.materials)
        .set({
          balance: sql`balance - ${qty}`,
          outQty:  sql`outQty + ${qty}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.materials.id, item.inventoryItemId));

      // 4. Update reservation released qty + status
      const reservations = await tx.select()
        .from(schema.projectInventoryReservations)
        .where(
          and(
            eq(schema.projectInventoryReservations.projectItemId, task.projectItemId),
            inArray(schema.projectInventoryReservations.status, ['ACTIVE', 'PARTIALLY_RELEASED'])
          )
        )
        .limit(1);

      if (reservations.length > 0) {
        const res_rec = reservations[0];
        const newReleasedQty = Number(res_rec.releasedQty) + qty;
        const newStatus = newReleasedQty >= Number(res_rec.reservedQty)
          ? 'FULLY_RELEASED' : 'PARTIALLY_RELEASED';

        await tx.update(schema.projectInventoryReservations)
          .set({
            releasedQty: String(newReleasedQty),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(schema.projectInventoryReservations.id, res_rec.id));
      }

      // 5. Log history
      await tx.insert(schema.materialUsageHistory).values({
        id: randomUUID(),
        materialId: item.inventoryItemId,
        projectPlanId: task.projectPlanId,
        projectName: plan?.projectName || 'Unknown',
        action: 'COLLECTED',
        qty: String(qty),
        performedById: req.user.id,
        note: note || `Collected for project: ${plan?.projectName || ''}`,
        financialYear: plan?.financialYear || null,
        createdAt: new Date(),
      });
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIALS' });
    res.json({ success: true, message: `${qty} units collected and inventory updated.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
