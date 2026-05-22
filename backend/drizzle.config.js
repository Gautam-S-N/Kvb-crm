const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './src/models/schema.js',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
