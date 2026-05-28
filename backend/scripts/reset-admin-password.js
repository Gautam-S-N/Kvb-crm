require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { eq, not, sql } = require('drizzle-orm');
const { db } = require('../src/utils/drizzle');
const schema = require('../src/models/schema');

async function resetPasswords() {
  console.log('Cleaning up users before MySQL dump...');
  try {
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash('Admin@123', salt);

    // 1. Ensure admin@kvbgreenenergies.com exists and get its ID
    let adminId;
    const existingAdmin = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@kvbgreenenergies.com'))
      .limit(1);

    if (existingAdmin.length > 0) {
      adminId = existingAdmin[0].id;
      // Update existing admin password and role
      await db.update(schema.users)
        .set({ 
          password: newHashedPassword,
          role: 'ADMIN',
          isSuperAdmin: true,
          status: 'ACTIVE',
          managerId: null,
          delegatedManagerId: null
        })
        .where(eq(schema.users.email, 'admin@kvbgreenenergies.com'));
      console.log(`Updated existing admin@kvbgreenenergies.com (ID: ${adminId})`);
    } else {
      const crypto = require('crypto');
      adminId = crypto.randomUUID();
      await db.insert(schema.users)
        .values({
          id: adminId,
          email: 'admin@kvbgreenenergies.com',
          password: newHashedPassword,
          firstName: 'Admin',
          lastName: 'KVB',
          role: 'ADMIN',
          isSuperAdmin: true,
          status: 'ACTIVE'
        });
      console.log(`Created new admin@kvbgreenenergies.com (ID: ${adminId})`);
    }

    // 2. Get all other user IDs
    const otherUsers = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(not(eq(schema.users.email, 'admin@kvbgreenenergies.com')));
    
    const otherUserIds = otherUsers.map(u => u.id);
    console.log('Other user IDs to delete:', otherUserIds);

    if (otherUserIds.length > 0) {
      // Disable foreign key checks temporarily
      await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 0'));
      console.log('Disabled foreign key checks.');

      // Update managerId and delegatedManagerId to NULL for all users to prevent cycles/self-references
      await db.update(schema.users)
        .set({ managerId: null, delegatedManagerId: null });

      // Delete user-specific records for other users
      const deletes = [
        { table: 'daily_reports', col: 'employeeId' },
        { table: 'sales_targets', col: 'employeeId' },
        { table: 'sales_targets', col: 'createdById' },
        { table: 'notifications', col: 'userId' },
        { table: 'user_permission_audit_logs', col: 'targetUserId' },
        { table: 'user_permission_audit_logs', col: 'changedById' }
      ];

      for (const d of deletes) {
        const query = `DELETE FROM \`${d.table}\` WHERE \`${d.col}\` IN (${otherUserIds.map(id => `'${id}'`).join(', ')})`;
        await db.execute(sql.raw(query));
        console.log(`Deleted other users' data from ${d.table}.`);
      }

      // Reassign business entity references to adminId
      const reassignments = [
        { table: 'bulk_message_campaigns', col: 'createdById' },
        { table: 'follow_ups', col: 'assignedToId' },
        { table: 'lead_timeline', col: 'performedBy' },
        { table: 'leads', col: 'assignedToId' },
        { table: 'leads', col: 'createdById' },
        { table: 'material_requests', col: 'assignedToId' },
        { table: 'material_requests', col: 'createdById' },
        { table: 'notes', col: 'createdById' },
        { table: 'purchase_orders', col: 'createdById' },
        { table: 'quotations', col: 'createdById' },
        { table: 'sales', col: 'createdById' },
        { table: 'tasks', col: 'assignedToId' },
        { table: 'tasks', col: 'createdById' }
      ];

      for (const r of reassignments) {
        const query = `UPDATE \`${r.table}\` SET \`${r.col}\` = '${adminId}' WHERE \`${r.col}\` IN (${otherUserIds.map(id => `'${id}'`).join(', ')})`;
        await db.execute(sql.raw(query));
        console.log(`Reassigned ${r.table}.${r.col} to admin.`);
      }

      // Delete the other users
      await db.delete(schema.users)
        .where(not(eq(schema.users.email, 'admin@kvbgreenenergies.com')));
      console.log('Deleted other users.');

      // Re-enable foreign key checks
      await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 1'));
      console.log('Re-enabled foreign key checks.');
    }

    console.log('✅ Cleanup complete! Only admin@kvbgreenenergies.com remains.');
  } catch (error) {
    console.error('❌ Error resetting passwords:', error);
    // Ensure foreign key checks are re-enabled in case of error
    try {
      await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 1'));
    } catch (_) {}
  } finally {
    process.exit(0);
  }
}

resetPasswords();
