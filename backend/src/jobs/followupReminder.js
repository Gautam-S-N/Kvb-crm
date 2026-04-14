const cron = require('node-cron');

const startFollowUpReminderJob = (app) => {
  // Run everyday at 08:00 AM to check for follow-ups scheduled for the current day
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running daily Follow-up reminder check...');
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      // Find all pending followups scheduled for today (between 12:00 AM today and 12:00 AM tomorrow)
      const followUps = await prisma.followUp.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: todayStart, lt: tomorrowStart }
        },
        include: { lead: { select: { id: true, title: true } } }
      });

      if (followUps.length === 0) {
        console.log('[CRON] No follow-ups scheduled for today.');
        return;
      }

      // Group by assignee
      const followUpsByEmp = {};
      followUps.forEach(f => {
        if (!followUpsByEmp[f.assignedToId]) followUpsByEmp[f.assignedToId] = [];
        followUpsByEmp[f.assignedToId].push(f);
      });

      const io = app.get('io');
      
      // Emit notifications
      for (const [employeeId, fList] of Object.entries(followUpsByEmp)) {
        const body = `You have ${fList.length} follow-up${fList.length > 1 ? 's' : ''} scheduled for today.`;
        
        if (io) {
          io.emit('notification', {
            type: 'FOLLOW_UP_DUE',
            title: 'Daily Follow-up Reminders',
            body,
            entityType: 'followUp',
            entityId: fList.length === 1 ? fList[0].id : null,
            targetUserId: employeeId
          });
        }

        await prisma.notification.create({
          data: {
            userId: employeeId,
            type: 'FOLLOW_UP_DUE',
            title: 'Daily Follow-up Reminders',
            body,
            entityType: 'followUp',
            entityId: fList.length === 1 ? fList[0].id : null
          }
        });
      }

      console.log(`[CRON] Notified ${Object.keys(followUpsByEmp).length} employees about their follow-ups.`);
    } catch (error) {
      console.error('[CRON] Error running FollowUp reminder sync:', error.message);
    }
  });
};

module.exports = startFollowUpReminderJob;
