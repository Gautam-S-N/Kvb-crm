const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.quotation.findFirst({
  where: { templateType: 'SOLAR_TUNNEL_DRYER' },
  orderBy: { createdAt: 'desc' }
}).then(q => {
  console.log('LATEST QUOTATION:', q.quotationNumber);
  console.log('totalAmount:', q.totalAmount);
  console.log('customFields:', JSON.stringify(q.customFields, null, 2));
}).finally(() => prisma.$disconnect());
