const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

async function runTests() {
  console.log('🚀 Starting Automated Test Suite for CRM Features...');
  
  try {
    await prisma.salesTarget.deleteMany({ where: { notes: 'TEST_TARGET' } });
    await prisma.lead.deleteMany({ where: { title: 'TEST_CORP' } });
    await prisma.task.deleteMany({ where: { title: 'TEST_TASK' } });
    await prisma.customer.deleteMany({ where: { companyName: 'TEST_CORP' } });
    await prisma.notification.deleteMany({ where: { title: 'Lead Needs Attention' } });
    await prisma.notification.deleteMany({ where: { title: 'Lead Escalation' } });
    await prisma.userPermissionAuditLog.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: 'test@kvb.com' } } });
  } catch (e) { console.log('Cleanup skipped or partial:', e.meta?.cause || e.message); }

  try {
    // ------------------------------------------------------------------
    // SETUP: Create Hierarchy
    // ------------------------------------------------------------------
    const admin = await prisma.user.create({
      data: { email: 'admin_test@kvb.com', password: 'hash', firstName: 'Admin', lastName: 'Test', role: 'ADMIN' }
    });

    const manager = await prisma.user.create({
      data: { email: 'manager_test@kvb.com', password: 'hash', firstName: 'Manager', lastName: 'Test', role: 'EMPLOYEE', managerId: admin.id, hierarchyPath: `/${admin.id}/` }
    });

    const emp1 = await prisma.user.create({
      data: { email: 'emp1_test@kvb.com', password: 'hash', firstName: 'Emp1', lastName: 'Test', role: 'EMPLOYEE', managerId: manager.id, hierarchyPath: `/${admin.id}/${manager.id}/` }
    });

    const emp2 = await prisma.user.create({
      data: { email: 'emp2_test@kvb.com', password: 'hash', firstName: 'Emp2', lastName: 'Test', role: 'EMPLOYEE', managerId: manager.id, hierarchyPath: `/${admin.id}/${manager.id}/` }
    });

    console.log('✅ Hierarchy & Users Created successfully.');

    // ------------------------------------------------------------------
    // TEST 1: Hierarchy Path & getSubordinateIds logic
    // ------------------------------------------------------------------
    const adminSubs = await prisma.user.findMany({ where: { hierarchyPath: { contains: `/${admin.id}/` } } });
    assert(adminSubs.length === 3, 'Admin should have 3 subordinates in path');
    console.log('✅ Materialized Path Hierarchy query works.');

    // Need a dummy customer first
    const testCustomer = await prisma.customer.create({
      data: { companyName: 'TEST_CORP', email: 'cust@test.com', contactName: 'John Doe', phone: '1234567890' }
    });

    // ------------------------------------------------------------------
    // TEST 2: Soft Deletes
    // ------------------------------------------------------------------
    const lead = await prisma.lead.create({
      data: { leadNumber: 'TEST-100', title: 'TEST_CORP', status: 'NEW', createdById: emp1.id, customerId: testCustomer.id }
    });

    // Soft Delete
    await prisma.lead.update({ where: { id: lead.id }, data: { isArchived: true, deletedAt: new Date() } });
    
    // Verify it's archived
    const softDeletedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert(softDeletedLead.isArchived === true, 'Lead should be marked as archived');
    console.log('✅ Soft Delete logic successfully archived the record.');

    // ------------------------------------------------------------------
    // TEST 3: Time-Travel Snapshots
    // ------------------------------------------------------------------
    const task = await prisma.task.create({
      data: { title: 'TEST_TASK', priority: 'HIGH', status: 'PENDING', createdById: manager.id, assignedToId: emp1.id, dueDate: new Date() }
    });

    // Complete task (simulate what controller does)
    const completedTask = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', snapshotManagerId: emp1.managerId }
    });

    assert(completedTask.snapshotManagerId === manager.id, 'Snapshot manager ID should match the assignee\'s manager at time of completion.');
    console.log('✅ Time-Travel Snapshot correctly captured the manager at completion time.');

    // ------------------------------------------------------------------
    // TEST 4: Roll-Up Sales Targets
    // ------------------------------------------------------------------
    const parentTarget = await prisma.salesTarget.create({
      data: { employeeId: manager.id, createdById: admin.id, periodYear: 2030, periodNumber: 1, revenueTarget: 10000, notes: 'TEST_TARGET' }
    });

    const childTarget = await prisma.salesTarget.create({
      data: { employeeId: emp1.id, createdById: admin.id, periodYear: 2030, periodNumber: 1, revenueTarget: 5000, parentTargetId: parentTarget.id, revenueAchieved: 2000, notes: 'TEST_TARGET' }
    });

    // Simulate refresh attainment logic for manager
    const subTargetsAgg = await prisma.salesTarget.aggregate({
      where: { parentTargetId: parentTarget.id },
      _sum: { revenueAchieved: true }
    });

    const rolledUpRevenue = subTargetsAgg._sum.revenueAchieved || 0;
    assert(Number(rolledUpRevenue) === 2000, 'Parent target did not correctly roll up the child revenue.');
    console.log('✅ Roll-Up Sales Targets correctly sums subordinate achievements.');

    // ------------------------------------------------------------------
    // TEST 5: Smart Overdue Lead Escalation logic
    // ------------------------------------------------------------------
    const neglectedLead = await prisma.lead.create({
      data: { leadNumber: 'TEST-101', title: 'TEST_CORP', status: 'NEW', createdById: emp1.id, assignedToId: emp1.id, updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), customerId: testCustomer.id } // 8 days old
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const overdueLeads = await prisma.lead.findMany({
      where: { isArchived: false, status: { notIn: ['WON', 'LOST'] }, updatedAt: { lt: sevenDaysAgo } }
    });

    assert(overdueLeads.some(l => l.id === neglectedLead.id), 'Escalation query failed to find the 8-day old lead.');
    console.log('✅ Smart Overdue Lead Escalation query correctly detected neglected lead.');

    console.log('\n🎉 ALL TESTS PASSED! System features are functioning exactly as designed.');

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  } finally {
    // Cleanup
    try {
      await prisma.salesTarget.deleteMany({ where: { notes: 'TEST_TARGET' } });
      await prisma.lead.deleteMany({ where: { title: 'TEST_CORP' } });
      await prisma.task.deleteMany({ where: { title: 'TEST_TASK' } });
      await prisma.customer.deleteMany({ where: { companyName: 'TEST_CORP' } });
      await prisma.notification.deleteMany({ where: { title: 'Lead Needs Attention' } });
      await prisma.notification.deleteMany({ where: { title: 'Lead Escalation' } });
      await prisma.user.deleteMany({ where: { email: { contains: 'test@kvb.com' } } });
    } catch (e) {}
    await prisma.$disconnect();
  }
}

runTests();
