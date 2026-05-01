const { PrismaClient } = require('@prisma/client');
const { getSubordinateIds } = require('./src/middleware/permission.middleware');
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany({ select: { id: true, firstName: true, managerId: true } });
  console.log('All Users:', users);
  
  for (const u of users) {
    const subs = await getSubordinateIds(u.id);
    console.log(`User ${u.firstName} (${u.id}) subordinates:`, subs);
  }
}
test().finally(() => prisma.$disconnect());
