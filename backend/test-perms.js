const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany({ select: { id: true, firstName: true, permissions: true } });
  console.log(JSON.stringify(users, null, 2));
}
test().finally(() => prisma.$disconnect());
