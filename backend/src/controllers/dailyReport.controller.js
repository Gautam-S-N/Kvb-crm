const prisma = require('../utils/db');

// GET /api/daily-reports
exports.getDailyReports = async (req, res) => {
  try {
    const { employeeId, date, from, to, page = 1, limit = 20 } = req.query;

    const where = {};
    if (req.user.role === 'EMPLOYEE') where.employeeId = req.user.id;
    else if (employeeId) where.employeeId = employeeId;

    // single-day shortcut: date=YYYY-MM-DD
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.reportDate = { gte: start, lte: end };
    } else if (from || to) {
      where.reportDate = {};
      if (from) where.reportDate.gte = new Date(from);
      if (to)   where.reportDate.lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.dailyReport.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, role: true } }
        },
        orderBy: { reportDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.dailyReport.count({ where })
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/daily-reports/:id
exports.getDailyReportById = async (req, res) => {
  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } }
    });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/daily-reports
exports.createDailyReport = async (req, res) => {
  try {
    const {
      reportDate, leadsCreated, leadsContacted, followUpsDone,
      quotationsSent, salesClosed, revenue,
      activities, challenges, nextDayPlan
    } = req.body;

    const date = new Date(reportDate);
    // Upsert — one report per employee per day
    const report = await prisma.dailyReport.upsert({
      where: { employeeId_reportDate: { employeeId: req.user.id, reportDate: date } },
      create: {
        employeeId: req.user.id,
        reportDate: date,
        leadsCreated:   leadsCreated   || 0,
        leadsContacted: leadsContacted || 0,
        followUpsDone:  followUpsDone  || 0,
        quotationsSent: quotationsSent || 0,
        salesClosed:    salesClosed    || 0,
        revenue:        revenue        || 0,
        activities, challenges, nextDayPlan
      },
      update: {
        leadsCreated:   leadsCreated   || 0,
        leadsContacted: leadsContacted || 0,
        followUpsDone:  followUpsDone  || 0,
        quotationsSent: quotationsSent || 0,
        salesClosed:    salesClosed    || 0,
        revenue:        revenue        || 0,
        activities, challenges, nextDayPlan
      }
    });

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/daily-reports/today  — prefill today's auto-stats
exports.getTodayStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [leadsCreated, followUpsDone, quotationsSent, salesClosed] = await Promise.all([
      prisma.lead.count({
        where: { createdById: req.user.id, createdAt: { gte: today, lt: tomorrow } }
      }),
      prisma.followUp.count({
        where: { assignedToId: req.user.id, status: 'COMPLETED', completedAt: { gte: today, lt: tomorrow } }
      }),
      prisma.quotation.count({
        where: { createdById: req.user.id, createdAt: { gte: today, lt: tomorrow } }
      }),
      prisma.sale.count({
        where: { createdById: req.user.id, createdAt: { gte: today, lt: tomorrow } }
      })
    ]);

    res.json({ success: true, data: { leadsCreated, leadsContacted: 0, followUpsDone, quotationsSent, salesClosed } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
