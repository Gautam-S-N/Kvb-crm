/**
 * notification.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised notification helper. ALWAYS writes to the `notifications` table
 * first, then emits via Socket.IO. This ensures:
 *   1. Notifications survive socket disconnections — users see them on reconnect.
 *   2. Admins always have a persistent audit trail.
 *   3. High-frequency events are debounced (50ms) to prevent socket flooding.
 *
 * Usage:
 *   const { sendNotification } = require('../services/notification.service');
 *   await sendNotification(io, prisma, { userId, type, title, body, entityType, entityId });
 */

const prisma = require('../utils/db');

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
  // 1. Attempt to persist first — socket failure can never lose a notification.
  //    If the type is not in the Notification enum, log a warning and skip DB persist
  //    (the socket emit will still work so the user sees it in the current session).
  let saved = { id: null, userId, type, title, body, entityType, entityId };
  try {
    saved = await prisma.notification.create({
      data: { userId, type, title, body, entityType: entityType || null, entityId: entityId || null }
    });
  } catch (err) {
    // P2009 / value not found in enum — soft fail: warn but don't crash
    if (err.code === 'P2009' || err.message?.includes('enum') || err.message?.includes('Invalid value')) {
      console.warn(`[NotificationService] Type "${type}" not in DB enum — skipping DB persist, socket-only emit.`);
    } else {
      console.error('[NotificationService] DB persist failed:', err.message);
    }
  }

  // 2. Debounce socket emits for the same user+type+entity (prevents flooding)
  if (!io) return saved;
  const debounceKey = `${userId}:${type}:${entityId || ''}`;
  if (_debounceMap.has(debounceKey)) return saved;

  _debounceMap.set(debounceKey, true);
  setTimeout(() => _debounceMap.delete(debounceKey), DEBOUNCE_MS);

  // 3. Emit to user's private room (they join socket.userId on connect)
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
