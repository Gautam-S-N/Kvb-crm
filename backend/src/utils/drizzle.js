const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in the environment variables!');
}

// Create connection pool
const poolConnection = mysql.createPool({
  uri: connectionString,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = drizzle(poolConnection);

module.exports = { db, poolConnection };
