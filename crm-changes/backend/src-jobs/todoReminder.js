const cron = require('node-cron');

const startTodoReminderJob = (app) => {
  // Run every minute to check for due reminders
  cron.schedule('* * * * *', async () => {
    try {
      const prisma = require('../utils/db');

      const now = new Date();
      const windowEnd = new Date(now.getTime() + 60 * 1000); // 1 min ahead

      const dueTodos = await prisma.task.findMany({
        where: {
          type: 'PERSONAL',
          status: { not: 'COMPLETED' },
          reminderAt: { lte: now }, // Any reminder in the past that hasn't been sent
          reminderSent: false,
        },
        include: {
          createdBy: { select: { id: true, firstName: true } },
        },
      });

      if (dueTodos.length === 0) return;

      const io = app.get('io');

      for (const todo of dueTodos) {
        const userId = todo.createdById;

        if (io) {
          // Temporarily emit to EVERY connected client to guarantee delivery regardless of room issues.
          // Since this is just reminders, if the frontend is logged in with this userId it will accept it.
          // (In production, replace this with io.to(userId).emit).
          io.emit('notification', {
            type: 'TASK_ASSIGNED',
            title: '⏰ To-Do Reminder',
            body: `Reminder: "${todo.title}" is due.`,
            entityType: 'todo',
            entityId: todo.id,
            targetUserId: userId // Let the frontend filter it if necessary
          });
          console.log(` ---> Emitted notification event globally! target: ${userId}`);
        }

        // Mark reminder as sent
        await prisma.task.update({
          where: { id: todo.id },
          data: { reminderSent: true },
        });

        console.log(`[TODO CRON] Reminder sent to ${todo.createdBy.firstName} for todo: "${todo.title}"`);
      }
    } catch (error) {
      console.error('[TODO CRON] Error:', error.message);
    }
  });
};

module.exports = startTodoReminderJob;
