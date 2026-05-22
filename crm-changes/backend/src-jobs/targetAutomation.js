const cron = require('node-cron');
const prisma = require('../utils/db');

const startTargetAutomationMode = (app) => {
  // 1. Daily Refresh & Recurrence (Runs at 23:50 daily)
  cron.schedule('50 23 * * *', async () => {
    console.log('[TARGET CRON] Running daily refresh and recurrence check...');
    try {
      const now = new Date();
      const currentYear = now.getFullYear();

      // Refresh all targets for the current year
      const targets = await prisma.salesTarget.findMany({
        where: { periodYear: currentYear }
      });

      for (const t of targets) {
        // --- Part A: Create Next Period if Recurring and Period Ended ---
        if (t.isRecurring) {
          const { end } = getPeriodDates(t.periodType, t.periodYear, t.periodNumber);
          
          // If the period ends today or before
          if (end <= now) {
            const next = getNextPeriod(t.periodType, t.periodYear, t.periodNumber);
            
            // Check if next one already exists
            const exists = await prisma.salesTarget.findUnique({
              where: {
                employeeId_periodType_periodYear_periodNumber: {
                  employeeId: t.employeeId,
                  periodType: t.periodType,
                  periodYear: next.year,
                  periodNumber: next.number
                }
              }
            });

            if (!exists) {
              await prisma.salesTarget.create({
                data: {
                  employeeId: t.employeeId,
                  createdById: t.createdById,
                  periodType: t.periodType,
                  periodYear: next.year,
                  periodNumber: next.number,
                  revenueTarget: t.revenueTarget,
                  leadsTarget: t.leadsTarget,
                  quotationsTarget: t.quotationsTarget,
                  isRecurring: true,
                  notes: t.notes
                }
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
      const pendingReminders = await prisma.salesTarget.findMany({
        where: {
          reminderAt: { lte: now },
          reminderSent: false
        },
        include: { employee: true }
      });

      const io = app.get('io');

      for (const t of pendingReminders) {
        if (io) {
          io.emit('notification', {
            type: 'FOLLOW_UP_DUE', // Reuse appropriate type or use general
            title: '⏰ Target Reminder',
            body: `Don't forget to track your ${t.periodType.toLowerCase()} sales targets!`,
            entityType: 'target',
            entityId: t.id,
            targetUserId: t.employeeId
          });
        }

        await prisma.salesTarget.update({
          where: { id: t.id },
          data: { reminderSent: true }
        });
        
        console.log(`[TARGET CRON] Reminder sent to ${t.employee.firstName} for target ${t.id}`);
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
