const { eq, desc, and } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

// ── GET /api/materials/:id/history ────────────────────────────────────────────
exports.getByMaterial = async (req, res) => {
  try {
    const { fy } = req.query;
    const conditions = [eq(schema.materialUsageHistory.materialId, req.params.id)];

    if (fy && fy !== 'ALL' && fy !== 'all') {
      conditions.push(eq(schema.materialUsageHistory.financialYear, fy));
    }

    const history = await db.select({
      id:            schema.materialUsageHistory.id,
      materialId:    schema.materialUsageHistory.materialId,
      projectPlanId: schema.materialUsageHistory.projectPlanId,
      projectName:   schema.materialUsageHistory.projectName,
      action:        schema.materialUsageHistory.action,
      qty:           schema.materialUsageHistory.qty,
      note:          schema.materialUsageHistory.note,
      financialYear: schema.materialUsageHistory.financialYear,
      createdAt:     schema.materialUsageHistory.createdAt,
      performedByFirstName: schema.users.firstName,
      performedByLastName:  schema.users.lastName,
    })
    .from(schema.materialUsageHistory)
    .leftJoin(schema.users, eq(schema.materialUsageHistory.performedById, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.materialUsageHistory.createdAt));

    const data = history.map(h => ({
      ...h,
      performedBy: h.performedByFirstName
        ? { firstName: h.performedByFirstName, lastName: h.performedByLastName }
        : null,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/project-plans/:id/history ────────────────────────────────────────
exports.getByProject = async (req, res) => {
  try {
    const history = await db.select({
      id:            schema.materialUsageHistory.id,
      materialId:    schema.materialUsageHistory.materialId,
      projectPlanId: schema.materialUsageHistory.projectPlanId,
      projectName:   schema.materialUsageHistory.projectName,
      action:        schema.materialUsageHistory.action,
      qty:           schema.materialUsageHistory.qty,
      note:          schema.materialUsageHistory.note,
      createdAt:     schema.materialUsageHistory.createdAt,
      itemName:      schema.materials.itemName,
      performedByFirstName: schema.users.firstName,
      performedByLastName:  schema.users.lastName,
    })
    .from(schema.materialUsageHistory)
    .leftJoin(schema.users, eq(schema.materialUsageHistory.performedById, schema.users.id))
    .leftJoin(schema.materials, eq(schema.materialUsageHistory.materialId, schema.materials.id))
    .where(eq(schema.materialUsageHistory.projectPlanId, req.params.id))
    .orderBy(desc(schema.materialUsageHistory.createdAt));

    const data = history.map(h => ({
      ...h,
      performedBy: h.performedByFirstName
        ? { firstName: h.performedByFirstName, lastName: h.performedByLastName }
        : null,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
