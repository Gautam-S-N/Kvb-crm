const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.quotation.findMany({
  where: { templateType: 'SOLAR_TUNNEL_DRYER' },
  select: { id: true, quotationNumber: true, totalAmount: true, customFields: true }
}).then(rows => {
  rows.forEach(r => {
    const cf = r.customFields || {};
    console.log('QTN:', r.quotationNumber, '| totalAmount:', r.totalAmount);
    console.log('  ALL customFields:', JSON.stringify(cf, null, 2));
    console.log('---');
  });
}).catch(console.error).finally(() => prisma.$disconnect());
