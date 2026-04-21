const prisma = require('../utils/db');

// Get dashboard metrics
exports.getDashboardMetrics = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Build where clause based on role
    let leadWhere = {};
    let saleWhere = {};
    
    if (userRole === 'EMPLOYEE') {
      leadWhere.assignedToId = userId;
      saleWhere.createdById = userId;
    } else if (userRole === 'USER') {
      leadWhere.createdById = userId;
      saleWhere.createdById = userId;
    }
    // Admin sees all data (no filter)

    // Get lead counts by status
    const leadStats = await prisma.lead.groupBy({
      by: ['status'],
      where: leadWhere,
      _count: { id: true },
      _sum: { estimateAmount: true }
    });

    // Get total sales
    const totalSales = await prisma.sale.aggregate({
      where: saleWhere,
      _count: { id: true },
      _sum: { totalAmount: true }
    });

    // Get pending tasks — scoped to employee's own assigned tasks
    const taskWhere = { type: 'TEAM', status: { in: ['PENDING', 'IN_PROGRESS'] } };
    if (userRole === 'EMPLOYEE') taskWhere.assignedToId = userId;
    const pendingTasks = await prisma.task.count({ where: taskWhere });

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
      const count = stat._count.id;
      const value = stat._sum.estimateAmount || 0;
      
      stats.totalLeads += count;
      stats.totalLeadValue += parseFloat(value);

      if (['NEW', 'INQUIRY', 'FOLLOW_UP', 'QUOTATION_SENT', 'ORDER_CONFIRMED'].includes(stat.status)) {
        stats.openLeads += count;
        stats.openLeadValue += parseFloat(value);
      }
      
      if (stat.status === 'WON') {
        stats.wonLeads += count;
        stats.wonLeadValue += parseFloat(value);
      }
      
      if (stat.status === 'LOST') {
        stats.lostLeads += count;
        stats.lostLeadValue += parseFloat(value);
      }
    });

    // Generate real 6-month chart data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const recentSales = await prisma.sale.findMany({
      where: { ...saleWhere, saleDate: { gte: sixMonthsAgo } },
      select: { saleDate: true, totalAmount: true }
    });

    const recentLeads = await prisma.lead.findMany({
      where: { ...leadWhere, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true }
    });

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
      const m = s.saleDate.getMonth();
      const y = s.saleDate.getFullYear();
      const bin = chartData.find(b => b.month === m && b.year === y);
      if (bin) bin.Revenue += parseFloat(s.totalAmount || 0);
    });

    recentLeads.forEach(l => {
      const m = l.createdAt.getMonth();
      const y = l.createdAt.getFullYear();
      const bin = chartData.find(b => b.month === m && b.year === y);
      if (bin) bin.Leads += 1;
    });

    // Get inventory metrics
    const [totalMaterials, stockValueResult] = await Promise.all([
      prisma.material.count(),
      prisma.material.aggregate({
        _sum: {
          balance: true,
          totalValue: true
        }
      })
    ]);

    // Precise low stock check (balance <= minQuantity)
    const allMaterials = await prisma.material.findMany({
      select: { balance: true, minQuantity: true, rate: true }
    });
    
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
          count: totalSales._count.id,
          revenue: parseFloat(totalSales._sum.totalAmount || 0)
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
    
    let where = {};
    if (userRole === 'EMPLOYEE') {
      where.OR = [
        { lead: { assignedToId: userId } },
        { performedBy: userId }
      ];
    } else if (userRole === 'USER') {
      where.performedBy = userId;
    }

    const activities = await prisma.leadTimeline.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        lead: { select: { leadNumber: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};