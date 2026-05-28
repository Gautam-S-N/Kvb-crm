require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { sql } = require('drizzle-orm');
const { db } = require('../src/utils/drizzle');

async function run() {
  console.log('Altering material_usage_history table to add financialYear column...');
  try {
    await db.execute(sql.raw(`
      ALTER TABLE material_usage_history 
      ADD COLUMN IF NOT EXISTS financialYear VARCHAR(10) DEFAULT NULL;
    `));
    console.log('✅ Column financialYear verified/added successfully!');
  } catch (error) {
    // If "IF NOT EXISTS" is not supported by their older MySQL, we try a standard add
    try {
      await db.execute(sql.raw(`
        ALTER TABLE material_usage_history 
        ADD COLUMN financialYear VARCHAR(10) DEFAULT NULL;
      `));
      console.log('✅ Column financialYear added successfully!');
    } catch (innerError) {
      if (innerError.message.includes('Duplicate column')) {
        console.log('ℹ️ Column financialYear already exists, skipping.');
      } else {
        console.error('❌ Error altering table:', innerError);
      }
    }
  } finally {
    process.exit(0);
  }
}

run();
