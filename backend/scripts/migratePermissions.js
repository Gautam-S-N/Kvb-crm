/**
 * scripts/migratePermissions.js
 *
 * One-time script: reads the `permissions` JSON blob for every user
 * and backfills the new native Boolean columns:
 *   canAssignLeads, canAssignTasks, canViewSubordinates
 *
 * Run once with: node scripts/migratePermissions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, permissions: true }
  });

  let updated = 0;
  for (const user of users) {
    if (!user.permissions) continue;

    const perms = typeof user.permissions === 'string'
      ? JSON.parse(user.permissions)
      : user.permissions;

    const canAssignLeads      = Boolean(perms.canAssignLeads);
    const canAssignTasks      = Boolean(perms.canAssignTasks);
    const canViewSubordinates = Boolean(perms.canViewSubordinates);

    await prisma.user.update({
      where: { id: user.id },
      data: { canAssignLeads, canAssignTasks, canViewSubordinates }
    });

    console.log(
      `✓ ${user.firstName}: canAssignLeads=${canAssignLeads}, canAssignTasks=${canAssignTasks}, canViewSubordinates=${canViewSubordinates}`
    );
    updated++;
  }

  console.log(`\nDone — ${updated} users backfilled.`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
