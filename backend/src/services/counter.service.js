/**
 * counter.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides atomic, collision-safe document number generation for all document
 * types in the system (Leads, Purchase Orders, etc.).
 *
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for an atomic increment, which is
 * safe for concurrent requests and prevents duplicate numbers.
 *
 * The `document_counters` table is managed via raw SQL so it can be introduced
 * without requiring a full Prisma schema migration that would block existing work.
 */

const prisma = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Atomically increments the counter for a given document type and returns
 * the new counter value. Thread-safe under concurrent requests.
 *
 * @param {string} type - Document type key (e.g. 'LEAD', 'PURCHASE_ORDER')
 * @returns {Promise<number>} - The new counter value
 */
const incrementAndGet = async (type) => {
  // Ensure the table exists (idempotent — safe to call on every request)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS document_counters (
      id          VARCHAR(36)  NOT NULL PRIMARY KEY,
      type        VARCHAR(50)  NOT NULL UNIQUE,
      counter     INT          NOT NULL DEFAULT 0,
      updatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Atomically upsert and increment
  await prisma.$executeRawUnsafe(
    `INSERT INTO document_counters (id, type, counter, updatedAt)
     VALUES (?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE counter = counter + 1, updatedAt = NOW()`,
    uuidv4(), type
  );

  const [row] = await prisma.$queryRawUnsafe(
    'SELECT counter FROM document_counters WHERE type = ?',
    type
  );

  return Number(row.counter);
};

/**
 * Initialises a counter type to the provided value if it doesn't exist yet,
 * OR updates it to the provided value if the provided value is higher.
 * Used during migration to sync counters with existing data.
 *
 * @param {string} type - Document type key
 * @param {number} currentMax - The maximum existing document number in the DB
 */
const syncCounterToMax = async (type, currentMax) => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS document_counters (
      id          VARCHAR(36)  NOT NULL PRIMARY KEY,
      type        VARCHAR(50)  NOT NULL UNIQUE,
      counter     INT          NOT NULL DEFAULT 0,
      updatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    `INSERT INTO document_counters (id, type, counter, updatedAt)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE counter = GREATEST(counter, ?), updatedAt = NOW()`,
    uuidv4(), type, currentMax, currentMax
  );
};

module.exports = { incrementAndGet, syncCounterToMax };
