/**
 * taskCron.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hourly cron that handles overdue tasks and escalations.
 */

const cron = require('node-cron');
const { eq, and, lt, inArray } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
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
      const overdueNow = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        assignedToId: schema.tasks.assignedToId,
        createdById: schema.tasks.createdById
      })
      .from(schema.tasks)
      .where(
        and(
          lt(schema.tasks.dueDate, now),
          inArray(schema.tasks.status, ['PENDING', 'IN_PROGRESS']),
          eq(schema.tasks.isArchived, false)
        )
      );

      if (overdueNow.length > 0) {
        const overdueIds = overdueNow.map(t => t.id);
        
        await db.update(schema.tasks)
          .set({ status: 'OVERDUE' })
          .where(inArray(schema.tasks.id, overdueIds));

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
      const toEscalateRows = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        assignedToId: schema.tasks.assignedToId,
        createdById: schema.tasks.createdById,
        assignedToId_: schema.users.id,
        assignedToFirstName: schema.users.firstName,
        assignedToLastName: schema.users.lastName,
        assignedToManagerId: schema.users.managerId
      })
      .from(schema.tasks)
      .leftJoin(schema.users, eq(schema.tasks.assignedToId, schema.users.id))
      .where(
        and(
          eq(schema.tasks.status, 'OVERDUE'),
          eq(schema.tasks.isArchived, false),
          lt(schema.tasks.updatedAt, escalationThreshold)
        )
      );

      const toEscalate = toEscalateRows.map(r => ({
        id: r.id,
        title: r.title,
        assignedToId: r.assignedToId,
        createdById: r.createdById,
        assignedTo: r.assignedToId_ ? {
          id: r.assignedToId_,
          firstName: r.assignedToFirstName,
          lastName: r.assignedToLastName,
          managerId: r.assignedToManagerId
        } : null
      }));

      for (const task of toEscalate) {
        const managerId = task.assignedTo?.managerId;

        if (task.createdById !== task.assignedToId) {
          await sendNotification(io, {
            userId: task.createdById,
            type: 'TASK_ESCALATED',
            title: '🚨 Task Escalation',
            body: `"${task.title}" assigned to ${task.assignedTo?.firstName || 'subordinate'} has been overdue for more than ${escalationHours} hours.`,
            entityType: 'task',
            entityId: task.id
          }).catch(err =>
            console.error(`[TASK CRON] Escalation notification to creator failed for task ${task.id}:`, err.message)
          );
        }

        if (managerId && managerId !== task.createdById) {
          await sendNotification(io, {
            userId: managerId,
            type: 'TASK_ESCALATED',
            title: '🚨 Team Task Escalation',
            body: `"${task.title}" (assigned to ${task.assignedTo?.firstName || ''} ${task.assignedTo?.lastName || ''}) has been overdue for more than ${escalationHours} hours.`,
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
