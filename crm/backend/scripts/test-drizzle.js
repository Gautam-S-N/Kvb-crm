require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db, poolConnection } = require('../src/utils/drizzle');
const { settings } = require('../src/models/schema');

async function testConnection() {
  console.log('🔄 Connecting to MySQL via Drizzle...');
  try {
    const results = await db.select().from(settings);
    console.log('✅ Connection successful!');
    console.log(`📊 Found ${results.length} setting record(s) in the database.`);
    if (results.length > 0) {
      console.log('📝 First record key:', results[0].key);
    }
  } catch (error) {
    console.error('❌ Error querying database via Drizzle:', error);
  } finally {
    console.log('🔌 Closing pool connection...');
    await poolConnection.end();
    console.log('🏁 Done.');
  }
}

testConnection();
