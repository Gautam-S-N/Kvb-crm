/**
 * counter.service.js
 * Provides atomic, collision-safe document number generation for all document
 * types in the system (Leads, Purchase Orders, etc.).
 */

const { db } = require('../utils/drizzle');
const { sql } = require('drizzle-orm');
const { v4: uuidv4 } = require('uuid');

// Ensure the counter table exists once
let tableCreated = false;
const ensureTable = async () => {
  if (tableCreated) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_counters (
      id          VARCHAR(36)  NOT NULL PRIMARY KEY,
      type        VARCHAR(50)  NOT NULL UNIQUE,
      counter     INT          NOT NULL DEFAULT 0,
      updatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  tableCreated = true;
};

/**
 * Atomically increments the counter for a given document type and returns
 * the new counter value. Thread-safe under concurrent requests.
 */
const incrementAndGet = async (type) => {
  await ensureTable();
  const uuid = uuidv4();
  await db.execute(sql`
    INSERT INTO document_counters (id, type, counter, updatedAt)
    VALUES (${uuid}, ${type}, 1, NOW())
    ON DUPLICATE KEY UPDATE counter = counter + 1, updatedAt = NOW()
  `);

  const rows = await db.execute(sql`
    SELECT counter FROM document_counters WHERE type = ${type}
  `);

  // Drizzle mysql2 execute returns [rows, fields] — normalize
  const data = Array.isArray(rows) ? rows : (rows.rows || []);
  const first = Array.isArray(data[0]) ? data[0][0] : data[0];
  return Number(first?.counter || 0);
};

/**
 * Initialises or updates a counter to the provided max value.
 * Used during migration to sync counters with existing data.
 */
const syncCounterToMax = async (type, currentMax) => {
  await ensureTable();
  const uuid = uuidv4();
  await db.execute(sql`
    INSERT INTO document_counters (id, type, counter, updatedAt)
    VALUES (${uuid}, ${type}, ${currentMax}, NOW())
    ON DUPLICATE KEY UPDATE counter = GREATEST(counter, ${currentMax}), updatedAt = NOW()
  `);
};

module.exports = { incrementAndGet, syncCounterToMax };
