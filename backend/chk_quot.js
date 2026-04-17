const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.quotation.findMany({
  where: { templateType: 'SOLAR_TUNNEL_DRYER' },
  select: { id: true, quotationNumber: true, totalAmount: true, customFields: true }
}).then(rows => {
  rows.forEach(r => {
    console.log('ID:', r.id);
    console.log('QTN:', r.quotationNumber, '| totalAmount:', r.totalAmount);
    const cf = r.customFields || {};
    console.log('  cf.totalAmt:', cf.totalAmt, '| cf.unitPrice:', cf.unitPrice, '| cf.amountInWords:', cf.amountInWords);
    console.log('---');
  });
}).catch(console.error).finally(() => prisma.$disconnect());
