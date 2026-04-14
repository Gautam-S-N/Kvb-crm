const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdmin() {
  const password = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  try {
    const user = await prisma.user.create({
      data: {
        email: 'admin@kvb.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log('Admin user created:', user.email);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('User already exists, updating password...');
      const updated = await prisma.user.update({
        where: { email: 'admin@kvb.com' },
        data: { password: hashedPassword }
      });
      console.log('Password updated for:', updated.email);
    } else {
      console.error('Error:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();