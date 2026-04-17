const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function inW(n) {
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+inW(n%100) : '');
  if (n < 100000) return inW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+inW(n%1000) : '');
  if (n < 10000000) return inW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+inW(n%100000) : '');
  return inW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+inW(n%10000000) : '');
}

prisma.quotation.findMany({
  where: { templateType: 'SOLAR_TUNNEL_DRYER' },
  select: { id: true, quotationNumber: true, totalAmount: true, customFields: true }
}).then(rows => {
  rows.forEach(r => {
    const cf = r.customFields || {};
    const totalAmt = Number(cf.totalAmt) || Number(r.totalAmount);
    const unitPrice = Number(cf.unitPrice) || Number(r.totalAmount);
    const amountWords = inW(Math.round(totalAmt)) + ' Rupees Only';
    console.log('=== ' + r.quotationNumber + ' ===');
    console.log('  DB totalAmount:', r.totalAmount);
    console.log('  cf.totalAmt:', cf.totalAmt);
    console.log('  computed totalAmt:', totalAmt);
    console.log('  computed unitPrice:', unitPrice);
    console.log('  amountWords:', amountWords);
  });
}).catch(console.error).finally(() => prisma.$disconnect());
