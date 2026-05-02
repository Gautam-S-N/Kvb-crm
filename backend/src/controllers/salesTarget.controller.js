const prisma = require('../utils/db');
const { refreshTargets } = require('../services/achievement.service');

// GET /api/targets
exports.getTargets = async (req, res) => {
  try {
    const { employeeId, periodType, periodYear, periodNumber } = req.query;
    const where = {};
    if (req.user.role === 'EMPLOYEE') {
      where.OR = [
        { employeeId: req.user.id },
        { createdById: req.user.id }
      ];
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (periodType)   where.periodType   = periodType;
    if (periodYear)   where.periodYear   = parseInt(periodYear);
    if (periodNumber) where.periodNumber = parseInt(periodNumber);

    const targets = await prisma.salesTarget.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        subTargets: { select: { id: true, employeeId: true, revenueTarget: true, leadsTarget: true, quotationsTarget: true, revenueAchieved: true, leadsAchieved: true, quotationsSent: true, employee: { select: { firstName: true, lastName: true } } } },
        parentTarget: { include: { employee: { select: { firstName: true, lastName: true } } } }
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
    const { 
      employeeId, 
      periodType, 
      periodYear, 
      periodNumber, 
      revenueTarget, 
      leadsTarget, 
      quotationsTarget, 
      notes, 
      isRecurring, 
      reminderAt,
      parentTargetId
    } = req.body;

    const target = await prisma.salesTarget.create({
      data: {
        employeeId,
        createdById: req.user.id,
        periodType:    periodType || 'MONTHLY',
        periodYear:    parseInt(periodYear),
        periodNumber:  parseInt(periodNumber) || 1,
        revenueTarget: parseFloat(revenueTarget),
        leadsTarget:   parseInt(leadsTarget)    || 0,
        quotationsTarget: parseInt(quotationsTarget) || 0,
        notes,
        isRecurring:   !!isRecurring,
        reminderAt:    reminderAt ? new Date(reminderAt) : null,
        parentTargetId: parentTargetId || null
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    
    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TARGETS' });
    }

    res.status(201).json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/targets/:id  (admin only)
exports.updateTarget = async (req, res) => {
  try {
    const {
      employeeId,
      periodType,
      periodYear,
      periodNumber,
      revenueTarget,
      leadsTarget,
      quotationsTarget,
      notes,
      isRecurring,
      reminderAt,
      parentTargetId
    } = req.body;

    const dataToUpdate = {};
    if (employeeId !== undefined) dataToUpdate.employeeId = employeeId;
    if (periodType !== undefined) dataToUpdate.periodType = periodType;
    if (periodYear !== undefined) dataToUpdate.periodYear = parseInt(periodYear);
    if (periodNumber !== undefined) dataToUpdate.periodNumber = parseInt(periodNumber) || 1;
    if (revenueTarget !== undefined) dataToUpdate.revenueTarget = parseFloat(revenueTarget);
    if (leadsTarget !== undefined) dataToUpdate.leadsTarget = parseInt(leadsTarget) || 0;
    if (quotationsTarget !== undefined) dataToUpdate.quotationsTarget = parseInt(quotationsTarget) || 0;
    if (notes !== undefined) dataToUpdate.notes = notes;
    if (isRecurring !== undefined) dataToUpdate.isRecurring = !!isRecurring;
    if (reminderAt !== undefined) dataToUpdate.reminderAt = reminderAt ? new Date(reminderAt) : null;
    if (parentTargetId !== undefined) dataToUpdate.parentTargetId = parentTargetId || null;

    const target = await prisma.salesTarget.update({
      where: { id: req.params.id },
      data: dataToUpdate
    });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TARGETS' });
    }

    res.json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/targets/:id  (admin only)
exports.deleteTarget = async (req, res) => {
  try {
    await prisma.salesTarget.delete({ where: { id: req.params.id } });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TARGETS' });
    }

    res.json({ success: true, message: 'Target deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to get start and end dates for a period
const getPeriodDates = (periodType, periodYear, periodNumber) => {
  let start, end;
  const year = parseInt(periodYear);
  const num  = parseInt(periodNumber) || 1;

  switch (periodType) {
    case 'WEEKLY':
      // Simple ISO week logic: find first Monday of the year + (num-1) weeks
      start = new Date(year, 0, 1 + (num - 1) * 7);
      while (start.getDay() !== 1) { // Move to Monday
        start.setDate(start.getDate() + 1);
      }
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;

    case 'MONTHLY':
      start = new Date(year, num - 1, 1);
      end   = new Date(year, num, 1);
      break;

    case 'QUARTERLY':
      start = new Date(year, (num - 1) * 3, 1);
      end   = new Date(year, num * 3, 1);
      break;

    case 'YEARLY':
      start = new Date(year, 0, 1);
      end   = new Date(year + 1, 0, 1);
      break;

    default:
      start = new Date(year, 0, 1);
      end   = new Date(year + 1, 0, 1);
  }
  return { start, end };
};

// POST /api/targets/refresh — manually refresh attainment for active targets
exports.refreshAttainment = async (req, res) => {
  try {
    const { targetId } = req.body;
    const io = req.app?.get('io');

    const where = {};
    if (targetId) {
      where.id = targetId;
    } else {
      // Default: refresh all targets for the current year
      where.periodYear = new Date().getFullYear();
    }

    const { refreshed, errors } = await refreshTargets(where, io);

    res.json({
      success: true,
      message: `Refreshed ${refreshed} target(s)${errors.length > 0 ? ` (${errors.length} error(s) — see server logs)` : ''}`,
      refreshed,
      errors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
