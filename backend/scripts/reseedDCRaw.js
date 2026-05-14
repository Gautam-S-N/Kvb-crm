/**
 * scripts/reseedDCRaw.js
 * Wipes all existing DC Raw Material records and re-seeds them
 * in exact Sheet3 order with size stored in remarks field.
 * Run: node scripts/reseedDCRaw.js
 */
const XLSX  = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DC_RAW_CATS = ['Sq. Tube','Flat Plate','Rec. Tube','Hardware','Round Tube','Round Rod','L Angle','C Channel'];

async function run() {
  // 1. Delete all existing DC Raw records
  const deleted = await prisma.material.deleteMany({
    where: { category: { in: DC_RAW_CATS } }
  });
  console.log(`🗑️  Deleted ${deleted.count} existing DC Raw Material records.\n`);

  // 2. Read Sheet3
  const wb   = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet3'], { header: 1 });

  let currentSection = '';
  let seq     = 0;
  let created = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const [slNo, item, category, type, size] = row;

    // Section heading row: has slNo or item but NO category
    if ((slNo || item) && !category) {
      currentSection = String(item || slNo).trim();
      console.log(`📂 Entering Section: ${currentSection}`);
      continue;
    }

    if (!item || !category) continue;

    const itemName = String(item).trim();
    const cat      = String(category).trim();

    // Only import DC raw categories
    if (!DC_RAW_CATS.includes(cat)) continue;

    seq++;
    const itemCode = `DC3-${String(seq).padStart(3, '0')}`;

    // Build remarks: combine type + size
    const parts = [];
    if (type) parts.push(String(type).trim());
    if (size) parts.push(String(size).trim());
    const remarks = parts.join(' — ');

    await prisma.material.create({
      data: {
        itemName,
        itemCode,
        category:    cat,
        unit:        'Nos',
        rate:        0,
        balance:     0,
        minQuantity: 0,
        remarks:     remarks || '',
        projectSite: currentSection, // Store section title here
      }
    });
    created++;
    console.log(`  ✓ [${seq}] [${cat}] ${itemName} (Section: ${currentSection})`);
  }

  console.log(`\n✅ Done — ${created} DC Raw Material records seeded in order.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
