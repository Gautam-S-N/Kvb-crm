/**
 * scripts/importDCList.js
 * Imports DC LIST 2026.xlsx into the materials table.
 * Sheet3 → raw material catalog (Sq. Tube, Flat Plate, Hardware etc.)
 * Sheet1 → dryer component checklist (stored with category = "Dryer Component")
 *
 * Run: node scripts/importDCList.js
 */
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const wb = XLSX.readFile('D:/kvb-crm/DC LIST 2026.xlsx');
  let created = 0;
  let skipped = 0;

  // ── Sheet3: Raw Material DC List ─────────────────────────────────────────
  console.log('\n📦 Importing Sheet3 — Raw Material Catalog...');
  const rows3 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet3'], { header: 1 });

  // Detect section headings (rows where only col[1] is set and col[2] is empty = section title)
  let currentSection = null;

  for (let i = 1; i < rows3.length; i++) {
    const row = rows3[i];
    if (!row || row.length === 0) continue;

    const [slNo, item, category, type, size, qty] = row;

    // Section heading: has a value at col1 but no category
    if (item && !category && !type && !qty) {
      currentSection = String(item).trim();
      continue;
    }

    if (!item || !category) continue;

    const itemName = String(item).trim();
    const cat      = String(category).trim();
    const itemType = type ? String(type).trim() : null;
    const sizeStr  = size ? String(size).trim() : null;
    const balance  = qty ? Number(qty) : 0;

    // Build a unique-ish item code from section + serial
    const itemCode = currentSection
      ? `DC3-${currentSection.replace(/\s+/g, '').substring(0,6).toUpperCase()}-${i}`
      : `DC3-${i}`;

    // Build a descriptive name: itemName + size
    const fullName = sizeStr ? `${itemName} (${sizeStr})` : itemName;

    try {
      await prisma.material.create({
        data: {
          itemName:  fullName,
          itemCode,
          category:  cat,
          unit:      'Nos',
          rate:      0,
          balance,
          minQuantity: 0,
        }
      });
      created++;
      console.log(`  ✓ [${cat}] ${fullName} — qty: ${balance}`);
    } catch (err) {
      skipped++;
      // Likely duplicate
    }
  }

  // ── Sheet1: Dryer Component Checklist ────────────────────────────────────
  console.log('\n🔧 Importing Sheet1 — Dryer Component Checklist...');
  const rows1 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1 });

  for (let i = 2; i < rows1.length; i++) {
    const row = rows1[i];
    if (!row || row.length === 0) continue;

    const [slNo, item, size, qty, remarks] = row;
    if (!item) continue;

    const itemName = String(item).trim();
    const sizeStr  = size ? String(size).trim() : null;
    const fullName = sizeStr ? `${itemName} (${sizeStr})` : itemName;
    const itemCode = `DC1-${String(i).padStart(3, '0')}`;

    try {
      await prisma.material.create({
        data: {
          itemName:  fullName,
          itemCode,
          category:  'Dryer Component',
          unit:      'Nos',
          rate:      0,
          balance:   qty ? Number(qty) : 0,
          minQuantity: 0,
        }
      });
      created++;
      console.log(`  ✓ [Dryer Component] ${fullName}`);
    } catch (err) {
      skipped++;
    }
  }

  console.log(`\n✅ Done — Created: ${created}, Skipped (duplicates): ${skipped}`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
