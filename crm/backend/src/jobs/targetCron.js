/**
 * targetCron.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Nightly cron that refreshes ALL active targets for the current year.
 *
 * FIXES vs old version:
 *  - Now handles ALL period types (WEEKLY, MONTHLY, QUARTERLY, YEARLY) — not just MONTHLY.
 *  - Uses the AchievementService which processes children BEFORE parents (bottom-up),
 *    preventing the "manager data overwritten with only direct sales" bug.
 *  - Archived records are excluded by the AchievementService automatically.
 *  - All failures are logged with context. A single target failure no longer
 *    halts the entire run.
 *
 * Runs at: 23:55 every night (configurable via CRON_TARGET_REFRESH env var).
 */

const cron = require('node-cron');
const { refreshTargets } = require('../services/achievement.service');

const startCronJobs = (app) => {
  const schedule = process.env.CRON_TARGET_REFRESH || '55 23 * * *';

  cron.schedule(schedule, async () => {
    console.log('[CRON] Starting nightly Target Attainment refresh...');
    const io = app ? app.get('io') : null;

    try {
      const now = new Date();
      // Refresh all targets whose periodYear matches the current calendar year
      const { refreshed, errors } = await refreshTargets(
        { periodYear: now.getFullYear() },
        io
      );

      if (errors.length > 0) {
        console.warn(`[CRON] Refresh completed with ${errors.length} error(s):`);
        errors.forEach(e => console.warn(' -', e));
      }

      console.log(`[CRON] Target refresh done. Refreshed: ${refreshed}, Errors: ${errors.length}`);
    } catch (err) {
      console.error('[CRON] Fatal error during Target Attainment refresh:', err.message);
    }
  });
};

// Support both old usage (no app) and new usage (with app for io access)
module.exports = startCronJobs;
