const { eq, and, or, inArray, sql, gte, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

// Get dashboard metrics
exports.getDashboardMetrics = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Build clauses based on role
    const leadConditions = [];
    const saleConditions = [];
    
    if (userRole === 'EMPLOYEE') {
      leadConditions.push(eq(schema.leads.assignedToId, userId));
      saleConditions.push(eq(schema.sales.createdById, userId));
    } else if (userRole === 'USER') {
      leadConditions.push(eq(schema.leads.createdById, userId));
      saleConditions.push(eq(schema.sales.createdById, userId));
    }

    // Get lead counts by status
    const leadStats = await db.select({
      status: schema.leads.status,
      count: sql`count(*)`,
      sumEstimate: sql`sum(cast(${schema.leads.estimateAmount} as decimal(12,2)))`
    })
    .from(schema.leads)
    .where(leadConditions.length > 0 ? and(...leadConditions) : undefined)
    .groupBy(schema.leads.status);

    // Get total sales
    const salesAgg = await db.select({
      count: sql`count(*)`,
      sumTotal: sql`sum(cast(${schema.sales.totalAmount} as decimal(12,2)))`
    })
    .from(schema.sales)
    .where(saleConditions.length > 0 ? and(...saleConditions) : undefined);

    // Get pending tasks
    const taskConditions = [
      eq(schema.tasks.type, 'TEAM'),
      inArray(schema.tasks.status, ['PENDING', 'IN_PROGRESS'])
    ];
    if (userRole === 'EMPLOYEE') {
      taskConditions.push(eq(schema.tasks.assignedToId, userId));
    }

    const taskCountRes = await db.select({ count: sql`count(*)` })
      .from(schema.tasks)
      .where(and(...taskConditions));
    let pendingTasks = Number(taskCountRes[0]?.count || 0);

    // Also count pending and in progress material requests
    const mreqConditions = [
      inArray(schema.materialRequests.status, ['PENDING', 'IN_PROGRESS'])
    ];
    if (userRole === 'EMPLOYEE') {
      mreqConditions.push(eq(schema.materialRequests.assignedToId, userId));
    }
    const mreqCountRes = await db.select({ count: sql`count(*)` })
      .from(schema.materialRequests)
      .where(and(...mreqConditions));
    pendingTasks += Number(mreqCountRes[0]?.count || 0);

    // Format lead stats
    const stats = {
      totalLeads: 0,
      openLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      totalLeadValue: 0,
      openLeadValue: 0,
      wonLeadValue: 0,
      lostLeadValue: 0
    };

    leadStats.forEach(stat => {
      const count = Number(stat.count || 0);
      const value = parseFloat(stat.sumEstimate || 0);
      
      stats.totalLeads += count;
      stats.totalLeadValue += value;

      if (['NEW', 'INQUIRY', 'FOLLOW_UP', 'QUOTATION_SENT', 'ORDER_CONFIRMED'].includes(stat.status)) {
        stats.openLeads += count;
        stats.openLeadValue += value;
      }
      
      if (stat.status === 'WON') {
        stats.wonLeads += count;
        stats.wonLeadValue += value;
      }
      
      if (stat.status === 'LOST') {
        stats.lostLeads += count;
        stats.lostLeadValue += value;
      }
    });

    // Generate real 6-month chart data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const recentSales = await db.select({
      saleDate: schema.sales.saleDate,
      totalAmount: schema.sales.totalAmount
    })
    .from(schema.sales)
    .where(and(
      saleConditions.length > 0 ? and(...saleConditions) : undefined,
      gte(schema.sales.saleDate, sixMonthsAgo)
    ));

    const recentLeads = await db.select({
      createdAt: schema.leads.createdAt
    })
    .from(schema.leads)
    .where(and(
      leadConditions.length > 0 ? and(...leadConditions) : undefined,
      gte(schema.leads.createdAt, sixMonthsAgo)
    ));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      chartData.push({
        name: monthNames[d.getMonth()],
        month: d.getMonth(),
        year: d.getFullYear(),
        Revenue: 0,
        Leads: 0
      });
    }

    recentSales.forEach(s => {
      const dateVal = new Date(s.saleDate);
      const m = dateVal.getMonth();
      const y = dateVal.getFullYear();
      const bin = chartData.find(b => b.month === m && b.year === y);
      if (bin) bin.Revenue += parseFloat(s.totalAmount || 0);
    });

    recentLeads.forEach(l => {
      const dateVal = new Date(l.createdAt);
      const m = dateVal.getMonth();
      const y = dateVal.getFullYear();
      const bin = chartData.find(b => b.month === m && b.year === y);
      if (bin) bin.Leads += 1;
    });

    // Get inventory metrics
    const matCountRes = await db.select({ count: sql`count(*)` }).from(schema.materials);
    const totalMaterials = Number(matCountRes[0]?.count || 0);

    const allMaterials = await db.select({
      balance: schema.materials.balance,
      minQuantity: schema.materials.minQuantity,
      rate: schema.materials.rate
    }).from(schema.materials);
    
    let preciseLowStockCount = 0;
    let totalStockValue = 0;
    allMaterials.forEach(m => {
      if (Number(m.balance) <= Number(m.minQuantity)) preciseLowStockCount++;
      totalStockValue += Number(m.balance) * Number(m.rate);
    });

    res.json({
      success: true,
      data: {
        leads: stats,
        sales: {
          count: Number(salesAgg[0]?.count || 0),
          revenue: parseFloat(salesAgg[0]?.sumTotal || 0)
        },
        tasks: {
          pending: pendingTasks
        },
        inventory: {
          totalMaterials,
          lowStockCount: preciseLowStockCount,
          totalValue: totalStockValue
        },
        chartData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const actConditions = [];
    if (userRole === 'EMPLOYEE') {
      actConditions.push(
        or(
          eq(schema.leads.assignedToId, userId),
          eq(schema.leadTimeline.performedBy, userId)
        )
      );
    } else if (userRole === 'USER') {
      actConditions.push(eq(schema.leadTimeline.performedBy, userId));
    }

    const activitiesRaw = await db.select({
      id: schema.leadTimeline.id,
      leadId: schema.leadTimeline.leadId,
      action: schema.leadTimeline.action,
      description: schema.leadTimeline.description,
      performedBy: schema.leadTimeline.performedBy,
      createdAt: schema.leadTimeline.createdAt,
      userFirstName: schema.users.firstName,
      userLastName: schema.users.lastName,
      leadNumber: schema.leads.leadNumber,
      leadTitle: schema.leads.title
    })
    .from(schema.leadTimeline)
    .leftJoin(schema.users, eq(schema.leadTimeline.performedBy, schema.users.id))
    .leftJoin(schema.leads, eq(schema.leadTimeline.leadId, schema.leads.id))
    .where(actConditions.length > 0 ? and(...actConditions) : undefined)
    .orderBy(desc(schema.leadTimeline.createdAt))
    .limit(10);

    const formattedActivities = activitiesRaw.map(act => ({
      id: act.id,
      leadId: act.leadId,
      action: act.action,
      description: act.description,
      performedBy: act.performedBy,
      createdAt: act.createdAt,
      user: act.userFirstName ? { firstName: act.userFirstName, lastName: act.userLastName } : null,
      lead: act.leadNumber ? { leadNumber: act.leadNumber, title: act.leadTitle } : null
    }));

    res.json({ success: true, data: formattedActivities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};