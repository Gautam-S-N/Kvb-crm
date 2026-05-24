/**
 * scripts/reseedDryer.js
 * Wipes all existing "Dryer Component" records and re-seeds them
 * in the exact order from Sheet1 ("Material List for Dryer").
 *  - Size    → remarks field
 *  - Remarks → location field
 * Run: node scripts/reseedDryer.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const XLSX   = require('xlsx');
const { db } = require('../src/utils/drizzle');
const schema = require('../src/models/schema');
const { eq } = require('drizzle-orm');
const { randomUUID } = require('crypto');

async function run() {
  console.log('Starting Drizzle-based Dryer Component reseed...');
  
  // 1. Delete all existing Dryer Component records
  try {
    await db.delete(schema.materials)
      .where(eq(schema.materials.category, 'Dryer Component'));
    
    console.log(`🗑️  Deleted existing Dryer Component records.\n`);
  } catch (err) {
    console.error('Error deleting materials:', err.message);
  }

  // 2. Read Sheet1
  // Columns: [0]=SlNo [1]=Item [2]=Size [3]=Qty [4]=Remarks
  const wb   = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1 });

  let seq     = 0;
  let created = 0;

  for (let i = 2; i < rows.length; i++) {  // skip header rows 0 & 1
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const [slNo, item, size, qty, rowRemarks] = row;

    if (!item) continue;

    const itemName  = String(item).trim();
    const sizeStr   = size        ? String(size).trim()        : '';
    const remStr    = rowRemarks  ? String(rowRemarks).trim()  : '';

    seq++;
    const itemCode = `DC1-${String(seq).padStart(3, '0')}`;

    await db.insert(schema.materials).values({
      id:          randomUUID(),
      itemName,
      itemCode,
      category:    'Dryer Component',
      unit:        'Nos',
      rate:        '0.00',
      balance:     '0.00',
      minQuantity: '0.00',
      remarks:     sizeStr  || null,   // Size    → remarks
      location:    remStr   || null,   // Remarks → location
      createdAt:   new Date(),
      updatedAt:   new Date()
    });
    
    created++;
    console.log(`  ✓ [${seq}] ${itemName}${sizeStr ? ' | Size: ' + sizeStr : ''}${remStr ? ' | Note: ' + remStr : ''}`);
  }

  console.log(`\n✅ Done — ${created} Dryer Component records seeded in order.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
