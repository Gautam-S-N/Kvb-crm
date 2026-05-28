require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
  console.log('Restoring any missing project planning tables and users columns...');
  const connection = await mysql.createConnection("mysql://root:12345@localhost:3306/kvb_crm");
  
  try {
    // 1. Create project_plans
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_plans\` (
        \`id\` varchar(36) NOT NULL,
        \`projectName\` varchar(255) NOT NULL,
        \`place\` varchar(255) NOT NULL,
        \`status\` varchar(255) NOT NULL DEFAULT 'ACTIVE',
        \`financialYear\` varchar(10) NOT NULL,
        \`isArchived\` boolean NOT NULL DEFAULT false,
        \`completedAt\` timestamp NULL DEFAULT NULL,
        \`createdById\` varchar(36) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Verified project_plans table');

    // 2. Create project_plan_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_plan_items\` (
        \`id\` varchar(36) NOT NULL,
        \`projectPlanId\` varchar(36) NOT NULL,
        \`category\` varchar(50) NOT NULL,
        \`itemName\` varchar(255) NOT NULL,
        \`size\` varchar(255) DEFAULT NULL,
        \`quantity\` decimal(15,2) NOT NULL,
        \`supplierName\` varchar(255) DEFAULT NULL,
        \`remarks\` text DEFAULT NULL,
        \`fulfillmentType\` varchar(50) NOT NULL DEFAULT 'PENDING',
        \`reservedQty\` decimal(15,2) NOT NULL DEFAULT '0.00',
        \`collectedQty\` decimal(15,2) NOT NULL DEFAULT '0.00',
        \`inventoryItemId\` varchar(36) DEFAULT NULL,
        \`purchaseOrderId\` varchar(36) DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Verified project_plan_items table');

    // 3. Create project_inventory_reservations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_inventory_reservations\` (
        \`id\` varchar(36) NOT NULL,
        \`projectPlanId\` varchar(36) NOT NULL,
        \`projectItemId\` varchar(36) NOT NULL,
        \`materialId\` varchar(36) NOT NULL,
        \`reservedQty\` decimal(15,2) NOT NULL,
        \`releasedQty\` decimal(15,2) NOT NULL DEFAULT '0.00',
        \`status\` varchar(50) NOT NULL DEFAULT 'ACTIVE',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Verified project_inventory_reservations table');

    // 4. Create project_collection_tasks
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_collection_tasks\` (
        \`id\` varchar(36) NOT NULL,
        \`projectPlanId\` varchar(36) NOT NULL,
        \`projectItemId\` varchar(36) NOT NULL,
        \`assignedToId\` varchar(36) NOT NULL,
        \`assignedById\` varchar(36) NOT NULL,
        \`qtyToCollect\` decimal(15,2) NOT NULL,
        \`qtyCollected\` decimal(15,2) NOT NULL DEFAULT '0.00',
        \`status\` varchar(50) NOT NULL DEFAULT 'PENDING',
        \`note\` text DEFAULT NULL,
        \`collectedAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Verified project_collection_tasks table');

    // 5. Create material_usage_history
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`material_usage_history\` (
        \`id\` varchar(36) NOT NULL,
        \`materialId\` varchar(36) NOT NULL,
        \`projectPlanId\` varchar(36) NOT NULL,
        \`projectName\` varchar(255) NOT NULL,
        \`action\` varchar(50) NOT NULL,
        \`qty\` decimal(15,2) NOT NULL,
        \`performedById\` varchar(36) NOT NULL,
        \`note\` text DEFAULT NULL,
        \`financialYear\` varchar(10) DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Verified material_usage_history table');

    // 6. Ensure currentSessionId column exists in users table
    const [usersColumns] = await connection.query("SHOW COLUMNS FROM users");
    const hasCurrentSessionId = usersColumns.some(c => c.Field === 'currentSessionId');
    if (!hasCurrentSessionId) {
      await connection.query("ALTER TABLE users ADD COLUMN currentSessionId varchar(255) DEFAULT NULL");
      console.log('✓ Added currentSessionId column to users table');
    } else {
      console.log('✓ currentSessionId column already exists in users table');
    }

    // 7. Ensure canCreateProjectPlans column exists in users table
    const hasCanCreateProjectPlans = usersColumns.some(c => c.Field === 'canCreateProjectPlans');
    if (!hasCanCreateProjectPlans) {
      await connection.query("ALTER TABLE users ADD COLUMN canCreateProjectPlans tinyint(1) NOT NULL DEFAULT 0");
      console.log('✓ Added canCreateProjectPlans column to users table');
    } else {
      console.log('✓ canCreateProjectPlans column already exists in users table');
    }

    // Helper function to check and add financialYear to tables
    const ensureFinancialYear = async (table) => {
      const [cols] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      const hasFY = cols.some(c => c.Field === 'financialYear');
      if (!hasFY) {
        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`financialYear\` varchar(10) DEFAULT NULL`);
        console.log(`✓ Added financialYear column to ${table} table`);
      } else {
        console.log(`✓ financialYear column already exists in ${table} table`);
      }
    };

    // 8. Ensure financialYear exists on related transaction tables
    const fyTables = ['purchase_orders', 'tasks', 'leads', 'quotations', 'sales'];
    for (const t of fyTables) {
      await ensureFinancialYear(t);
    }

    console.log('Missing tables and columns verified/created successfully!');
  } catch (err) {
    console.error('Error restoring missing tables/columns:', err);
  } finally {
    await connection.end();
  }
}

run();
