/**
 * achievement.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core business logic for computing and persisting sales target achievements.
 */

const { eq, and, gte, lt, not, sql, inArray } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { sendNotification, emitRefresh } = require('./notification.service');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// sleep for ms milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// resolve period date range
const getPeriodDates = (periodType, periodYear, periodNumber) => {
  const year = parseInt(periodYear);
  const num  = parseInt(periodNumber) || 1;
  let start, end;

  switch (periodType) {
    case 'WEEKLY':
      start = new Date(year, 0, 1 + (num - 1) * 7);
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1);
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

/**
 * Recalculates and writes achievement values for a single SalesTarget.
 *
 * @param {object} target  - SalesTarget DB record
 * @param {import('socket.io').Server|null} io
 * @returns {Promise<object>} - Updated SalesTarget record
 */
const refreshOneTarget = async (target, io = null) => {
  const { start, end } = getPeriodDates(target.periodType, target.periodYear, target.periodNumber);

  const [salesAgg, wonLeads, quotationsSent, subTargetsAgg] = await Promise.all([
    db.select({ totalAmount: sql`sum(cast(totalAmount as decimal(15,2)))` })
      .from(schema.sales)
      .where(
        and(
          eq(schema.sales.createdById, target.employeeId),
          gte(schema.sales.saleDate, start),
          lt(schema.sales.saleDate, end),
          not(eq(schema.sales.status, 'CANCELLED'))
        )
      ),

    db.select({ count: sql`count(*)` })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.assignedToId, target.employeeId),
          eq(schema.leads.status, 'WON'),
          eq(schema.leads.isArchived, false),
          gte(schema.leads.updatedAt, start),
          lt(schema.leads.updatedAt, end)
        )
      ),

    db.select({ count: sql`count(*)` })
      .from(schema.quotations)
      .where(
        and(
          eq(schema.quotations.createdById, target.employeeId),
          gte(schema.quotations.createdAt, start),
          lt(schema.quotations.createdAt, end)
        )
      ),

    db.select({
      revenueAchieved: sql`sum(cast(revenueAchieved as decimal(15,2)))`,
      leadsAchieved: sql`sum(leadsAchieved)`,
      quotationsSent: sql`sum(quotationsSent)`
    })
    .from(schema.salesTargets)
    .where(eq(schema.salesTargets.parentTargetId, target.id))
  ]);

  const directRevenue  = parseFloat(salesAgg[0]?.totalAmount || 0);
  const subRevenue     = parseFloat(subTargetsAgg[0]?.revenueAchieved || 0);
  const revenueAchieved = directRevenue + subRevenue;

  const wonLeadsCount = Number(wonLeads[0]?.count || 0);
  const subLeadsCount = Number(subTargetsAgg[0]?.leadsAchieved || 0);
  const leadsAchieved = wonLeadsCount + subLeadsCount;

  const quotsCount = Number(quotationsSent[0]?.count || 0);
  const subQuotsCount = Number(subTargetsAgg[0]?.quotationsSent || 0);
  const totalQuotations = quotsCount + subQuotsCount;

  const prevPct = (Number(target.revenueAchieved) / Number(target.revenueTarget)) * 100;
  const newPct  = (revenueAchieved / Number(target.revenueTarget)) * 100;

  await db.update(schema.salesTargets)
    .set({
      revenueAchieved: String(revenueAchieved),
      leadsAchieved,
      quotationsSent: totalQuotations
    })
    .where(eq(schema.salesTargets.id, target.id));

  const updatedRows = await db.select()
    .from(schema.salesTargets)
    .where(eq(schema.salesTargets.id, target.id))
    .limit(1);

  const updated = updatedRows[0];

  if (io) {
    if (prevPct < 50 && newPct >= 50) {
      await sendNotification(io, {
        userId: target.employeeId,
        type: 'TARGET_MILESTONE',
        title: '🎉 50% Target Reached!',
        body: `You've hit 50% of your ${target.periodType.toLowerCase()} revenue target!`,
        entityType: 'target',
        entityId: target.id
      });
    }
    if (prevPct < 100 && newPct >= 100) {
      await sendNotification(io, {
        userId: target.employeeId,
        type: 'TARGET_MILESTONE',
        title: '🏆 100% Target Achieved!',
        body: `Congratulations! You've hit your ${target.periodType.toLowerCase()} revenue target!`,
        entityType: 'target',
        entityId: target.id
      });
    }
  }

  return updated;
};

/**
 * Refreshes all targets for the given where clause.
 */
const refreshTargets = async (whereClause, io = null) => {
  // We query all targets matching the where condition
  const targets = await db.select()
    .from(schema.salesTargets)
    .where(whereClause);

  // In order to perform child before parent targets (bottom-up sorting),
  // we count direct child targets to differentiate leaves from parents.
  const resolvedTargets = [];
  for (const t of targets) {
    const subTargetsCount = await db.select({ count: sql`count(*)` })
      .from(schema.salesTargets)
      .where(eq(schema.salesTargets.parentTargetId, t.id));
    resolvedTargets.push({
      ...t,
      subTargetsCount: Number(subTargetsCount[0]?.count || 0)
    });
  }

  const leaves  = resolvedTargets.filter(t => t.subTargetsCount === 0);
  const parents = resolvedTargets.filter(t => t.subTargetsCount > 0);
  const ordered = [...leaves, ...parents];

  let refreshed = 0;
  const errors = [];

  for (const target of ordered) {
    try {
      await refreshWithRetry(target, io);
      refreshed++;
    } catch (err) {
      const msg = `Target ${target.id} (${target.employeeId}): ${err.message}`;
      errors.push(msg);
      console.error('[AchievementService] Final failure after retries:', msg);
    }
  }

  if (io) emitRefresh(io, 'TARGETS');

  return { refreshed, errors };
};

/**
 * Wrapper that retries `refreshOneTarget` up to MAX_RETRIES times.
 */
const refreshWithRetry = async (target, io = null) => {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await refreshOneTarget(target, io);
    } catch (err) {
      attempt++;
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[AchievementService] Retry ${attempt}/${MAX_RETRIES} for target ${target.id}. ` +
        `Retrying in ${delay}ms. Error: ${err.message}`
      );
      if (attempt >= MAX_RETRIES) throw err;
      await sleep(delay);
    }
  }
};

/**
 * Fire-and-forget trigger: refreshes all active targets for a given employee.
 */
const triggerRefreshForEmployee = (employeeId, io = null) => {
  setImmediate(async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();

      // Find all active targets for this employee
      const employeeTargets = await db.select()
        .from(schema.salesTargets)
        .where(
          and(
            eq(schema.salesTargets.employeeId, employeeId),
            eq(schema.salesTargets.periodYear, currentYear)
          )
        );

      if (employeeTargets.length === 0) return;

      const parentIds = employeeTargets
        .filter(t => t.parentTargetId)
        .map(t => t.parentTargetId);

      const parentTargets = parentIds.length > 0
        ? await db.select().from(schema.salesTargets).where(inArray(schema.salesTargets.id, parentIds))
        : [];

      const ordered = [...employeeTargets, ...parentTargets];

      for (const target of ordered) {
        await refreshWithRetry(target, io).catch(err =>
          console.error(`[AchievementService] Background refresh failed for target ${target.id}:`, err.message)
        );
      }

      if (io && ordered.length > 0) emitRefresh(io, 'TARGETS');
    } catch (err) {
      console.error('[AchievementService] triggerRefreshForEmployee error:', err.message);
    }
  });
};

module.exports = { refreshTargets, refreshOneTarget, refreshWithRetry, triggerRefreshForEmployee, getPeriodDates };
