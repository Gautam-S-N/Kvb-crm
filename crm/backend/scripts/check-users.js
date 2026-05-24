require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db } = require('../src/utils/drizzle');
const schema = require('../src/models/schema');
const { eq } = require('drizzle-orm');

async function runTestQuery() {
  console.log('Running Drizzle select query...');
  try {
    const results = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@kvbgreenenergies.com'))
      .limit(1);
    console.log('✅ Query succeeded! Result:', results);
  } catch (error) {
    console.error('❌ Query failed! Precise error:');
    console.error(error);
  }
}

runTestQuery();
