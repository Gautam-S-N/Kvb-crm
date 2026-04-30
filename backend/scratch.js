const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.quotation.findMany().then(s => console.log(s.map(q => ({ id: q.id, num: q.quotationNumber })))).finally(() => prisma.$disconnect());
