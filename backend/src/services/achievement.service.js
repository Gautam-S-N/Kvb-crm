/**
 * achievement.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core business logic for computing and persisting sales target achievements.
 *
 * KEY DESIGN PRINCIPLES:
 *  1. Bottom-up aggregation: child (subordinate) targets are always calculated
 *     BEFORE their parent target, so roll-ups are always based on fresh data.
 *  2. Archived/soft-deleted records (isArchived: true) are EXCLUDED from all
 *     achievement calculations to prevent cancelled/erroneous data inflating numbers.
 *  3. Retry-on-failure: the `refreshWithRetry` wrapper retries up to MAX_RETRIES
 *     times with exponential backoff before giving up and logging the failure.
 *  4. This service is used by:
 *     - The manual refresh API (salesTarget.controller.js)
 *     - The nightly targetCron.js
 *     - Real-time triggers in sale.controller.js & quotation.controller.js
 */

const prisma = require('../utils/db');
const { sendNotification, emitRefresh } = require('./notification.service');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// ── Helper: sleep for ms milliseconds ────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Helper: resolve period date range ────────────────────────────────────────
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

// ── Core: refresh one target's achievements ───────────────────────────────────
/**
 * Recalculates and writes achievement values for a single SalesTarget.
 * Excludes archived/soft-deleted leads and sales from all counts.
 * Adds subordinate (sub-target) roll-ups AFTER their own values have been set.
 *
 * @param {object} target  - SalesTarget DB record
 * @param {import('socket.io').Server|null} io
 * @returns {Promise<object>} - Updated SalesTarget record
 */
const refreshOneTarget = async (target, io = null) => {
  const { start, end } = getPeriodDates(target.periodType, target.periodYear, target.periodNumber);

  const [salesAgg, wonLeads, quotationsSent, subTargetsAgg] = await Promise.all([
    // Direct revenue: filter by saleDate (the actual business date), not createdAt
    // Exclude CANCELLED sales from achievement totals
    prisma.sale.aggregate({
      where: {
        createdById: target.employeeId,
        saleDate: { gte: start, lt: end },
        status: { notIn: ['CANCELLED'] }
      },
      _sum: { totalAmount: true }
    }),

    // Won leads: exclude archived leads
    prisma.lead.count({
      where: {
        assignedToId: target.employeeId,
        status: 'WON',
        isArchived: false,
        updatedAt: { gte: start, lt: end }
      }
    }),

    // Quotations sent: all created quotations in period
    prisma.quotation.count({
      where: {
        createdById: target.employeeId,
        createdAt: { gte: start, lt: end }
      }
    }),

    // ── ROLL-UP: sum achievements from sub-targets allocated to subordinates ──
    prisma.salesTarget.aggregate({
      where: { parentTargetId: target.id },
      _sum: {
        revenueAchieved:  true,
        leadsAchieved:    true,
        quotationsSent:   true
      }
    })
  ]);

  const directRevenue  = parseFloat(salesAgg._sum.totalAmount || 0);
  const subRevenue     = parseFloat(subTargetsAgg._sum.revenueAchieved || 0);
  const revenueAchieved = directRevenue + subRevenue;

  const leadsAchieved   = wonLeads + (subTargetsAgg._sum.leadsAchieved || 0);
  const totalQuotations = quotationsSent + (subTargetsAgg._sum.quotationsSent || 0);

  const prevPct = (Number(target.revenueAchieved) / Number(target.revenueTarget)) * 100;
  const newPct  = (revenueAchieved / Number(target.revenueTarget)) * 100;

  const updated = await prisma.salesTarget.update({
    where: { id: target.id },
    data: { revenueAchieved, leadsAchieved, quotationsSent: totalQuotations }
  });

  // ── Milestone notifications (50% and 100%) ───────────────────────────────
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
 * Processes child targets BEFORE parent targets (bottom-up ordering) so that
 * roll-up values from subordinates are always fresh when the manager's target
 * is calculated. This prevents the "manager total gets overwritten with only
 * direct sales" bug in the old cron.
 *
 * @param {object} where  - Prisma where clause for SalesTarget
 * @param {import('socket.io').Server|null} io
 * @returns {Promise<{ refreshed: number, errors: string[] }>}
 */
const refreshTargets = async (where, io = null) => {
  // Fetch all matching targets WITH subTargets data to determine order
  const targets = await prisma.salesTarget.findMany({
    where,
    include: { subTargets: { select: { id: true } } }
  });

  // Sort: leaf nodes (no sub-targets) first, then parents
  const leaves  = targets.filter(t => t.subTargets.length === 0);
  const parents = targets.filter(t => t.subTargets.length > 0);
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
 * Wrapper that retries `refreshOneTarget` up to MAX_RETRIES times with
 * exponential backoff. Failures are always logged — never silent.
 *
 * @param {object} target
 * @param {import('socket.io').Server|null} io
 */
const refreshWithRetry = async (target, io = null) => {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await refreshOneTarget(target, io);
    } catch (err) {
      attempt++;
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
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
 * Fire-and-forget trigger: refreshes all active targets for a given employee
 * and bubbles up through their management chain. Called after a sale/lead/quotation
 * is created or status-changed. Errors are logged but never block the HTTP response.
 *
 * @param {string} employeeId - The employee whose data changed
 * @param {import('socket.io').Server|null} io
 */
const triggerRefreshForEmployee = (employeeId, io = null) => {
  // Run asynchronously — never awaited by the calling controller
  setImmediate(async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();

      // Find all active targets for this employee
      const employeeTargets = await prisma.salesTarget.findMany({
        where: { employeeId, periodYear: currentYear },
        include: { subTargets: { select: { id: true } } }
      });

      if (employeeTargets.length === 0) return;

      // Also find their manager's targets (parentTargetId chain)
      const parentIds = employeeTargets
        .filter(t => t.parentTargetId)
        .map(t => t.parentTargetId);

      const parentTargets = parentIds.length > 0
        ? await prisma.salesTarget.findMany({
            where: { id: { in: parentIds } },
            include: { subTargets: { select: { id: true } } }
          })
        : [];

      // Process leaves (employee) first, then parents (manager) — bottom-up
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
