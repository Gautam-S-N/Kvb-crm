const cron = require('node-cron');

const startFollowUpReminderJob = (app) => {
  // Run every minute to check for due follow-ups
  cron.schedule('* * * * *', async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const now = new Date();

      // Find all pending followups scheduled up to now that haven't sent a reminder
      const dueFollowUps = await prisma.followUp.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now },
          reminderSent: false
        },
        include: { lead: { select: { id: true, title: true, leadNumber: true } } }
      });

      if (dueFollowUps.length === 0) return;

      const io = app.get('io');
      
      for (const f of dueFollowUps) {
        const body = `Follow-up due: ${f.description} for lead ${f.lead.leadNumber} (${f.lead.title})`;
        
        if (io) {
          io.emit('notification', {
            type: 'FOLLOW_UP_DUE',
            title: '⏰ Lead Follow-up Reminder',
            body,
            entityType: 'lead',
            entityId: f.lead.id,
            targetUserId: f.assignedToId
          });
        }

        await prisma.notification.create({
          data: {
            userId: f.assignedToId,
            type: 'FOLLOW_UP_DUE',
            title: '⏰ Lead Follow-up Reminder',
            body,
            entityType: 'lead',
            entityId: f.lead.id
          }
        });

        // Mark as sent
        await prisma.followUp.update({
          where: { id: f.id },
          data: { reminderSent: true }
        });
      }

    } catch (error) {
      console.error('[FOLLOW-UP CRON] Error:', error.message);
    }
  });
};

module.exports = startFollowUpReminderJob;
