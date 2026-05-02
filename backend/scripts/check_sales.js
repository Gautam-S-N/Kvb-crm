const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const s = await prisma.sale.findMany({ include: { createdBy: true } });
  console.log(s.map(x => ({ amt: x.totalAmount, user: x.createdBy.firstName })));
}
run().catch(console.error).finally(() => prisma.$disconnect());
