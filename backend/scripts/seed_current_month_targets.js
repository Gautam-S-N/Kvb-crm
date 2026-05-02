/**
 * seed_current_month_targets.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script: creates targets for the CURRENT month (May 2026) for every
 * employee who has a target in any other period of 2026, copying their target
 * amounts. Only creates if one doesn't already exist (safe to re-run).
 *
 * Run: node scripts/seed_current_month_targets.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const currentYear   = now.getFullYear();
  const currentMonth  = now.getMonth() + 1;

  console.log(`\n🗓  Creating MONTHLY targets for ${currentMonth}/${currentYear}...\n`);

  // Find all existing 2026 targets grouped by employee
  const existing = await prisma.salesTarget.findMany({
    where: { periodYear: currentYear },
    include: {
      employee: { select: { firstName: true, lastName: true } }
    }
  });

  if (!existing.length) {
    console.log('No existing 2026 targets found. Please create targets manually first.');
    await prisma.$disconnect();
    return;
  }

  // Deduplicate: one target per employee for MONTHLY period
  const seen = new Set();
  let created = 0;
  let skipped = 0;

  for (const t of existing) {
    if (t.periodType !== 'MONTHLY') continue; // Only copy MONTHLY targets
    const key = `${t.employeeId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Check if a target for this employee/month already exists
    const alreadyExists = await prisma.salesTarget.findUnique({
      where: {
        employeeId_periodType_periodYear_periodNumber: {
          employeeId:   t.employeeId,
          periodType:   'MONTHLY',
          periodYear:   currentYear,
          periodNumber: currentMonth
        }
      }
    });

    if (alreadyExists) {
      console.log(`  ⏭  ${t.employee.firstName} ${t.employee.lastName} — already has target for ${currentMonth}/${currentYear}`);
      skipped++;
      continue;
    }

    await prisma.salesTarget.create({
      data: {
        employeeId:      t.employeeId,
        createdById:     t.createdById,
        periodType:      'MONTHLY',
        periodYear:      currentYear,
        periodNumber:    currentMonth,
        revenueTarget:   t.revenueTarget,
        leadsTarget:     t.leadsTarget,
        quotationsTarget: t.quotationsTarget,
        isRecurring:     t.isRecurring,
        notes:           `Auto-seeded from Jan 2026 target for current month`
      }
    });

    console.log(`  ✅  Created target for ${t.employee.firstName} ${t.employee.lastName}: Revenue=₹${Number(t.revenueTarget).toLocaleString('en-IN')}, Leads=${t.leadsTarget}, Quotes=${t.quotationsTarget}`);
    created++;
  }

  console.log(`\n📋 Summary: ${created} target(s) created, ${skipped} already existed.\n`);

  if (created > 0) {
    console.log('🔄 Now running achievement refresh on new targets...\n');

    // Inline refresh for immediate effect
    const { refreshTargets } = require('../src/services/achievement.service');
    const { refreshed, errors } = await refreshTargets(
      { periodYear: currentYear, periodType: 'MONTHLY', periodNumber: currentMonth },
      null
    );
    console.log(`✅ Refreshed ${refreshed} target(s). Errors: ${errors.length}`);
    if (errors.length) errors.forEach(e => console.error('  ❌', e));
  }

  await prisma.$disconnect();
  console.log('\nDone. Restart is NOT needed — refresh runs in-process.\n');
}

main().catch(err => {
  console.error('Script failed:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
