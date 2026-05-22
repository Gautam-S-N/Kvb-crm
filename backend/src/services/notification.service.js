/**
 * notification.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised notification helper. ALWAYS writes to the `notifications` table
 * first, then emits via Socket.IO.
 *
 * Usage:
 *   const { sendNotification } = require('../services/notification.service');
 *   await sendNotification(io, { userId, type, title, body, entityType, entityId });
 */

const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// Debounce map: key = `${userId}:${type}:${entityId}`, value = timer
const _debounceMap = new Map();
const DEBOUNCE_MS = 50;

/**
 * Persist a notification to the DB and emit it via Socket.IO.
 *
 * @param {import('socket.io').Server|null} io  - Socket.IO server instance
 * @param {object} payload
 * @param {string}   payload.userId      - Target user ID (who receives the notification)
 * @param {string}   payload.type        - Notification type (e.g. 'TASK_ASSIGNED')
 * @param {string}   payload.title       - Short heading
 * @param {string}   payload.body        - Full message body
 * @param {string}  [payload.entityType] - Related entity type (e.g. 'task')
 * @param {string}  [payload.entityId]   - Related entity ID
 */
const sendNotification = async (io, { userId, type, title, body, entityType, entityId }) => {
  let saved = {
    id: randomUUID(),
    userId,
    type,
    title,
    body,
    entityType: entityType || null,
    entityId: entityId || null,
    isRead: false,
    createdAt: new Date()
  };

  try {
    await db.insert(schema.notifications).values(saved);
  } catch (err) {
    console.error('[NotificationService] DB persist failed:', err.message);
  }

  if (!io) return saved;
  const debounceKey = `${userId}:${type}:${entityId || ''}`;
  if (_debounceMap.has(debounceKey)) return saved;

  _debounceMap.set(debounceKey, true);
  setTimeout(() => _debounceMap.delete(debounceKey), DEBOUNCE_MS);

  io.to(userId).emit('notification', {
    ...saved,
    type,
    title,
    body,
    entityType,
    entityId,
    targetUserId: userId
  });

  return saved;
};

/**
 * Emit a data refresh event without persisting a notification.
 * Used for UI refresh signals (e.g. REFRESH_DATA module events).
 *
 * @param {import('socket.io').Server|null} io
 * @param {string} module - Module name (e.g. 'TARGETS', 'TASKS')
 */
const emitRefresh = (io, module) => {
  if (!io) return;
  io.emit('REFRESH_DATA', { module });
};

module.exports = { sendNotification, emitRefresh };
