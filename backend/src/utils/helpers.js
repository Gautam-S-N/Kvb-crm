const { sql } = require('drizzle-orm');
const { db } = require('./drizzle');
const schema = require('../models/schema');

// Generate lead number (L-XXXXX format)
exports.generateLeadNumber = async () => {
  const result = await db.select({ count: sql`count(*)` }).from(schema.leads);
  const count = Number(result[0]?.count || 0);
  return `L-${String(count + 1).padStart(5, '0')}`;
};