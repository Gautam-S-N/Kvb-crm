/**
 * scripts/backfillHierarchyPath.js
 * One-time script: builds hierarchyPath for all existing users.
 * Run once with: node scripts/backfillHierarchyPath.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function buildPath(userId, cache = {}) {
  if (cache[userId]) return cache[userId];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true }
  });

  if (!user?.managerId) {
    cache[userId] = null; // root user — no path
    return null;
  }

  const parentPath = await buildPath(user.managerId, cache);
  const path = (parentPath || `/${user.managerId}/`) + `${userId}/`;
  cache[userId] = path;
  return path;
}

async function migrate() {
  const users = await prisma.user.findMany({ select: { id: true, managerId: true } });
  const cache = {};
  let updated = 0;

  for (const u of users) {
    if (!u.managerId) continue; // roots have no path
    const path = await buildPath(u.id, cache);
    if (path) {
      await prisma.user.update({ where: { id: u.id }, data: { hierarchyPath: path } });
      console.log(`✓ ${u.id} → ${path}`);
      updated++;
    }
  }

  console.log(`\nDone — ${updated} users backfilled.`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
