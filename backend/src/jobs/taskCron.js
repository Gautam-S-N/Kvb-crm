/**
 * taskCron.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hourly cron that:
 *   1. Marks overdue tasks: transitions PENDING/IN_PROGRESS tasks to OVERDUE
 *      when their dueDate has passed.
 *   2. Notifies the assigned employee that their task is now overdue.
 *   3. Escalates to the manager if a task has been OVERDUE for >48 hours
 *      without any update (configurable via TASK_ESCALATION_HOURS env var).
 *
 * Runs at: every hour (configurable via CRON_TASK_OVERDUE env var).
 * Frequency: 'hourly' — change CRON_TASK_OVERDUE to "0,30 * * * *" for every 30 minutes.
 */

const cron = require('node-cron');
const prisma = require('../utils/db');
const { sendNotification } = require('../services/notification.service');

const startTaskCron = (app) => {
  const schedule = process.env.CRON_TASK_OVERDUE || '0 * * * *'; // Every hour
  const escalationHours = parseInt(process.env.TASK_ESCALATION_HOURS || '48');

  cron.schedule(schedule, async () => {
    console.log('[TASK CRON] Running overdue task check...');
    const io = app ? app.get('io') : null;

    try {
      const now = new Date();
      const escalationThreshold = new Date(now.getTime() - escalationHours * 60 * 60 * 1000);

      // ── Step 1: Find tasks that should be marked overdue ─────────────────
      const overdueNow = await prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          isArchived: false
        },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, managerId: true } },
          createdBy:  { select: { id: true, firstName: true, lastName: true } }
        }
      });

      if (overdueNow.length > 0) {
        // Bulk update all to OVERDUE in a single query
        await prisma.task.updateMany({
          where: {
            id: { in: overdueNow.map(t => t.id) }
          },
          data: { status: 'OVERDUE' }
        });

        // Send a notification to each newly-overdue task's assignee
        for (const task of overdueNow) {
          await sendNotification(io, {
            userId: task.assignedToId,
            type: 'TASK_OVERDUE',
            title: '⚠️ Task Overdue',
            body: `"${task.title}" was due on ${new Date(task.dueDate).toLocaleDateString('en-IN')} and is now overdue.`,
            entityType: 'task',
            entityId: task.id
          }).catch(err =>
            console.error(`[TASK CRON] Notification failed for task ${task.id}:`, err.message)
          );
        }

        console.log(`[TASK CRON] Marked ${overdueNow.length} task(s) as OVERDUE and notified assignees.`);
      }

      // ── Step 2: Escalate tasks that have been OVERDUE for >N hours ────────
      const toEscalate = await prisma.task.findMany({
        where: {
          status: 'OVERDUE',
          isArchived: false,
          updatedAt: { lt: escalationThreshold }
        },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, managerId: true } },
          createdBy:  { select: { id: true, firstName: true, lastName: true } }
        }
      });

      for (const task of toEscalate) {
        const managerId = task.assignedTo?.managerId;

        // Notify the creator (if they didn't create it themselves)
        if (task.createdById !== task.assignedToId) {
          await sendNotification(io, {
            userId: task.createdById,
            type: 'TASK_ESCALATED',
            title: '🚨 Task Escalation',
            body: `"${task.title}" assigned to ${task.assignedTo.firstName} has been overdue for more than ${escalationHours} hours.`,
            entityType: 'task',
            entityId: task.id
          }).catch(err =>
            console.error(`[TASK CRON] Escalation notification to creator failed for task ${task.id}:`, err.message)
          );
        }

        // Also notify the direct manager if one exists
        if (managerId && managerId !== task.createdById) {
          await sendNotification(io, {
            userId: managerId,
            type: 'TASK_ESCALATED',
            title: '🚨 Team Task Escalation',
            body: `"${task.title}" (assigned to ${task.assignedTo.firstName} ${task.assignedTo.lastName}) has been overdue for more than ${escalationHours} hours.`,
            entityType: 'task',
            entityId: task.id
          }).catch(err =>
            console.error(`[TASK CRON] Escalation notification to manager failed for task ${task.id}:`, err.message)
          );
        }
      }

      if (toEscalate.length > 0) {
        console.log(`[TASK CRON] Escalated ${toEscalate.length} task(s) to their managers/creators.`);
      }

    } catch (err) {
      console.error('[TASK CRON] Error during overdue task check:', err.message);
    }
  });

  console.log(`[TASK CRON] Overdue check scheduled (${schedule}). Escalation threshold: ${escalationHours}h.`);
};

module.exports = startTaskCron;
