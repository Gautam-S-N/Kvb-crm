/**
 * scripts/reseedDCRaw.js
 * Wipes all existing DC Raw Material records and re-seeds them
 * in exact Sheet3 order.
 *  - Type  → location field
 *  - Size  → remarks field
 *  - Section heading → projectSite field
 * Run: node scripts/reseedDCRaw.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const XLSX  = require('xlsx');
const { db } = require('../src/utils/drizzle');
const schema = require('../src/models/schema');
const { inArray } = require('drizzle-orm');
const { randomUUID } = require('crypto');

const DC_RAW_CATS = ['Sq. Tube','Flat Plate','Rec. Tube','Hardware','Round Tube','Round Rod','L Angle','C Channel'];

async function run() {
  console.log('Starting Drizzle-based DC Raw Material reseed...');
  
  // 1. Delete all existing DC Raw records
  try {
    const deletedResult = await db.delete(schema.materialCatalog)
      .where(inArray(schema.materialCatalog.category, DC_RAW_CATS));
    
    console.log(`🗑️  Cleaned existing DC Raw Material records.\n`);
  } catch (err) {
    console.error('Error deleting materialCatalog:', err.message);
  }

  // 2. Read Sheet3
  // Columns: [0]=SlNo [1]=Item [2]=Category [3]=Type [4]=Size [5]=Qty
  const wb   = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet3'], { header: 1 });

  let currentSection = '';
  let seq     = 0;
  let created = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const [slNo, item, category, type, size, qty] = row;

    // Section heading row: has slNo/item but NO category
    if ((slNo || item) && !category) {
      currentSection = String(item || slNo).trim();
      console.log(`\n📂 Section: ${currentSection}`);
      continue;
    }

    if (!item || !category) continue;

    const itemName = String(item).trim();
    const cat      = String(category).trim();

    // Only import DC raw categories
    if (!DC_RAW_CATS.includes(cat)) continue;

    seq++;
    const itemCode = `DC3-${String(seq).padStart(3, '0')}`;

    const typeStr = type  ? String(type).trim()  : '';
    const sizeStr = size  ? String(size).trim()  : '';

    await db.insert(schema.materialCatalog).values({
      id: randomUUID(),
      itemName,
      itemCode,
      category:    cat,
      unit:        'Nos',
      rate:        '0.00',
      location:    typeStr || null,    // Type  → location
      remarks:     sizeStr || null,    // Size  → remarks
      projectSite: currentSection || null,  // Section heading
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    created++;
    console.log(`  ✓ [${seq}] [${cat}] ${itemName}${typeStr ? ' | Type: ' + typeStr : ''}${sizeStr ? ' | Size: ' + sizeStr : ''}${currentSection ? ' | Section: ' + currentSection : ''}`);
  }

  console.log(`\n✅ Done — ${created} DC Raw Material records seeded in order.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
