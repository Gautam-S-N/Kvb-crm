const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Add columns to users table
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN managerId VARCHAR(191) NULL;`);
      console.log('Added managerId to users');
    } catch(e) { console.log('managerId already exists or error:', e.message); }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN permissions JSON NULL;`);
      console.log('Added permissions to users');
    } catch(e) { console.log('permissions already exists or error:', e.message); }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN delegatedManagerId VARCHAR(191) NULL;`);
      console.log('Added delegatedManagerId to users');
    } catch(e) { console.log('delegatedManagerId already exists or error:', e.message); }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN delegationExpiresAt DATETIME(3) NULL;`);
      console.log('Added delegationExpiresAt to users');
    } catch(e) { console.log('delegationExpiresAt already exists or error:', e.message); }

    // Add foreign keys for users
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ADD CONSTRAINT users_managerId_fkey FOREIGN KEY (managerId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;`);
      console.log('Added FK for managerId');
    } catch(e) { console.log('FK managerId already exists or error:', e.message); }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users ADD CONSTRAINT users_delegatedManagerId_fkey FOREIGN KEY (delegatedManagerId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;`);
      console.log('Added FK for delegatedManagerId');
    } catch(e) { console.log('FK delegatedManagerId already exists or error:', e.message); }

    // 2. Create user_permission_audit_logs table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE user_permission_audit_logs (
          id VARCHAR(191) NOT NULL,
          targetUserId VARCHAR(191) NOT NULL,
          changedById VARCHAR(191) NOT NULL,
          previousState JSON NULL,
          newState JSON NULL,
          timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX user_permission_audit_logs_targetUserId_idx (targetUserId),
          CONSTRAINT user_permission_audit_logs_targetUserId_fkey FOREIGN KEY (targetUserId) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT user_permission_audit_logs_changedById_fkey FOREIGN KEY (changedById) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `);
      console.log('Created user_permission_audit_logs table');
    } catch(e) { console.log('Table already exists or error:', e.message); }

    // 3. Sync quotation_counters to schema keys if needed (optional)
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
