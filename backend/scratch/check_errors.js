const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- Checking Material Model ---');
    const mCount = await prisma.material.count();
    console.log('Material count:', mCount);
    
    const m = await prisma.material.findFirst();
    if (m) {
      console.log('Sample Material:', Object.keys(m));
      console.log('Sample ItemName:', m.itemName);
      console.log('Sample Balance:', m.balance);
    }
    
    console.log('--- Checking Dashboard Metrics Calculation ---');
    const [totalMaterials, stockValueResult] = await Promise.all([
      prisma.material.count(),
      prisma.material.aggregate({
        _sum: {
          balance: true,
          totalValue: true
        }
      })
    ]);
    console.log('Dashboard Aggregates:', { totalMaterials, stockValueResult });

  } catch (err) {
    console.error('CRITICAL ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
