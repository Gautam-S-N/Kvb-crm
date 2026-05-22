const cron = require('node-cron');
const { eq, and, lte, sql } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

const startTargetAutomationMode = (app) => {
  // 1. Daily Refresh & Recurrence (Runs at 23:50 daily)
  cron.schedule('50 23 * * *', async () => {
    console.log('[TARGET CRON] Running daily refresh and recurrence check...');
    try {
      const now = new Date();
      const currentYear = now.getFullYear();

      // Refresh all targets for the current year
      const targets = await db.select()
        .from(schema.salesTargets)
        .where(eq(schema.salesTargets.periodYear, currentYear));

      for (const t of targets) {
        // --- Part A: Create Next Period if Recurring and Period Ended ---
        if (t.isRecurring) {
          const { end } = getPeriodDates(t.periodType, t.periodYear, t.periodNumber);
          
          // If the period ends today or before
          if (end <= now) {
            const next = getNextPeriod(t.periodType, t.periodYear, t.periodNumber);
            
            // Check if next one already exists
            const existsRows = await db.select()
              .from(schema.salesTargets)
              .where(
                and(
                  eq(schema.salesTargets.employeeId, t.employeeId),
                  eq(schema.salesTargets.periodType, t.periodType),
                  eq(schema.salesTargets.periodYear, next.year),
                  eq(schema.salesTargets.periodNumber, next.number)
                )
              )
              .limit(1);

            if (existsRows.length === 0) {
              await db.insert(schema.salesTargets).values({
                id: randomUUID(),
                employeeId: t.employeeId,
                createdById: t.createdById,
                periodType: t.periodType,
                periodYear: next.year,
                periodNumber: next.number,
                revenueTarget: t.revenueTarget,
                leadsTarget: t.leadsTarget,
                quotationsTarget: t.quotationsTarget,
                isRecurring: true,
                notes: t.notes || null,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              console.log(`[TARGET CRON] Recurring target created for ${t.employeeId} (${t.periodType} ${next.number}/${next.year})`);
            }
          }
        }
      }
    } catch (err) {
      console.error('[TARGET CRON] Automation Error:', err.message);
    }
  });

  // 2. Reminder Service (Runs every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const pendingRemindersRows = await db.select({
        id: schema.salesTargets.id,
        periodType: schema.salesTargets.periodType,
        employeeId: schema.salesTargets.employeeId,
        employeeFirstName: schema.users.firstName
      })
      .from(schema.salesTargets)
      .leftJoin(schema.users, eq(schema.salesTargets.employeeId, schema.users.id))
      .where(
        and(
          lte(schema.salesTargets.reminderAt, now),
          eq(schema.salesTargets.reminderSent, false)
        )
      );

      const pendingReminders = pendingRemindersRows.map(t => ({
        id: t.id,
        periodType: t.periodType,
        employeeId: t.employeeId,
        employee: t.employeeFirstName ? {
          firstName: t.employeeFirstName
        } : null
      }));

      const io = app.get('io');

      for (const t of pendingReminders) {
        if (io) {
          io.emit('notification', {
            type: 'FOLLOW_UP_DUE',
            title: '⏰ Target Reminder',
            body: `Don't forget to track your ${t.periodType.toLowerCase()} sales targets!`,
            entityType: 'target',
            entityId: t.id,
            targetUserId: t.employeeId
          });
        }

        await db.update(schema.salesTargets)
          .set({ reminderSent: true })
          .where(eq(schema.salesTargets.id, t.id));
        
        console.log(`[TARGET CRON] Reminder sent to ${t.employee?.firstName || 'employee'} for target ${t.id}`);
      }
    } catch (err) {
      console.error('[TARGET CRON] Reminder Error:', err.message);
    }
  });
};

// Helper for dates
const getPeriodDates = (periodType, periodYear, periodNumber) => {
  let start, end;
  const year = parseInt(periodYear);
  const num  = parseInt(periodNumber) || 1;

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

// Helper for next period
const getNextPeriod = (type, year, number) => {
  let nYear = year;
  let nNumber = number + 1;

  if (type === 'WEEKLY' && nNumber > 52) { nNumber = 1; nYear++; }
  else if (type === 'MONTHLY' && nNumber > 12) { nNumber = 1; nYear++; }
  else if (type === 'QUARTERLY' && nNumber > 4) { nNumber = 1; nYear++; }
  else if (type === 'YEARLY') { nNumber = 1; nYear++; }

  return { year: nYear, number: nNumber };
};

module.exports = startTargetAutomationMode;
