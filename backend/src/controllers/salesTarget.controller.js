const prisma = require('../utils/db');

// GET /api/targets
exports.getTargets = async (req, res) => {
  try {
    const { employeeId, periodType, periodYear, periodNumber } = req.query;
    const where = {};
    if (req.user.role === 'EMPLOYEE') where.employeeId = req.user.id;
    else if (employeeId) where.employeeId = employeeId;
    if (periodType)   where.periodType   = periodType;
    if (periodYear)   where.periodYear   = parseInt(periodYear);
    if (periodNumber) where.periodNumber = parseInt(periodNumber);

    const targets = await prisma.salesTarget.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ periodYear: 'desc' }, { periodNumber: 'desc' }]
    });
    res.json({ success: true, data: targets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/targets  (admin only)
exports.createTarget = async (req, res) => {
  try {
    const { employeeId, periodType, periodYear, periodNumber, revenueTarget, leadsTarget, quotationsTarget, notes } = req.body;
    const target = await prisma.salesTarget.create({
      data: {
        employeeId,
        createdById: req.user.id,
        periodType:    periodType || 'MONTHLY',
        periodYear:    parseInt(periodYear),
        periodNumber:  parseInt(periodNumber),
        revenueTarget: parseFloat(revenueTarget),
        leadsTarget:   parseInt(leadsTarget)    || 0,
        quotationsTarget: parseInt(quotationsTarget) || 0,
        notes
      }
    });
    res.status(201).json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/targets/:id  (admin only)
exports.updateTarget = async (req, res) => {
  try {
    const target = await prisma.salesTarget.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/targets/:id  (admin only)
exports.deleteTarget = async (req, res) => {
  try {
    await prisma.salesTarget.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Target deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/targets/refresh — manually refresh attainment for all active targets
exports.refreshAttainment = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    const targets = await prisma.salesTarget.findMany({
      where: { periodType: 'MONTHLY', periodYear: currentYear, periodNumber: currentMonth }
    });

    const updates = await Promise.all(targets.map(async (t) => {
      const monthStart = new Date(t.periodYear, t.periodNumber - 1, 1);
      const monthEnd   = new Date(t.periodYear, t.periodNumber, 1);

      const [salesAgg, wonLeads, quotationsSent] = await Promise.all([
        prisma.sale.aggregate({
          where: { createdById: t.employeeId, createdAt: { gte: monthStart, lt: monthEnd } },
          _sum: { totalAmount: true }
        }),
        prisma.lead.count({
          where: { assignedToId: t.employeeId, status: 'WON', updatedAt: { gte: monthStart, lt: monthEnd } }
        }),
        prisma.quotation.count({
          where: { createdById: t.employeeId, createdAt: { gte: monthStart, lt: monthEnd } }
        })
      ]);

      const revenueAchieved = parseFloat(salesAgg._sum.totalAmount || 0);

      // Check milestone
      const prevPct = (Number(t.revenueAchieved) / Number(t.revenueTarget)) * 100;
      const newPct  = (revenueAchieved / Number(t.revenueTarget)) * 100;

      const updated = await prisma.salesTarget.update({
        where: { id: t.id },
        data: { revenueAchieved, leadsAchieved: wonLeads, quotationsSent }
      });

      // Emit milestone notifications
      const io = req.app?.get('io');
      if (io) {
        if (prevPct < 50 && newPct >= 50) {
          io.emit('notification', { type: 'TARGET_MILESTONE', title: '🎉 50% Target Reached!', body: `You've hit 50% of your monthly revenue target!`, entityType: 'target', entityId: t.id, targetUserId: t.employeeId });
        }
        if (prevPct < 100 && newPct >= 100) {
          io.emit('notification', { type: 'TARGET_MILESTONE', title: '🏆 100% Target Achieved!', body: `Congratulations! You've hit your monthly revenue target!`, entityType: 'target', entityId: t.id, targetUserId: t.employeeId });
        }
      }

      return updated;
    }));

    res.json({ success: true, message: `Refreshed ${updates.length} target(s)`, data: updates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
