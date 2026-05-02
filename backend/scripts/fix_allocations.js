const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targets = await prisma.salesTarget.findMany({
    where: { periodYear: 2026, periodType: 'MONTHLY' }
  });

  console.log(`Found ${targets.length} targets`);

  // Separate Jan vs May
  const janTargets = targets.filter(t => t.periodNumber === 1);
  const mayTargets = targets.filter(t => t.periodNumber === 5);

  for (const mayT of mayTargets) {
    // Find corresponding Jan target for same employee
    const matchingJanT = janTargets.find(t => t.employeeId === mayT.employeeId);
    if (matchingJanT && matchingJanT.parentTargetId) {
      // Find the May equivalent of the manager's target
      const managerJanId = matchingJanT.parentTargetId;
      const managerJanTarget = janTargets.find(t => t.id === managerJanId);
      
      if (managerJanTarget) {
        const managerMayTarget = mayTargets.find(t => t.employeeId === managerJanTarget.employeeId);
        if (managerMayTarget) {
          console.log(`Fixing allocation for employee ${mayT.employeeId}: linking to parent ${managerMayTarget.id}`);
          await prisma.salesTarget.update({
            where: { id: mayT.id },
            data: { parentTargetId: managerMayTarget.id }
          });
        }
      }
    }
  }

  // Refresh targets
  const { refreshTargets } = require('../src/services/achievement.service');
  await refreshTargets({ periodYear: 2026, periodType: 'MONTHLY', periodNumber: 5 }, null);

  console.log('Fixed parentTargetIds and refreshed achievements');
}

main().catch(console.error).finally(() => prisma.$disconnect());
