const cron = require('node-cron');

const startLeadEscalationJob = (app) => {
  // Run everyday at 09:00 AM to check for neglected leads
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily Lead Escalation check...');
    try {
      const prisma = require('../utils/db');
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find active leads that haven't been touched in over 7 days
      const neglectedLeads = await prisma.lead.findMany({
        where: {
          isArchived: false,
          status: { notIn: ['WON', 'LOST'] },
          updatedAt: { lt: sevenDaysAgo }
        },
        include: { 
          assignedTo: { select: { id: true, firstName: true, managerId: true } } 
        }
      });

      if (neglectedLeads.length === 0) {
        console.log('[CRON] No neglected leads found.');
        return;
      }

      const io = app.get('io');
      
      for (const lead of neglectedLeads) {
        if (!lead.assignedTo) continue;

        const employeeId = lead.assignedTo.id;
        const managerId = lead.assignedTo.managerId;
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
        await prisma.notification.create({
          data: {
            userId: employeeId,
            type: 'LEAD_NEGLECTED',
            title: 'Lead Needs Attention',
            body,
            entityType: 'lead',
            entityId: lead.id
          }
        });

        // 2. Escalate to the Manager (if they have one)
        if (managerId) {
          const escBody = `Escalation: ${lead.assignedTo.firstName} has a lead (#${lead.leadNumber}) untouched for over 7 days.`;
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
          await prisma.notification.create({
            data: {
              userId: managerId,
              type: 'LEAD_ESCALATED',
              title: 'Lead Escalation',
              body: escBody,
              entityType: 'lead',
              entityId: lead.id
            }
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
