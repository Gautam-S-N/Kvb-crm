const { getTableConfig } = require('drizzle-orm/mysql-core');
const schema = require('../src/models/schema');

for (const [key, val] of Object.entries(schema)) {
  try {
    const config = getTableConfig(val);
    console.log(`Key: ${key}, Table Name: ${config.name}`);
    config.columns.forEach(col => {
      console.log(`  Col: ${col.name} (DB: ${col.name}, Key in JS: ${col.mapTo || col.name})`);
    });
  } catch (e) {
    console.log(`Key ${key} is not a Drizzle table:`, e.message);
  }
}
