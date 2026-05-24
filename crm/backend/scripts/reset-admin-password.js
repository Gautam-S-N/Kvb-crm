require('dotenv').config();
const bcrypt = require('bcrypt');
const { eq } = require('drizzle-orm');
const { db } = require('../src/utils/drizzle');
const schema = require('../src/models/schema');

async function resetPasswords() {
  console.log('Resetting admin passwords...');
  try {
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash('Admin@123', salt);

    // 1. Reset admin@kvb.com
    await db.update(schema.users)
      .set({ password: newHashedPassword })
      .where(eq(schema.users.email, 'admin@kvb.com'));
    console.log('Successfully updated admin@kvb.com password to Admin@123');

    // 2. Reset admin@kvbgreenenergies.com
    await db.update(schema.users)
      .set({ password: newHashedPassword })
      .where(eq(schema.users.email, 'admin@kvbgreenenergies.com'));
    console.log('Successfully updated admin@kvbgreenenergies.com password to Admin@123');

  } catch (err) {
    console.error('Error resetting passwords:', err.message);
  } finally {
    process.exit(0);
  }
}

resetPasswords();
