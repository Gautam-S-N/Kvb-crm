const cron = require('node-cron');
const { eq, and, lte } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

const startFollowUpReminderJob = (app) => {
  // Run every minute to check for due follow-ups
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find all pending followups scheduled up to now that haven't sent a reminder
      const dueFollowUps = await db.select({
        id: schema.followUps.id,
        description: schema.followUps.description,
        assignedToId: schema.followUps.assignedToId,
        leadId: schema.leads.id,
        leadTitle: schema.leads.title,
        leadNumber: schema.leads.leadNumber
      })
      .from(schema.followUps)
      .leftJoin(schema.leads, eq(schema.followUps.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.followUps.status, 'SCHEDULED'),
          lte(schema.followUps.scheduledAt, now),
          eq(schema.followUps.reminderSent, false)
        )
      );

      if (dueFollowUps.length === 0) return;

      const io = app.get('io');
      
      for (const f of dueFollowUps) {
        if (!f.leadNumber) continue;
        const body = `Follow-up due: ${f.description} for lead ${f.leadNumber} (${f.leadTitle})`;
        
        if (io) {
          io.emit('notification', {
            type: 'FOLLOW_UP_DUE',
            title: '⏰ Lead Follow-up Reminder',
            body,
            entityType: 'lead',
            entityId: f.leadId,
            targetUserId: f.assignedToId
          });
        }

        await db.insert(schema.notifications).values({
          id: randomUUID(),
          userId: f.assignedToId,
          type: 'FOLLOW_UP_DUE',
          title: '⏰ Lead Follow-up Reminder',
          body,
          entityType: 'lead',
          entityId: f.leadId,
          isRead: false,
          createdAt: new Date()
        });

        // Mark as sent
        await db.update(schema.followUps)
          .set({ reminderSent: true })
          .where(eq(schema.followUps.id, f.id));
      }

    } catch (error) {
      console.error('[FOLLOW-UP CRON] Error:', error.message);
    }
  });
};

module.exports = startFollowUpReminderJob;
