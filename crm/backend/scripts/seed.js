/**
 * scripts/seed.js
 * Seeds a fresh database with all required bootstrap data.
 *
 * Run AFTER `npm run db:migrate`:
 *   node scripts/seed.js
 *
 * What this seeds:
 *  1. Super-admin user              → admin@kvbgreenenergies.com / Admin@123
 *  2. System settings               → company info, app config
 *  3. Quotation counters            → one per product code (SOL, INV, BAT, ACC)
 *  4. Purchase items catalog        → common procurement items
 *  5. Products catalog              → solar products for quotations/sales
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt       = require('bcrypt');
const { randomUUID } = require('crypto');
const { sql }      = require('drizzle-orm');
const { db }       = require('../src/utils/drizzle');
const schema       = require('../src/models/schema');

// ─── helpers ──────────────────────────────────────────────────────────────────
const uuid = () => randomUUID();
const now  = () => new Date();

async function tableIsEmpty(table) {
  const rows = await db.select(sql`COUNT(*) as cnt`).from(table);
  return Number(rows[0].cnt) === 0;
}

// ─── 1. Admin user ────────────────────────────────────────────────────────────
async function seedAdmin() {
  const ADMIN_EMAIL = 'admin@kvbgreenenergies.com';
  const ADMIN_PASS  = 'Admin@123';

  const existing = await db.select().from(schema.users)
    .where(sql`email = ${ADMIN_EMAIL}`)
    .limit(1);

  if (existing.length > 0) {
    console.log('  ⏭  Admin user already exists, skipping.');
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  await db.insert(schema.users).values({
    id:           uuid(),
    email:        ADMIN_EMAIL,
    password:     hash,
    firstName:    'Admin',
    lastName:     'KVB',
    role:         'ADMIN',
    isSuperAdmin: true,
    status:       'ACTIVE',
    canAssignLeads:           true,
    canAssignTasks:           true,
    canViewSubordinates:      true,
    canCreateMaterialRequests: true,
    canCreateProjectPlans:    true,
    createdAt: now(),
    updatedAt: now(),
  });
  console.log(`  ✓ Admin user created  →  ${ADMIN_EMAIL}  /  ${ADMIN_PASS}`);
}

// ─── 2. System settings ───────────────────────────────────────────────────────
async function seedSettings() {
  if (!(await tableIsEmpty(schema.settings))) {
    console.log('  ⏭  Settings already exist, skipping.');
    return;
  }

  const entries = [
    { key: 'COMPANY_NAME',    value: 'KVB Green Energies',         description: 'Company display name',         category: 'COMPANY' },
    { key: 'COMPANY_EMAIL',   value: 'info@kvbgreenenergies.com',  description: 'Primary contact email',        category: 'COMPANY' },
    { key: 'COMPANY_PHONE',   value: '+91 00000 00000',            description: 'Primary contact phone',        category: 'COMPANY' },
    { key: 'COMPANY_ADDRESS', value: 'Tamil Nadu, India',          description: 'Registered address',           category: 'COMPANY' },
    { key: 'COMPANY_GST',     value: '',                           description: 'GST registration number',      category: 'COMPANY' },
    { key: 'CURRENCY',        value: 'INR',                        description: 'Default currency code',        category: 'GENERAL' },
    { key: 'CURRENCY_SYMBOL', value: '₹',                          description: 'Default currency symbol',      category: 'GENERAL' },
    { key: 'TAX_RATE',        value: '18',                         description: 'Default GST rate (%)',         category: 'GENERAL' },
    { key: 'QUOTATION_VALIDITY_DAYS', value: '30',                 description: 'Days a quotation stays valid', category: 'SALES'   },
    { key: 'FINANCIAL_YEAR_START_MONTH', value: '4',              description: 'Month FY starts (4 = April)', category: 'GENERAL' },
  ];

  for (const e of entries) {
    await db.insert(schema.settings).values({
      id: uuid(), key: e.key, value: e.value,
      description: e.description, category: e.category,
      createdAt: now(), updatedAt: now(),
    });
  }
  console.log(`  ✓ ${entries.length} system settings seeded.`);
}

// ─── 3. Quotation counters ────────────────────────────────────────────────────
async function seedQuotationCounters() {
  if (!(await tableIsEmpty(schema.quotationCounters))) {
    console.log('  ⏭  Quotation counters already exist, skipping.');
    return;
  }

  // Add one counter per product-code prefix your quotation logic uses.
  // Adjust these codes to match your actual generateQuotationNumber() logic.
  const codes = ['SOL', 'INV', 'BAT', 'ACC', 'GEN'];

  for (const code of codes) {
    await db.insert(schema.quotationCounters).values({
      id: uuid(), productCode: code, counter: 0, updatedAt: now(),
    });
  }
  console.log(`  ✓ ${codes.length} quotation counters seeded  (${codes.join(', ')}).`);
}

// ─── 4. Purchase items catalog ────────────────────────────────────────────────
async function seedPurchaseItems() {
  if (!(await tableIsEmpty(schema.purchaseItems))) {
    console.log('  ⏭  Purchase items already exist, skipping.');
    return;
  }

  const items = [
    { name: 'Solar Panel (400W Mono)',       hsnCode: '85414011', unit: 'Nos',  rate: '12000.00' },
    { name: 'Solar Panel (330W Poly)',        hsnCode: '85414011', unit: 'Nos',  rate: '9000.00'  },
    { name: 'Solar Inverter (3kW)',           hsnCode: '85044090', unit: 'Nos',  rate: '25000.00' },
    { name: 'Solar Inverter (5kW)',           hsnCode: '85044090', unit: 'Nos',  rate: '40000.00' },
    { name: 'Lithium Battery (100Ah)',        hsnCode: '85076000', unit: 'Nos',  rate: '30000.00' },
    { name: 'MC4 Connector (pair)',           hsnCode: '85369090', unit: 'Pair', rate: '80.00'    },
    { name: 'DC Cable (4mm²)',               hsnCode: '85446090', unit: 'Mtr',  rate: '45.00'    },
    { name: 'AC Cable (2.5mm²)',             hsnCode: '85446090', unit: 'Mtr',  rate: '38.00'    },
    { name: 'Mounting Structure (GI)',        hsnCode: '73089090', unit: 'Set',  rate: '5000.00'  },
    { name: 'Earthing Kit',                  hsnCode: '85399090', unit: 'Set',  rate: '1200.00'  },
    { name: 'Lightning Arrester',            hsnCode: '85399090', unit: 'Nos',  rate: '2500.00'  },
    { name: 'Distribution Box (DB)',         hsnCode: '85372090', unit: 'Nos',  rate: '3500.00'  },
    { name: 'Circuit Breaker (MCB 32A)',     hsnCode: '85362090', unit: 'Nos',  rate: '350.00'   },
    { name: 'Surge Protection Device (SPD)', hsnCode: '85363090', unit: 'Nos',  rate: '1800.00'  },
    { name: 'Cable Tray (50×25)',            hsnCode: '73089090', unit: 'Mtr',  rate: '120.00'   },
    { name: 'Conduit Pipe (25mm)',           hsnCode: '39173100', unit: 'Mtr',  rate: '35.00'    },
    { name: 'Junction Box',                  hsnCode: '85369090', unit: 'Nos',  rate: '250.00'   },
    { name: 'Net Meter',                     hsnCode: '90283090', unit: 'Nos',  rate: '5000.00'  },
    { name: 'Rooftop Safety Net',            hsnCode: '56072900', unit: 'Sqm',  rate: '180.00'   },
    { name: 'Screw / Fastener Set',          hsnCode: '73181590', unit: 'Set',  rate: '200.00'   },
  ];

  for (const item of items) {
    await db.insert(schema.purchaseItems).values({
      id: uuid(), name: item.name, hsnCode: item.hsnCode,
      unit: item.unit, rate: item.rate, isActive: true,
      createdAt: now(), updatedAt: now(),
    });
  }
  console.log(`  ✓ ${items.length} purchase catalog items seeded.`);
}

// ─── 5. Products catalog (for quotations / sales) ─────────────────────────────
async function seedProducts() {
  if (!(await tableIsEmpty(schema.products))) {
    console.log('  ⏭  Products already exist, skipping.');
    return;
  }

  const products = [
    {
      name: 'On-Grid Solar System 1kW',    sku: 'SOL-OG-001', hsnCode: '85078090',
      category: 'On-Grid System',          unitOfMeasure: 'Set',
      basePrice: '45000.00', taxRate: '12.00',
      description: 'Complete 1kW on-grid solar rooftop system with installation.',
    },
    {
      name: 'On-Grid Solar System 3kW',    sku: 'SOL-OG-003', hsnCode: '85078090',
      category: 'On-Grid System',          unitOfMeasure: 'Set',
      basePrice: '120000.00', taxRate: '12.00',
      description: 'Complete 3kW on-grid solar rooftop system with installation.',
    },
    {
      name: 'On-Grid Solar System 5kW',    sku: 'SOL-OG-005', hsnCode: '85078090',
      category: 'On-Grid System',          unitOfMeasure: 'Set',
      basePrice: '195000.00', taxRate: '12.00',
      description: 'Complete 5kW on-grid solar rooftop system with installation.',
    },
    {
      name: 'On-Grid Solar System 10kW',   sku: 'SOL-OG-010', hsnCode: '85078090',
      category: 'On-Grid System',          unitOfMeasure: 'Set',
      basePrice: '380000.00', taxRate: '12.00',
      description: 'Complete 10kW on-grid solar rooftop system with installation.',
    },
    {
      name: 'Off-Grid Solar System 1kW',   sku: 'SOL-OF-001', hsnCode: '85078090',
      category: 'Off-Grid System',         unitOfMeasure: 'Set',
      basePrice: '75000.00', taxRate: '12.00',
      description: 'Complete 1kW off-grid solar system with battery backup.',
    },
    {
      name: 'Off-Grid Solar System 3kW',   sku: 'SOL-OF-003', hsnCode: '85078090',
      category: 'Off-Grid System',         unitOfMeasure: 'Set',
      basePrice: '195000.00', taxRate: '12.00',
      description: 'Complete 3kW off-grid solar system with battery backup.',
    },
    {
      name: 'Hybrid Solar System 3kW',     sku: 'SOL-HY-003', hsnCode: '85078090',
      category: 'Hybrid System',           unitOfMeasure: 'Set',
      basePrice: '210000.00', taxRate: '12.00',
      description: '3kW hybrid solar system — grid-tied with battery backup.',
    },
    {
      name: 'Hybrid Solar System 5kW',     sku: 'SOL-HY-005', hsnCode: '85078090',
      category: 'Hybrid System',           unitOfMeasure: 'Set',
      basePrice: '340000.00', taxRate: '12.00',
      description: '5kW hybrid solar system — grid-tied with battery backup.',
    },
    {
      name: 'Solar Water Pump 1HP',        sku: 'SOL-WP-001', hsnCode: '84138190',
      category: 'Solar Pump',              unitOfMeasure: 'Set',
      basePrice: '35000.00', taxRate: '12.00',
      description: '1HP DC solar water pumping system.',
    },
    {
      name: 'Solar Water Pump 2HP',        sku: 'SOL-WP-002', hsnCode: '84138190',
      category: 'Solar Pump',              unitOfMeasure: 'Set',
      basePrice: '60000.00', taxRate: '12.00',
      description: '2HP DC solar water pumping system.',
    },
    {
      name: 'Solar Street Light 30W',      sku: 'SOL-SL-030', hsnCode: '94054090',
      category: 'Solar Lighting',          unitOfMeasure: 'Nos',
      basePrice: '8500.00', taxRate: '12.00',
      description: '30W all-in-one solar street light.',
    },
    {
      name: 'Solar Street Light 60W',      sku: 'SOL-SL-060', hsnCode: '94054090',
      category: 'Solar Lighting',          unitOfMeasure: 'Nos',
      basePrice: '15000.00', taxRate: '12.00',
      description: '60W all-in-one solar street light.',
    },
    {
      name: 'AMC — Annual Maintenance Contract', sku: 'AMC-001', hsnCode: '99897110',
      category: 'Service',                  unitOfMeasure: 'Year',
      basePrice: '5000.00', taxRate: '18.00',
      description: 'Annual maintenance and service contract for solar systems.',
    },
  ];

  for (const p of products) {
    await db.insert(schema.products).values({
      id: uuid(), name: p.name, sku: p.sku, hsnCode: p.hsnCode,
      category: p.category, unitOfMeasure: p.unitOfMeasure,
      basePrice: p.basePrice, taxRate: p.taxRate,
      description: p.description, isActive: true,
      createdAt: now(), updatedAt: now(),
    });
  }
  console.log(`  ✓ ${products.length} products seeded.`);
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱  KVB CRM — Fresh Database Seed\n');

  try {
    console.log('👤 [1/5] Admin user...');
    await seedAdmin();

    console.log('⚙️  [2/5] System settings...');
    await seedSettings();

    console.log('🔢 [3/5] Quotation counters...');
    await seedQuotationCounters();

    console.log('🛒 [4/5] Purchase items catalog...');
    await seedPurchaseItems();

    console.log('📦 [5/5] Products catalog...');
    await seedProducts();

    console.log('\n✅  Seed complete! You can now start the server.\n');
  } catch (err) {
    console.error('\n❌  Seed failed:', err);
  } finally {
    process.exit(0);
  }
}

main();
