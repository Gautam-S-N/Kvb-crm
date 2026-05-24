/**
 * cleanupCron.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Nightly cleanup job that removes stale data to prevent unbounded DB / disk growth.
 *
 * What it cleans:
 *  - Old read notifications (> 60 days)
 *  - Orphaned PDF files in /uploads/invoices and /uploads/purchase-orders
 *    that are older than 30 days (receipts are kept as permanent records)
 */

const cron = require('node-cron');
const { lt, and, eq } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const fs = require('fs');
const path = require('path');

const startCleanupJob = () => {
  // Run at 02:30 every night
  cron.schedule('30 2 * * *', async () => {
    try {
      // ── 1. Prune read notifications older than 60 days ─────────────────────
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { rowsAffected } = await db.delete(schema.notifications)
        .where(
          and(
            eq(schema.notifications.isRead, true),
            lt(schema.notifications.createdAt, sixtyDaysAgo)
          )
        );

      if (rowsAffected > 0) {
        console.log(`[CLEANUP CRON] Pruned ${rowsAffected} old read notification(s).`);
      }

      // ── 2. Delete old invoice PDFs (> 30 days) ─────────────────────────────
      // Invoices are regenerated on demand; old ones waste disk space.
      const invoiceDir = path.join(__dirname, '../../uploads/invoices');
      if (fs.existsSync(invoiceDir)) {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(invoiceDir);
        let removed = 0;
        for (const file of files) {
          const fPath = path.join(invoiceDir, file);
          try {
            const stat = fs.statSync(fPath);
            if (stat.mtimeMs < thirtyDaysAgo) {
              fs.unlinkSync(fPath);
              removed++;
            }
          } catch (_) { /* ignore */ }
        }
        if (removed > 0) {
          console.log(`[CLEANUP CRON] Removed ${removed} old invoice PDF(s).`);
        }
      }

      // ── 3. Delete old PO PDFs (> 30 days) ──────────────────────────────────
      const poDir = path.join(__dirname, '../../uploads/purchase-orders');
      if (fs.existsSync(poDir)) {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(poDir);
        let removed = 0;
        for (const file of files) {
          const fPath = path.join(poDir, file);
          try {
            const stat = fs.statSync(fPath);
            if (stat.mtimeMs < thirtyDaysAgo) {
              fs.unlinkSync(fPath);
              removed++;
            }
          } catch (_) { /* ignore */ }
        }
        if (removed > 0) {
          console.log(`[CLEANUP CRON] Removed ${removed} old PO PDF(s).`);
        }
      }

    } catch (err) {
      console.error('[CLEANUP CRON] Error during nightly cleanup:', err.message);
    }
  });

  console.log('[CLEANUP CRON] Nightly cleanup job scheduled (02:30 daily).');
};

module.exports = startCleanupJob;
