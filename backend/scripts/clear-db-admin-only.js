require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

async function run() {
  console.log('Starting precise data clearance...');
  const connection = await mysql.createConnection("mysql://root:12345@localhost:3306/kvb_crm");
  
  try {
    // Disable foreign key checks for easy truncation
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('Disabled foreign key checks.');

    const tablesToEmpty = [
      'activity_logs',
      'bulk_message_campaigns',
      'bulk_message_logs',
      'customers',
      'daily_reports',
      'document_counters',
      'emails',
      'follow_up_reminders',
      'follow_ups',
      'lead_products',
      'lead_timeline',
      'leads',
      'material_catalog', // empty material list
      'material_request_items',
      'material_requests',
      'material_usage_history',
      'materials',
      'notes',
      'notifications',
      'payments',
      'products', // empty product list
      'project_collection_tasks',
      'project_inventory_reservations',
      'project_plan_items',
      'project_plans',
      'purchase_items', // empty purchase items catalog
      'purchase_order_items',
      'purchase_orders',
      'quotation_items',
      'quotation_reservations',
      'quotations',
      'sale_items',
      'sales',
      'sales_targets',
      'user_permission_audit_logs',
      'users',
      'vendors',
      'whatsapp_messages',
      'settings',
      'quotation_counters'
    ];

    for (const table of tablesToEmpty) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`✓ Table truncated: ${table}`);
    }

    // Enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Re-enabled foreign key checks.');

    // Seed Admin User
    const adminId = randomUUID();
    const hash = await bcrypt.hash('Admin@123', 10);
    await connection.query(`
      INSERT INTO \`users\` (
        \`id\`, \`email\`, \`password\`, \`firstName\`, \`lastName\`, 
        \`role\`, \`isSuperAdmin\`, \`status\`, \`canAssignLeads\`, 
        \`canAssignTasks\`, \`canViewSubordinates\`, \`canCreateMaterialRequests\`, 
        \`canCreateProjectPlans\`, \`createdAt\`, \`updatedAt\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      adminId, 'admin@kvbgreenenergies.com', hash, 'Admin', 'KVB',
      'ADMIN', 1, 'ACTIVE', 1, 1, 1, 1, 1
    ]);
    console.log('✓ Admin user seeded: admin@kvbgreenenergies.com / Admin@123');

    // Seed bootstrap system settings
    const settings = [
      { key: 'COMPANY_NAME', value: 'KVB Green Energies', description: 'Company display name', category: 'COMPANY' },
      { key: 'COMPANY_EMAIL', value: 'info@kvbgreenenergies.com', description: 'Primary contact email', category: 'COMPANY' },
      { key: 'COMPANY_PHONE', value: '+91 00000 00000', description: 'Primary contact phone', category: 'COMPANY' },
      { key: 'COMPANY_ADDRESS', value: 'Tamil Nadu, India', description: 'Registered address', category: 'COMPANY' },
      { key: 'COMPANY_GST', value: '', description: 'GST registration number', category: 'COMPANY' },
      { key: 'CURRENCY', value: 'INR', description: 'Default currency code', category: 'GENERAL' },
      { key: 'CURRENCY_SYMBOL', value: '₹', description: 'Default currency symbol', category: 'GENERAL' },
      { key: 'TAX_RATE', value: '18', description: 'Default GST rate (%)', category: 'GENERAL' },
      { key: 'QUOTATION_VALIDITY_DAYS', value: '30', description: 'Days a quotation stays valid', category: 'SALES' },
      { key: 'FINANCIAL_YEAR_START_MONTH', value: '4', description: 'Month FY starts (4 = April)', category: 'GENERAL' },
    ];

    for (const s of settings) {
      await connection.query(`
        INSERT INTO \`settings\` (\`id\`, \`key\`, \`value\`, \`description\`, \`category\`, \`createdAt\`, \`updatedAt\`)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, [randomUUID(), s.key, s.value, s.description, s.category]);
    }
    console.log(`✓ ${settings.length} system settings seeded.`);

    // Seed bootstrap quotation counters
    const codes = ['SOL', 'INV', 'BAT', 'ACC', 'GEN'];
    for (const code of codes) {
      await connection.query(`
        INSERT INTO \`quotation_counters\` (\`id\`, \`productCode\`, \`counter\`, \`updatedAt\`)
        VALUES (?, ?, 0, NOW())
      `, [randomUUID(), code]);
    }
    console.log(`✓ ${codes.length} quotation counters seeded.`);

    console.log('Database successfully cleared, preserving ONLY admin and minimum settings.');
  } catch (err) {
    console.error('Error during data clearance:', err);
  } finally {
    await connection.end();
  }
}

run();
