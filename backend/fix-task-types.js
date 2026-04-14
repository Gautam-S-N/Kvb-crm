const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Fix tasks that are PERSONAL type but assigned to someone OTHER than the creator
  // These are tasks that should have been TEAM type (the pre-fix bug)
  // We do NOT touch tasks where assignedToId === createdById (these are genuine personal todos)
  
  // First list what we're about to change
  const toFix = await prisma.task.findMany({
    where: { type: 'PERSONAL' },
    select: { id: true, title: true, assignedToId: true, createdById: true }
  });

  const wrongOnes = toFix.filter(t => t.assignedToId !== t.createdById);
  console.log(`Found ${toFix.length} PERSONAL tasks total`);
  console.log(`Found ${wrongOnes.length} wrongly typed tasks (assigned to someone else)`);

  if (wrongOnes.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  // Update them to TEAM type
  const result = await prisma.task.updateMany({
    where: {
      id: { in: wrongOnes.map(t => t.id) }
    },
    data: { type: 'TEAM' }
  });

  console.log(`Successfully updated ${result.count} tasks from PERSONAL → TEAM`);
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e.message); return prisma.$disconnect(); });
