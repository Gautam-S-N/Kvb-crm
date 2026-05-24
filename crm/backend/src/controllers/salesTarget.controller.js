const { eq, and, or, inArray, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');
const { refreshTargets } = require('../services/achievement.service');

// GET /api/targets
exports.getTargets = async (req, res) => {
  try {
    const { employeeId, periodType, periodYear, periodNumber } = req.query;
    
    const conditions = [];
    if (req.user.role === 'EMPLOYEE') {
      conditions.push(
        or(
          eq(schema.salesTargets.employeeId, req.user.id),
          eq(schema.salesTargets.createdById, req.user.id)
        )
      );
    } else if (employeeId) {
      conditions.push(eq(schema.salesTargets.employeeId, employeeId));
    }
    
    if (periodType) {
      conditions.push(eq(schema.salesTargets.periodType, periodType));
    }
    if (periodYear) {
      conditions.push(eq(schema.salesTargets.periodYear, parseInt(periodYear)));
    }
    if (periodNumber) {
      conditions.push(eq(schema.salesTargets.periodNumber, parseInt(periodNumber)));
    }

    const targetsList = await db.select()
      .from(schema.salesTargets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.salesTargets.periodYear), desc(schema.salesTargets.periodNumber));

    const targets = [];
    
    if (targetsList.length > 0) {
      const userIds = new Set();
      targetsList.forEach(t => {
        userIds.add(t.employeeId);
        userIds.add(t.createdById);
      });

      // Subtargets
      const subTargetsList = await db.select()
        .from(schema.salesTargets)
        .where(inArray(schema.salesTargets.parentTargetId, targetsList.map(t => t.id)));

      subTargetsList.forEach(st => {
        userIds.add(st.employeeId);
      });

      // Parent Targets
      const parentTargetIds = targetsList.map(t => t.parentTargetId).filter(Boolean);
      let parentTargetsList = [];
      if (parentTargetIds.length > 0) {
        parentTargetsList = await db.select()
          .from(schema.salesTargets)
          .where(inArray(schema.salesTargets.id, parentTargetIds));
        
        parentTargetsList.forEach(pt => {
          userIds.add(pt.employeeId);
        });
      }

      // Bulk user lookup
      let usersList = [];
      if (userIds.size > 0) {
        usersList = await db.select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, Array.from(userIds)));
      }

      const userMap = {};
      usersList.forEach(u => {
        userMap[u.id] = u;
      });

      // Map subtargets
      const subTargetsMap = {};
      subTargetsList.forEach(st => {
        if (!subTargetsMap[st.parentTargetId]) {
          subTargetsMap[st.parentTargetId] = [];
        }
        subTargetsMap[st.parentTargetId].push({
          id: st.id,
          employeeId: st.employeeId,
          revenueTarget: st.revenueTarget,
          leadsTarget: st.leadsTarget,
          quotationsTarget: st.quotationsTarget,
          revenueAchieved: st.revenueAchieved,
          leadsAchieved: st.leadsAchieved,
          quotationsSent: st.quotationsSent,
          employee: userMap[st.employeeId] ? {
            firstName: userMap[st.employeeId].firstName,
            lastName: userMap[st.employeeId].lastName
          } : null
        });
      });

      // Map parent targets
      const parentTargetsMap = {};
      parentTargetsList.forEach(pt => {
        parentTargetsMap[pt.id] = {
          ...pt,
          employee: userMap[pt.employeeId] ? {
            firstName: userMap[pt.employeeId].firstName,
            lastName: userMap[pt.employeeId].lastName
          } : null
        };
      });

      targetsList.forEach(t => {
        targets.push({
          ...t,
          employee: userMap[t.employeeId] ? {
            id: userMap[t.employeeId].id,
            firstName: userMap[t.employeeId].firstName,
            lastName: userMap[t.employeeId].lastName
          } : null,
          createdBy: userMap[t.createdById] ? {
            id: userMap[t.createdById].id,
            firstName: userMap[t.createdById].firstName,
            lastName: userMap[t.createdById].lastName
          } : null,
          subTargets: subTargetsMap[t.id] || [],
          parentTarget: t.parentTargetId ? (parentTargetsMap[t.parentTargetId] || null) : null
        });
      });
    }

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

    const id = randomUUID();
    const newTarget = {
      id,
      employeeId,
      createdById: req.user.id,
      periodType: periodType || 'MONTHLY',
      periodYear: parseInt(periodYear),
      periodNumber: parseInt(periodNumber) || 1,
      revenueTarget: parseFloat(revenueTarget).toFixed(2),
      leadsTarget: parseInt(leadsTarget) || 0,
      quotationsTarget: parseInt(quotationsTarget) || 0,
      revenueAchieved: '0.00',
      leadsAchieved: 0,
      quotationsSent: 0,
      reminderSent: false,
      notes: notes || null,
      isRecurring: !!isRecurring,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      parentTargetId: parentTargetId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.salesTargets).values(newTarget);

    const employeeList = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName
    })
    .from(schema.users)
    .where(eq(schema.users.id, employeeId))
    .limit(1);

    const creatorList = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName
    })
    .from(schema.users)
    .where(eq(schema.users.id, req.user.id))
    .limit(1);

    const target = {
      ...newTarget,
      employee: employeeList[0] || null,
      createdBy: creatorList[0] || null
    };
    
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

    const existingList = await db.select()
      .from(schema.salesTargets)
      .where(eq(schema.salesTargets.id, req.params.id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    const dataToUpdate = { updatedAt: new Date() };
    if (employeeId !== undefined) dataToUpdate.employeeId = employeeId;
    if (periodType !== undefined) dataToUpdate.periodType = periodType;
    if (periodYear !== undefined) dataToUpdate.periodYear = parseInt(periodYear);
    if (periodNumber !== undefined) dataToUpdate.periodNumber = parseInt(periodNumber) || 1;
    if (revenueTarget !== undefined) dataToUpdate.revenueTarget = parseFloat(revenueTarget).toFixed(2);
    if (leadsTarget !== undefined) dataToUpdate.leadsTarget = parseInt(leadsTarget) || 0;
    if (quotationsTarget !== undefined) dataToUpdate.quotationsTarget = parseInt(quotationsTarget) || 0;
    if (notes !== undefined) dataToUpdate.notes = notes;
    if (isRecurring !== undefined) dataToUpdate.isRecurring = !!isRecurring;
    if (reminderAt !== undefined) dataToUpdate.reminderAt = reminderAt ? new Date(reminderAt) : null;
    if (parentTargetId !== undefined) dataToUpdate.parentTargetId = parentTargetId || null;

    await db.update(schema.salesTargets)
      .set(dataToUpdate)
      .where(eq(schema.salesTargets.id, req.params.id));

    const updatedTarget = {
      ...existingList[0],
      ...dataToUpdate
    };

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TARGETS' });
    }

    res.json({ success: true, data: updatedTarget });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/targets/:id  (admin only)
exports.deleteTarget = async (req, res) => {
  try {
    const existingList = await db.select()
      .from(schema.salesTargets)
      .where(eq(schema.salesTargets.id, req.params.id))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    await db.delete(schema.salesTargets)
      .where(eq(schema.salesTargets.id, req.params.id));

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
      start = new Date(year, 0, 1 + (num - 1) * 7);
      while (start.getDay() !== 1) {
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
