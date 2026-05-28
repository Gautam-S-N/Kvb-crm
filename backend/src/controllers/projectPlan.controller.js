const { eq, and, inArray, sql, desc, or } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');
const { getFinancialYear } = require('../utils/financialYear');

// ── Helpers ──────────────────────────────────────────────────────────────────

const canManage = (user) =>
  user.role === 'ADMIN' || user.canCreateProjectPlans === true;

// Compute effective available balance for a material accounting for active reservations
async function getEffectiveBalance(materialId) {
  const mat = await db.select({ balance: schema.materials.balance })
    .from(schema.materials)
    .where(eq(schema.materials.id, materialId))
    .limit(1);
  if (!mat.length) return 0;

  const reserved = await db.select({ total: sql`COALESCE(SUM(reservedQty - releasedQty), 0)` })
    .from(schema.projectInventoryReservations)
    .where(
      and(
        eq(schema.projectInventoryReservations.materialId, materialId),
        inArray(schema.projectInventoryReservations.status, ['ACTIVE', 'PARTIALLY_RELEASED'])
      )
    );
  return Number(mat[0].balance) - Number(reserved[0].total);
}

// ── GET /api/project-plans ────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 100 } = req.query;
    const fy = req.query.fy;
    // If fy is missing, empty, or 'ALL', show all years; otherwise filter by specific FY
    const conditions = [];
    if (fy && fy !== 'ALL' && fy !== 'all') {
      conditions.push(eq(schema.projectPlans.financialYear, fy));
    }

    if (status) conditions.push(eq(schema.projectPlans.status, status));

    const parsedPage  = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip        = (parsedPage - 1) * parsedLimit;

    // Build where clause — undefined when no conditions (show all years)
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schema.projectPlans)
      .where(whereClause);
    const total = Number(totalResult[0]?.count || 0);

    const plansRaw = await db.select({
      id:            schema.projectPlans.id,
      projectName:   schema.projectPlans.projectName,
      place:         schema.projectPlans.place,
      status:        schema.projectPlans.status,
      financialYear: schema.projectPlans.financialYear,
      isArchived:    schema.projectPlans.isArchived,
      completedAt:   schema.projectPlans.completedAt,
      createdById:   schema.projectPlans.createdById,
      createdAt:     schema.projectPlans.createdAt,
      updatedAt:     schema.projectPlans.updatedAt,
      createdByFirstName: schema.users.firstName,
      createdByLastName:  schema.users.lastName,
    })
    .from(schema.projectPlans)
    .leftJoin(schema.users, eq(schema.projectPlans.createdById, schema.users.id))
    .where(whereClause)
    .orderBy(desc(schema.projectPlans.createdAt))
    .limit(parsedLimit)
    .offset(skip);

    // Batch-fetch item metrics
    let planMetrics = {};
    if (plansRaw.length > 0) {
      const planIds = plansRaw.map(p => p.id);
      const metrics = await db.select({
        projectPlanId: schema.projectPlanItems.projectPlanId,
        itemCount: sql`count(*)`,
        totalPlanned: sql`COALESCE(SUM(quantity), 0)`,
        totalReserved: sql`COALESCE(SUM(reservedQty), 0)`,
        totalCollected: sql`COALESCE(SUM(collectedQty), 0)`,
        totalPoQty: sql`COALESCE(SUM(CASE WHEN fulfillmentType = 'PURCHASE_ORDER' OR purchaseOrderId IS NOT NULL THEN GREATEST(0, quantity - reservedQty) ELSE 0 END), 0)`,
      })
      .from(schema.projectPlanItems)
      .where(inArray(schema.projectPlanItems.projectPlanId, planIds))
      .groupBy(schema.projectPlanItems.projectPlanId);

      for (const m of metrics) {
        planMetrics[m.projectPlanId] = {
          itemCount: Number(m.itemCount),
          totalPlanned: Number(m.totalPlanned),
          totalReserved: Number(m.totalReserved),
          totalCollected: Number(m.totalCollected),
          totalPoQty: Number(m.totalPoQty),
        };
      }
    }

    const plans = plansRaw.map(p => {
      const metrics = planMetrics[p.id] || { itemCount: 0, totalPlanned: 0, totalReserved: 0, totalCollected: 0, totalPoQty: 0 };
      const totalPlanned = metrics.totalPlanned;
      const progressNumerator = metrics.totalReserved + metrics.totalCollected + metrics.totalPoQty;
      const progressPercent = totalPlanned > 0
        ? Math.min(100, Math.round((progressNumerator / totalPlanned) * 100))
        : 0;

      return {
        id: p.id,
        projectName: p.projectName,
        place: p.place,
        status: p.status,
        financialYear: p.financialYear,
        isArchived: p.isArchived,
        completedAt: p.completedAt,
        createdById: p.createdById,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdByFirstName ? { firstName: p.createdByFirstName, lastName: p.createdByLastName } : null,
        itemCount: metrics.itemCount,
        progressPercent,
        metrics,
      };
    });

    res.json({ success: true, data: plans, pagination: { total, page: parsedPage, limit: parsedLimit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/project-plans/:id ────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const planRows = await db.select({
      id: schema.projectPlans.id, projectName: schema.projectPlans.projectName,
      place: schema.projectPlans.place, status: schema.projectPlans.status,
      financialYear: schema.projectPlans.financialYear, isArchived: schema.projectPlans.isArchived,
      completedAt: schema.projectPlans.completedAt, createdById: schema.projectPlans.createdById,
      createdAt: schema.projectPlans.createdAt, updatedAt: schema.projectPlans.updatedAt,
      createdByFirstName: schema.users.firstName, createdByLastName: schema.users.lastName,
    })
    .from(schema.projectPlans)
    .leftJoin(schema.users, eq(schema.projectPlans.createdById, schema.users.id))
    .where(eq(schema.projectPlans.id, req.params.id))
    .limit(1);

    if (!planRows.length) return res.status(404).json({ success: false, message: 'Project not found' });

    const raw = planRows[0];
    const plan = {
      ...raw,
      createdBy: raw.createdByFirstName ? { firstName: raw.createdByFirstName, lastName: raw.createdByLastName } : null,
    };

    // Fetch items
    const items = await db.select({
      id: schema.projectPlanItems.id,
      projectPlanId: schema.projectPlanItems.projectPlanId,
      category: schema.projectPlanItems.category,
      itemName: schema.projectPlanItems.itemName,
      size: schema.projectPlanItems.size,
      quantity: schema.projectPlanItems.quantity,
      supplierName: schema.projectPlanItems.supplierName,
      remarks: schema.projectPlanItems.remarks,
      fulfillmentType: schema.projectPlanItems.fulfillmentType,
      reservedQty: schema.projectPlanItems.reservedQty,
      collectedQty: schema.projectPlanItems.collectedQty,
      inventoryItemId: schema.projectPlanItems.inventoryItemId,
      purchaseOrderId: schema.projectPlanItems.purchaseOrderId,
      poNumber: schema.purchaseOrders.poNumber,
    })
    .from(schema.projectPlanItems)
    .leftJoin(schema.purchaseOrders, eq(schema.projectPlanItems.purchaseOrderId, schema.purchaseOrders.id))
    .where(eq(schema.projectPlanItems.projectPlanId, plan.id));

    // Split by category
    plan.rawMaterials = items.filter(i => i.category === 'RAW_MATERIAL');
    plan.bopItems     = items.filter(i => i.category === 'BOP');

    // Fetch inventory info for all items (by itemName, case-insensitive match)
    const itemNames = [...new Set(items.map(i => i.itemName.toLowerCase()))];
    let inventoryMap = {};
    if (itemNames.length > 0) {
      // Get all materials and build a name-keyed map
      const allMats = await db.select({
        id: schema.materials.id,
        itemName: schema.materials.itemName,
        balance: schema.materials.balance,
      }).from(schema.materials);

      for (const m of allMats) {
        const key = m.itemName.toLowerCase();
        if (!inventoryMap[key]) inventoryMap[key] = m;
      }

      // Get active reservation totals per material to compute effective balance
      const matIds = [...new Set(Object.values(inventoryMap).map(m => m.id))];
      if (matIds.length > 0) {
        const reservedTotals = await db.select({
          materialId: schema.projectInventoryReservations.materialId,
          total: sql`COALESCE(SUM(reservedQty - releasedQty), 0)`,
        })
        .from(schema.projectInventoryReservations)
        .where(
          and(
            inArray(schema.projectInventoryReservations.materialId, matIds),
            inArray(schema.projectInventoryReservations.status, ['ACTIVE', 'PARTIALLY_RELEASED'])
          )
        )
        .groupBy(schema.projectInventoryReservations.materialId);

        const reservedMap = {};
        for (const r of reservedTotals) reservedMap[r.materialId] = Number(r.total);

        for (const key of Object.keys(inventoryMap)) {
          const m = inventoryMap[key];
          inventoryMap[key] = {
            ...m,
            effectiveBalance: Number(m.balance) - (reservedMap[m.id] || 0),
          };
        }
      }
    }

    plan.inventoryMap = inventoryMap;

    // Fetch collection tasks for this plan
    const tasks = await db.select({
      id: schema.projectCollectionTasks.id,
      projectItemId: schema.projectCollectionTasks.projectItemId,
      assignedToId: schema.projectCollectionTasks.assignedToId,
      qtyToCollect: schema.projectCollectionTasks.qtyToCollect,
      qtyCollected: schema.projectCollectionTasks.qtyCollected,
      status: schema.projectCollectionTasks.status,
      note: schema.projectCollectionTasks.note,
      collectedAt: schema.projectCollectionTasks.collectedAt,
      createdAt: schema.projectCollectionTasks.createdAt,
      assigneeFirstName: schema.users.firstName,
      assigneeLastName: schema.users.lastName,
    })
    .from(schema.projectCollectionTasks)
    .leftJoin(schema.users, eq(schema.projectCollectionTasks.assignedToId, schema.users.id))
    .where(eq(schema.projectCollectionTasks.projectPlanId, plan.id));

    plan.collectionTasks = tasks.map(t => ({
      ...t,
      assignedTo: t.assigneeFirstName ? { firstName: t.assigneeFirstName, lastName: t.assigneeLastName } : null,
    }));

    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/project-plans ───────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { projectName, place, rawMaterials = [], bopItems = [] } = req.body;
    if (!projectName || !place) {
      return res.status(400).json({ success: false, message: 'projectName and place are required' });
    }

    const planId = randomUUID();
    const fy     = getFinancialYear();

    const planData = {
      id: planId, projectName, place,
      status: 'ACTIVE', financialYear: fy,
      isArchived: false, completedAt: null,
      createdById: req.user.id,
      createdAt: new Date(), updatedAt: new Date(),
    };

    // Fetch all materials and active reservations to compute current available stock
    const materialsList = await db.select().from(schema.materials);
    const reservationsList = await db.select({
      materialId: schema.projectInventoryReservations.materialId,
      total: sql`COALESCE(SUM(reservedQty - releasedQty), 0)`,
    })
    .from(schema.projectInventoryReservations)
    .where(inArray(schema.projectInventoryReservations.status, ['ACTIVE', 'PARTIALLY_RELEASED']))
    .groupBy(schema.projectInventoryReservations.materialId);

    const reservedMap = {};
    for (const r of reservationsList) {
      reservedMap[r.materialId] = Number(r.total);
    }

    const inventoryReservationsToInsert = [];
    const usageHistoryToInsert = [];

    const buildItems = (arr, category) =>
      arr.filter(i => i.itemName?.trim()).map(i => {
        const itemId = randomUUID();
        const itemNameTrimmed = i.itemName.trim();
        const plannedQty = Number(i.quantity || 0);

        let reservedQtyVal = 0;
        let fulfillmentTypeVal = 'PENDING';
        let matchedMaterialId = null;

        // Try to match inventory case-insensitively
        const matchedMat = materialsList.find(m => m.itemName.toLowerCase() === itemNameTrimmed.toLowerCase());
        if (matchedMat && plannedQty > 0) {
          const effectiveAvailable = Math.max(0, Number(matchedMat.balance) - (reservedMap[matchedMat.id] || 0));
          if (effectiveAvailable > 0) {
            reservedQtyVal = Math.min(plannedQty, effectiveAvailable);
            reservedMap[matchedMat.id] = (reservedMap[matchedMat.id] || 0) + reservedQtyVal;
            fulfillmentTypeVal = 'INVENTORY';
            matchedMaterialId = matchedMat.id;

            // Prepare reservation record
            inventoryReservationsToInsert.push({
              id: randomUUID(),
              projectPlanId: planId,
              projectItemId: itemId,
              materialId: matchedMat.id,
              reservedQty: String(reservedQtyVal),
              releasedQty: '0.00',
              status: 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Prepare history log
            usageHistoryToInsert.push({
              id: randomUUID(),
              materialId: matchedMat.id,
              projectPlanId: planId,
              projectName: projectName,
              action: 'RESERVED',
              qty: String(reservedQtyVal),
              performedById: req.user.id,
              note: `Auto-reserved on project creation: ${projectName}`,
              financialYear: fy,
              createdAt: new Date(),
            });
          }
        }

        return {
          id: itemId,
          projectPlanId: planId,
          category,
          itemName: itemNameTrimmed,
          size: i.size || null,
          quantity: String(plannedQty),
          supplierName: i.supplierName || null,
          remarks: i.remarks || null,
          fulfillmentType: fulfillmentTypeVal,
          reservedQty: String(reservedQtyVal),
          collectedQty: '0.00',
          inventoryItemId: matchedMaterialId,
          purchaseOrderId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

    const allItems = [
      ...buildItems(rawMaterials, 'RAW_MATERIAL'),
      ...buildItems(bopItems, 'BOP'),
    ];

    await db.transaction(async (tx) => {
      await tx.insert(schema.projectPlans).values(planData);
      if (allItems.length > 0) {
        await tx.insert(schema.projectPlanItems).values(allItems);
      }
      if (inventoryReservationsToInsert.length > 0) {
        await tx.insert(schema.projectInventoryReservations).values(inventoryReservationsToInsert);
      }
      if (usageHistoryToInsert.length > 0) {
        await tx.insert(schema.materialUsageHistory).values(usageHistoryToInsert);
      }
    });

    const created = { 
      ...planData, 
      rawMaterials: allItems.filter(i => i.category === 'RAW_MATERIAL'), 
      bopItems: allItems.filter(i => i.category === 'BOP') 
    };
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIALS' });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/project-plans/:id ────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { projectName, place } = req.body;
    const existing = await db.select().from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, req.params.id)).limit(1);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    const upd = { updatedAt: new Date() };
    if (projectName !== undefined) upd.projectName = projectName;
    if (place !== undefined) upd.place = place;

    await db.update(schema.projectPlans).set(upd).where(eq(schema.projectPlans.id, req.params.id));
    const updated = await db.select().from(schema.projectPlans).where(eq(schema.projectPlans.id, req.params.id)).limit(1);

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/project-plans/:id ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const plan = await db.select().from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, req.params.id)).limit(1).then(r => r[0]);
    if (!plan) return res.status(404).json({ success: false, message: 'Not found' });
    if (plan.status !== 'ACTIVE') return res.status(400).json({ success: false, message: 'Can only delete ACTIVE projects' });

    // Check for active reservations
    const activeRes = await db.select({ count: sql`count(*)` })
      .from(schema.projectInventoryReservations)
      .where(
        and(
          eq(schema.projectInventoryReservations.projectPlanId, req.params.id),
          inArray(schema.projectInventoryReservations.status, ['ACTIVE', 'PARTIALLY_RELEASED'])
        )
      );
    if (Number(activeRes[0]?.count) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete project with active inventory reservations' });
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.projectPlanItems).where(eq(schema.projectPlanItems.projectPlanId, req.params.id));
      await tx.delete(schema.projectPlans).where(eq(schema.projectPlans.id, req.params.id));
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/project-plans/:id/status ──────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['COMPLETE', 'NOT_COMPLETE', 'ACTIVE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be COMPLETE, NOT_COMPLETE, or ACTIVE' });
    }

    const plan = await db.select().from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, req.params.id)).limit(1).then(r => r[0]);
    if (!plan) return res.status(404).json({ success: false, message: 'Not found' });

    const upd = { status, updatedAt: new Date() };
    if (status === 'COMPLETE') upd.completedAt = new Date();

    await db.transaction(async (tx) => {
      await tx.update(schema.projectPlans).set(upd).where(eq(schema.projectPlans.id, req.params.id));

      if (status === 'COMPLETE' || status === 'NOT_COMPLETE') {
        // Close all active reservations (soft lock release — balance was never deducted, so no add-back needed)
        const reservations = await tx.select()
          .from(schema.projectInventoryReservations)
          .where(
            and(
              eq(schema.projectInventoryReservations.projectPlanId, req.params.id),
              inArray(schema.projectInventoryReservations.status, ['ACTIVE', 'PARTIALLY_RELEASED'])
            )
          );

        for (const res of reservations) {
          const unreleased = Number(res.reservedQty) - Number(res.releasedQty);
          if (unreleased > 0) {
            await tx.update(schema.projectInventoryReservations)
              .set({ status: 'FULLY_RELEASED', releasedQty: String(Number(res.reservedQty)), updatedAt: new Date() })
              .where(eq(schema.projectInventoryReservations.id, res.id));

            // Release the unused reservation in projectPlanItems
            await tx.update(schema.projectPlanItems)
              .set({
                reservedQty: res.releasedQty,
                fulfillmentType: Number(res.releasedQty) > 0 ? 'INVENTORY' : 'PENDING',
                updatedAt: new Date()
              })
              .where(eq(schema.projectPlanItems.id, res.projectItemId));

            // Get material name for item
            const item = await tx.select({ itemName: schema.projectPlanItems.itemName })
              .from(schema.projectPlanItems)
              .where(eq(schema.projectPlanItems.id, res.projectItemId))
              .limit(1).then(r => r[0]);

            await tx.insert(schema.materialUsageHistory).values({
              id: randomUUID(),
              materialId: res.materialId,
              projectPlanId: req.params.id,
              projectName: plan.projectName,
              action: 'RELEASED',
              qty: String(unreleased),
              performedById: req.user.id,
              note: `Auto-released on project status update (${status}): ${item?.itemName || 'unknown item'}`,
              financialYear: plan.financialYear,
              createdAt: new Date(),
            });
          }
        }
      }
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIALS' });
    const updated = await db.select().from(schema.projectPlans).where(eq(schema.projectPlans.id, req.params.id)).limit(1);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/project-plans/:id/items ────────────────────────────────────────
exports.addItems = async (req, res) => {
  try {
    const { items } = req.body; // [{ category, itemName, size, quantity, supplierName, remarks }]
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'items array required' });
    }
    const plan = await db.select().from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, req.params.id)).limit(1).then(r => r[0]);
    if (!plan) return res.status(404).json({ success: false, message: 'Not found' });

    const toInsert = items.filter(i => i.itemName?.trim()).map(i => ({
      id: randomUUID(), projectPlanId: req.params.id,
      category: i.category || 'RAW_MATERIAL',
      itemName: i.itemName.trim(),
      size: i.size || null, quantity: String(i.quantity || 0),
      supplierName: i.supplierName || null, remarks: i.remarks || null,
      fulfillmentType: 'PENDING', reservedQty: '0.00', collectedQty: '0.00',
      inventoryItemId: null, purchaseOrderId: null,
      createdAt: new Date(), updatedAt: new Date(),
    }));

    await db.insert(schema.projectPlanItems).values(toInsert);
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    res.status(201).json({ success: true, data: toInsert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/project-plans/:id/items/:itemId ──────────────────────────────────
exports.updateItem = async (req, res) => {
  try {
    const { itemName, size, quantity, supplierName, remarks, category } = req.body;
    const upd = { updatedAt: new Date() };
    if (itemName   !== undefined) upd.itemName   = itemName;
    if (size       !== undefined) upd.size       = size;
    if (quantity   !== undefined) upd.quantity   = String(quantity);
    if (supplierName !== undefined) upd.supplierName = supplierName;
    if (remarks    !== undefined) upd.remarks    = remarks;
    if (category   !== undefined) upd.category   = category;

    await db.update(schema.projectPlanItems).set(upd)
      .where(and(
        eq(schema.projectPlanItems.id, req.params.itemId),
        eq(schema.projectPlanItems.projectPlanId, req.params.id)
      ));
    const item = await db.select().from(schema.projectPlanItems)
      .where(eq(schema.projectPlanItems.id, req.params.itemId)).limit(1).then(r => r[0]);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/project-plans/:id/items/:itemId ───────────────────────────────
exports.removeItem = async (req, res) => {
  try {
    const item = await db.select().from(schema.projectPlanItems)
      .where(eq(schema.projectPlanItems.id, req.params.itemId)).limit(1).then(r => r[0]);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.fulfillmentType !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Cannot delete item with active reservation or PO' });
    }
    await db.delete(schema.projectPlanItems).where(eq(schema.projectPlanItems.id, req.params.itemId));
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/project-plans/:id/items/:itemId/reserve ────────────────────────
exports.reserveFromInventory = async (req, res) => {
  try {
    const item = await db.select().from(schema.projectPlanItems)
      .where(eq(schema.projectPlanItems.id, req.params.itemId)).limit(1).then(r => r[0]);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.fulfillmentType !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Item already reserved or has a PO' });
    }

    const plan = await db.select().from(schema.projectPlans)
      .where(eq(schema.projectPlans.id, req.params.id)).limit(1).then(r => r[0]);
    if (!plan) return res.status(404).json({ success: false, message: 'Project not found' });

    // Find matching material by name (case-insensitive)
    const materials = await db.select().from(schema.materials);
    const material  = materials.find(m => m.itemName.toLowerCase() === item.itemName.toLowerCase());
    if (!material) {
      return res.status(404).json({ success: false, message: 'Item not found in inventory' });
    }

    const effectiveBalance = await getEffectiveBalance(material.id);
    if (effectiveBalance <= 0) {
      return res.status(409).json({
        success: false,
        message: `No stock available in inventory (after accounting for other project reservations).`,
        effectiveBalance,
      });
    }

    const reservedQtyVal = Math.min(Number(item.quantity), effectiveBalance);

    await db.transaction(async (tx) => {
      const resId = randomUUID();
      await tx.insert(schema.projectInventoryReservations).values({
        id: resId,
        projectPlanId: req.params.id,
        projectItemId: req.params.itemId,
        materialId: material.id,
        reservedQty: String(reservedQtyVal),
        releasedQty: '0.00',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.update(schema.projectPlanItems)
        .set({
          fulfillmentType: 'INVENTORY',
          reservedQty: String(reservedQtyVal),
          inventoryItemId: material.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.projectPlanItems.id, req.params.itemId));

      await tx.insert(schema.materialUsageHistory).values({
        id: randomUUID(),
        materialId: material.id,
        projectPlanId: req.params.id,
        projectName: plan.projectName,
        action: 'RESERVED',
        qty: String(reservedQtyVal),
        performedById: req.user.id,
        note: `Reserved for project: ${plan.projectName}`,
        financialYear: plan.financialYear,
        createdAt: new Date(),
      });
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIALS' });
    res.json({ success: true, message: `${reservedQtyVal} units of ${item.itemName} reserved from inventory.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/project-plans/:id/items/:itemId/po ─────────────────────────────
exports.raisePurchaseOrder = async (req, res) => {
  try {
    const { purchaseOrderId } = req.body; // optional, if PO already created
    const item = await db.select().from(schema.projectPlanItems)
      .where(eq(schema.projectPlanItems.id, req.params.itemId)).limit(1).then(r => r[0]);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    await db.update(schema.projectPlanItems)
      .set({
        fulfillmentType: 'PURCHASE_ORDER',
        purchaseOrderId: purchaseOrderId || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.projectPlanItems.id, req.params.itemId));

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    res.json({ success: true, message: 'Item marked for Purchase Order.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/project-plans/:id/items/:itemId/collection-tasks ────────────────
exports.assignCollectionTask = async (req, res) => {
  try {
    const { assignedToId, qtyToCollect, note } = req.body;
    if (!assignedToId || !qtyToCollect) {
      return res.status(400).json({ success: false, message: 'assignedToId and qtyToCollect are required' });
    }

    const item = await db.select().from(schema.projectPlanItems)
      .where(eq(schema.projectPlanItems.id, req.params.itemId)).limit(1).then(r => r[0]);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.fulfillmentType !== 'INVENTORY') {
      return res.status(400).json({ success: false, message: 'Item must be reserved from inventory before assigning collection task' });
    }

    const taskId = randomUUID();
    await db.insert(schema.projectCollectionTasks).values({
      id: taskId,
      projectPlanId: req.params.id,
      projectItemId: req.params.itemId,
      assignedToId,
      assignedById: req.user.id,
      qtyToCollect: String(qtyToCollect),
      qtyCollected: '0.00',
      status: 'PENDING',
      note: note || null,
      collectedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const { sendNotification } = require('../services/notification.service');
      const plan = await db.select().from(schema.projectPlans)
        .where(eq(schema.projectPlans.id, req.params.id)).limit(1).then(r => r[0]);

      await sendNotification(req.app.get('io'), {
        userId: assignedToId,
        type: 'TASK_ASSIGNED',
        title: '📦 Collection Task Assigned',
        body: `You have been assigned to collect ${qtyToCollect} ${item.unit || 'units'} of "${item.itemName}" for "${plan?.projectName || 'Project Plan'}".`,
        entityType: 'project_plan',
        entityId: req.params.id
      });
    } catch (notifErr) {
      console.error('[assignCollectionTask] Notification trigger failed:', notifErr.message);
    }

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'PROJECT_PLANS' });
    res.status(201).json({ success: true, message: 'Collection task assigned.', taskId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
