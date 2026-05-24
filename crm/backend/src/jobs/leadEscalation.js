const cron = require('node-cron');
const { eq, and, not, lt } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

const startLeadEscalationJob = (app) => {
  // Run everyday at 09:00 AM to check for neglected leads
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily Lead Escalation check...');
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find active leads that haven't been touched in over 7 days
      const neglectedLeads = await db.select({
        id: schema.leads.id,
        leadNumber: schema.leads.leadNumber,
        assignedToId: schema.users.id,
        assignedToFirstName: schema.users.firstName,
        assignedToManagerId: schema.users.managerId
      })
      .from(schema.leads)
      .leftJoin(schema.users, eq(schema.leads.assignedToId, schema.users.id))
      .where(
        and(
          eq(schema.leads.isArchived, false),
          not(eq(schema.leads.status, 'WON')),
          not(eq(schema.leads.status, 'LOST')),
          lt(schema.leads.updatedAt, sevenDaysAgo)
        )
      );

      if (neglectedLeads.length === 0) {
        return;
      }

      const io = app.get('io');

      // Build list of leads already escalated today to avoid daily spam
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const alreadyNotifiedToday = new Set();
      const recentNotifs = await db.select({ entityId: schema.notifications.entityId })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.type, 'LEAD_NEGLECTED'),
            lt(todayStart, schema.notifications.createdAt)
          )
        );
      for (const n of recentNotifs) alreadyNotifiedToday.add(n.entityId);
      
      for (const lead of neglectedLeads) {
        if (!lead.assignedToId) continue;
        // Skip if already escalated today — prevents daily spam for long-neglected leads
        if (alreadyNotifiedToday.has(lead.id)) continue;

        const employeeId = lead.assignedToId;
        const managerId = lead.assignedToManagerId;
        const body = `Lead #${lead.leadNumber} has not been updated in over 7 days.`;

        // 1. Notify the Employee
        if (io) {
          io.emit('notification', {
            type: 'LEAD_NEGLECTED',
            title: 'Lead Needs Attention',
            body,
            entityType: 'lead',
            entityId: lead.id,
            targetUserId: employeeId
          });
        }
        await db.insert(schema.notifications).values({
          id: randomUUID(),
          userId: employeeId,
          type: 'LEAD_NEGLECTED',
          title: 'Lead Needs Attention',
          body,
          entityType: 'lead',
          entityId: lead.id,
          isRead: false,
          createdAt: new Date()
        });

        // 2. Escalate to the Manager (if they have one)
        if (managerId) {
          const escBody = `Escalation: ${lead.assignedToFirstName} has a lead (#${lead.leadNumber}) untouched for over 7 days.`;
          if (io) {
            io.emit('notification', {
              type: 'LEAD_ESCALATED',
              title: 'Lead Escalation',
              body: escBody,
              entityType: 'lead',
              entityId: lead.id,
              targetUserId: managerId
            });
          }
          await db.insert(schema.notifications).values({
            id: randomUUID(),
            userId: managerId,
            type: 'LEAD_ESCALATED',
            title: 'Lead Escalation',
            body: escBody,
            entityType: 'lead',
            entityId: lead.id,
            isRead: false,
            createdAt: new Date()
          });
        }
      }

      console.log(`[CRON] Escalated ${neglectedLeads.length} neglected leads.`);
    } catch (error) {
      console.error('[CRON] Error running Lead Escalation sync:', error.message);
    }
  });
};

module.exports = startLeadEscalationJob;
