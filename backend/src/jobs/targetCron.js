const cron = require('node-cron');

// Run everyday at 23:55 (11:55 PM) to automatically refresh target attainments globally
const startCronJobs = () => {
  cron.schedule('55 23 * * *', async () => {
    console.log('[CRON] Running daily Target Attainment refresh...');
    try {
      // In a real production scenario, doing this via internal DB logic instead of http request is safer,
      // but hitting the API is an easy standardized way to trigger the refresh logic with its side effects.
      // E.g. we'd have a system admin token or extract the logic. For now, doing direct DB import.
      
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear  = now.getFullYear();

      const targets = await prisma.salesTarget.findMany({
        where: { periodType: 'MONTHLY', periodYear: currentYear, periodNumber: currentMonth }
      });

      for (const t of targets) {
        const monthStart = new Date(t.periodYear, t.periodNumber - 1, 1);
        const monthEnd   = new Date(t.periodYear, t.periodNumber, 1);

        const [salesAgg, wonLeads, quotationsSent] = await Promise.all([
          prisma.sale.aggregate({
            where: { createdById: t.employeeId, createdAt: { gte: monthStart, lt: monthEnd } },
            _sum: { totalAmount: true }
          }),
          prisma.lead.count({
            where: { assignedToId: t.employeeId, status: 'WON', updatedAt: { gte: monthStart, lt: monthEnd } }
          }),
          prisma.quotation.count({
            where: { createdById: t.employeeId, createdAt: { gte: monthStart, lt: monthEnd } }
          })
        ]);

        const revenueAchieved = parseFloat(salesAgg._sum.totalAmount || 0);

        await prisma.salesTarget.update({
          where: { id: t.id },
          data: { revenueAchieved, leadsAchieved: wonLeads, quotationsSent }
        });
      }
      console.log(`[CRON] Refreshed ${targets.length} targets successfully.`);
    } catch (error) {
      console.error('[CRON] Error running Target Attainment sync:', error.message);
    }
  });
};

module.exports = startCronJobs;
