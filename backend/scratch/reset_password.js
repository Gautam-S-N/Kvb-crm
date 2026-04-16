const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // List all users first
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, status: true }
  });
  
  console.log('All users in database:');
  console.table(users);

  if (users.length === 0) {
    // No users exist — create the admin
    console.log('\nNo users found. Creating admin...');
    const hashed = await bcrypt.hash('Admin@123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@kvb.com',
        password: hashed,
        firstName: 'Admin',
        lastName: 'KVB',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Admin created: ${admin.email}`);
    console.log(`🔑 Password: Admin@123`);
  } else {
    // Reset the first ADMIN or the first user found
    const adminUser = users.find(u => u.role === 'ADMIN') || users[0];
    const hashed = await bcrypt.hash('Admin@123', 10);
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: hashed, status: 'ACTIVE' }
    });
    console.log(`\n✅ Password reset for: ${adminUser.email}`);
    console.log(`🔑 New password: Admin@123`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
