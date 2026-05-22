const cron = require('node-cron');
const { eq, and, lte, not } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

const startTodoReminderJob = (app) => {
  // Run every minute to check for due reminders
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      const dueTodos = await db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        createdById: schema.tasks.createdById,
        createdByFirstName: schema.users.firstName
      })
      .from(schema.tasks)
      .leftJoin(schema.users, eq(schema.tasks.createdById, schema.users.id))
      .where(
        and(
          eq(schema.tasks.type, 'PERSONAL'),
          not(eq(schema.tasks.status, 'COMPLETED')),
          lte(schema.tasks.reminderAt, now),
          eq(schema.tasks.reminderSent, false)
        )
      );

      if (dueTodos.length === 0) return;

      const io = app.get('io');

      for (const todo of dueTodos) {
        const userId = todo.createdById;

        if (io) {
          io.emit('notification', {
            type: 'TASK_ASSIGNED',
            title: '⏰ To-Do Reminder',
            body: `Reminder: "${todo.title}" is due.`,
            entityType: 'todo',
            entityId: todo.id,
            targetUserId: userId
          });
          console.log(` ---> Emitted notification event globally! target: ${userId}`);
        }

        // Mark reminder as sent
        await db.update(schema.tasks)
          .set({ reminderSent: true })
          .where(eq(schema.tasks.id, todo.id));

        console.log(`[TODO CRON] Reminder sent to ${todo.createdByFirstName || 'User'} for todo: "${todo.title}"`);
      }
    } catch (error) {
      console.error('[TODO CRON] Error:', error.message);
    }
  });
};

module.exports = startTodoReminderJob;
