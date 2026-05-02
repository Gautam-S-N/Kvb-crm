/**
 * diagnose_targets.js
 * Run: node scripts/diagnose_targets.js
 *
 * Diagnoses whether sales targets are correctly calculating achievements.
 * Checks: target records, sales in period, leads WON, quotations sent.
 * Prints a clear pass/fail for each target so you can see exactly what's wrong.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getPeriodDates = (periodType, periodYear, periodNumber) => {
  const year = parseInt(periodYear);
  const num  = parseInt(periodNumber) || 1;
  let start, end;

  switch (periodType) {
    case 'WEEKLY':
      start = new Date(year, 0, 1 + (num - 1) * 7);
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1);
      end = new Date(start); end.setDate(end.getDate() + 7);
      break;
    case 'MONTHLY':
      start = new Date(year, num - 1, 1);
      end   = new Date(year, num, 1);
      break;
    case 'QUARTERLY':
      start = new Date(year, (num - 1) * 3, 1);
      end   = new Date(year, num * 3, 1);
      break;
    case 'YEARLY':
      start = new Date(year, 0, 1);
      end   = new Date(year + 1, 0, 1);
      break;
    default:
      start = new Date(year, 0, 1);
      end   = new Date(year + 1, 0, 1);
  }
  return { start, end };
};

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  SALES TARGET ACHIEVEMENT DIAGNOSTIC');
  console.log('══════════════════════════════════════════════════\n');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. Count total targets in DB
  const totalTargets = await prisma.salesTarget.count();
  const thisYearTargets = await prisma.salesTarget.count({ where: { periodYear: currentYear } });
  const thisMonthTargets = await prisma.salesTarget.count({
    where: { periodYear: currentYear, periodType: 'MONTHLY', periodNumber: currentMonth }
  });

  console.log(`📊 Total targets in DB:              ${totalTargets}`);
  console.log(`📊 Targets for ${currentYear}:             ${thisYearTargets}`);
  console.log(`📊 Targets for ${currentYear} month ${currentMonth}: ${thisMonthTargets}`);

  if (thisYearTargets === 0) {
    console.log('\n⚠️  NO TARGETS FOUND FOR CURRENT YEAR. Create a target first!\n');
    await prisma.$disconnect();
    return;
  }

  // 2. Check total sales in DB
  const totalSales = await prisma.sale.count();
  const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const thisMonthEnd   = new Date(currentYear, currentMonth, 1);

  const salesThisMonthByCreatedAt = await prisma.sale.count({
    where: { createdAt: { gte: thisMonthStart, lt: thisMonthEnd } }
  });
  const salesThisMonthBySaleDate = await prisma.sale.count({
    where: { saleDate: { gte: thisMonthStart, lt: thisMonthEnd } }
  });
  const salesRevenue = await prisma.sale.aggregate({
    where: {
      saleDate: { gte: thisMonthStart, lt: thisMonthEnd },
      status: { notIn: ['CANCELLED'] }
    },
    _sum: { totalAmount: true }
  });

  console.log(`\n💰 Total sales in DB:                   ${totalSales}`);
  console.log(`💰 Sales this month (by createdAt):     ${salesThisMonthByCreatedAt}`);
  console.log(`💰 Sales this month (by saleDate):      ${salesThisMonthBySaleDate}`);
  console.log(`💰 Revenue this month (by saleDate):    ₹${Number(salesRevenue._sum.totalAmount || 0).toLocaleString('en-IN')}`);

  // 3. Won leads this month
  const wonLeadsThisMonth = await prisma.lead.count({
    where: {
      status: 'WON',
      isArchived: false,
      updatedAt: { gte: thisMonthStart, lt: thisMonthEnd }
    }
  });
  console.log(`🏆 WON leads this month:                ${wonLeadsThisMonth}`);

  // 4. Quotations this month
  const quotationsThisMonth = await prisma.quotation.count({
    where: { createdAt: { gte: thisMonthStart, lt: thisMonthEnd } }
  });
  console.log(`📄 Quotations this month:               ${quotationsThisMonth}`);

  // 5. Per-target breakdown
  console.log('\n──────────────────────────────────────────────────');
  console.log('  PER-TARGET BREAKDOWN (current year)');
  console.log('──────────────────────────────────────────────────');

  const targets = await prisma.salesTarget.findMany({
    where: { periodYear: currentYear },
    include: {
      employee: { select: { firstName: true, lastName: true, role: true } }
    },
    orderBy: [{ periodNumber: 'asc' }]
  });

  for (const t of targets) {
    const { start, end } = getPeriodDates(t.periodType, t.periodYear, t.periodNumber);

    const [saleAgg, leads, quotes] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          createdById: t.employeeId,
          saleDate: { gte: start, lt: end },
          status: { notIn: ['CANCELLED'] }
        },
        _sum: { totalAmount: true }
      }),
      prisma.lead.count({
        where: {
          assignedToId: t.employeeId,
          status: 'WON',
          isArchived: false,
          updatedAt: { gte: start, lt: end }
        }
      }),
      prisma.quotation.count({
        where: { createdById: t.employeeId, createdAt: { gte: start, lt: end } }
      })
    ]);

    const actualRevenue = Number(saleAgg._sum.totalAmount || 0);
    const storedRevenue = Number(t.revenueAchieved);
    const inSync = Math.abs(actualRevenue - storedRevenue) < 1; // within ₹1

    const emp = t.employee;
    const empName = `${emp.firstName} ${emp.lastName}`;
    const period = `${t.periodType} ${t.periodNumber}/${t.periodYear}`;

    console.log(`\n  👤 ${empName} (${t.employeeId.slice(-8)})`);
    console.log(`     Period:     ${period} | ${start.toDateString()} → ${end.toDateString()}`);
    console.log(`     Revenue:    Stored=₹${storedRevenue.toLocaleString('en-IN')} | Actual=₹${actualRevenue.toLocaleString('en-IN')} ${inSync ? '✅' : '❌ OUT OF SYNC'}`);
    console.log(`     Leads WON:  Stored=${t.leadsAchieved} | Actual=${leads}`);
    console.log(`     Quotations: Stored=${t.quotationsSent} | Actual=${quotes}`);
    console.log(`     Target:     Revenue=₹${Number(t.revenueTarget).toLocaleString('en-IN')} | Leads=${t.leadsTarget} | Quotes=${t.quotationsTarget}`);
    if (!inSync) {
      console.log(`     ⚠️  NEEDS REFRESH — run POST /api/targets/refresh`);
    }
  }

  // 6. Check notification enum types
  console.log('\n──────────────────────────────────────────────────');
  console.log('  NOTIFICATION SYSTEM CHECK');
  console.log('──────────────────────────────────────────────────');
  const notifCount = await prisma.notification.count();
  const recentNotifs = await prisma.notification.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    select: { type: true, title: true, createdAt: true }
  });
  console.log(`\n  Total notifications in DB: ${notifCount}`);
  recentNotifs.forEach(n => {
    console.log(`  - [${n.type}] "${n.title}" @ ${new Date(n.createdAt).toLocaleString('en-IN')}`);
  });

  console.log('\n══════════════════════════════════════════════════');
  console.log('  DIAGNOSIS COMPLETE');
  console.log('══════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Diagnostic failed:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
