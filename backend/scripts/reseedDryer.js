/**
 * scripts/reseedDryer.js
 * Wipes all existing "Dryer Component" records and re-seeds them
 * in the exact order from the "Material List for Dryer" sheet.
 * Run: node scripts/reseedDryer.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRYER_ITEMS = [
  { slNo: 1,  item: 'Arch Material',               size: '40x40' },
  { slNo: 2,  item: 'Base Frame',                  size: '40x40' },
  { slNo: 3,  item: 'Perlin Material',             size: null },
  { slNo: 4,  item: 'Door Material',               size: null },
  { slNo: 5,  item: 'Front and Rear Face Material',size: null },
  { slNo: 6,  item: 'Trolley Material',            size: null },
  { slNo: 7,  item: 'Castor Wheels',               size: null },
  { slNo: 8,  item: 'Trays',                       size: null },
  { slNo: 9,  item: 'Top Beed',                    size: null },
  { slNo: 10, item: 'Bottom Beed',                 size: null },
  { slNo: 11, item: 'Door Hinge',                  size: null },
  { slNo: 12, item: 'Door Lock',                   size: null },
  { slNo: 13, item: 'Window',                      size: null },
  { slNo: 14, item: 'Exhaust Fan',                 size: null },
  { slNo: 15, item: 'Circulation Fan',             size: null },
  { slNo: 16, item: 'Control Panel and Sensor',    size: null },
  { slNo: 17, item: 'Wiring Material',             size: null },
  { slNo: 18, item: 'Polycarbonate Sheet',         size: null },
  { slNo: 19, item: 'Fasteners',                   size: null },
  { slNo: 20, item: 'Foundation Tube',             size: null },
  { slNo: 21, item: 'Sealicon Tube',               size: null },
  { slNo: 22, item: 'PV Panel',                    size: null },
  { slNo: 23, item: 'Battery',                     size: null },
  { slNo: 24, item: 'Charge Controller',           size: null },
  { slNo: 25, item: 'Heater',                      size: null },
  { slNo: 26, item: 'Qualorific Unit',             size: null },
  { slNo: 27, item: 'Kadappa Stone',               size: null },
  { slNo: 28, item: 'Cement',                      size: null },
  { slNo: 29, item: 'Block',                       size: null },
  { slNo: 30, item: 'Aggregates',                  size: null },
  { slNo: 31, item: 'Name Plate',                  size: null },
  { slNo: 32, item: 'Welding Machine',             size: null },
  { slNo: 33, item: 'Cutting Machine',             size: null },
  { slNo: 34, item: 'Junction Box',                size: null },
  { slNo: 35, item: 'Welding Rod',                 size: null },
  { slNo: 36, item: 'Cutting Wheel',               size: null },
  { slNo: 37, item: 'Grinding Wheels',             size: null },
  { slNo: 38, item: 'Hand Drilling Machine',       size: null },
  { slNo: 39, item: 'Welding Shield',              size: null },
  { slNo: 40, item: 'Sealicon Feeding Gun',        size: null },
  { slNo: 41, item: 'Anchoring Machine',           size: null },
];

async function run() {
  // 1. Delete all existing Dryer Component records
  const deleted = await prisma.material.deleteMany({
    where: { category: 'Dryer Component' }
  });
  console.log(`🗑️  Deleted ${deleted.count} existing Dryer Component records.`);

  // 2. Re-insert in exact order
  let created = 0;
  for (const row of DRYER_ITEMS) {
    const itemCode = `DC1-${String(row.slNo).padStart(3, '0')}`;
    await prisma.material.create({
      data: {
        itemName:    row.item,
        itemCode,
        category:    'Dryer Component',
        unit:        'Nos',
        rate:        0,
        balance:     0,
        minQuantity: 0,
        remarks:     row.size || '',   // size goes into remarks
      }
    });
    created++;
    console.log(`  ✓ [${row.slNo}] ${row.item}${row.size ? ' — ' + row.size : ''}`);
  }

  console.log(`\n✅ Done — ${created} Dryer Component records seeded in order.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
