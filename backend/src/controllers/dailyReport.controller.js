const prisma = require('../utils/db');
const { sendNotification } = require('../services/notification.service');

// ── Config ────────────────────────────────────────────────────────────────────
// Maximum number of days in the past an employee can back-fill a report for.
// Prevents falsification of records for arbitrarily old dates.
const BACKFILL_LIMIT_DAYS = parseInt(process.env.DAILY_REPORT_BACKFILL_DAYS || '7');

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
    date.setHours(0, 0, 0, 0);

    // ── Back-fill guardrail: Reject reports older than BACKFILL_LIMIT_DAYS ──
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays > BACKFILL_LIMIT_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Reports can only be submitted for the past ${BACKFILL_LIMIT_DAYS} days. This report date is ${diffDays} days ago.`
      });
    }

    const isBackfill = diffDays > 0; // True if reporting for any day before today
    const submittedAt = new Date();   // Real wall-clock submission time

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

    // ── Notify admin when a back-filled report is submitted ───────────────────
    if (isBackfill) {
      const io = req.app.get('io');
      const submitter = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { firstName: true, lastName: true }
      });
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true }
      });

      const reportDateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const submittedAtStr = submittedAt.toLocaleString('en-IN');

      for (const admin of admins) {
        await sendNotification(io, {
          userId: admin.id,
          type: 'REPORT_BACKFILLED',
          title: '📋 Back-filled Daily Report',
          body: `${submitter.firstName} ${submitter.lastName} submitted a report for ${reportDateStr} at ${submittedAtStr} (${diffDays} day(s) late).`,
          entityType: 'daily_report',
          entityId: report.id
        }).catch(err =>
          console.error('[DailyReport] Admin notification failed:', err.message)
        );
      }
    }

    // Return the report with back-fill metadata so the frontend can mark it visually
    res.status(201).json({
      success: true,
      data: {
        ...report,
        isBackfill,
        submittedAt,
        backfillDays: diffDays
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/daily-reports/today
// Returns auto-stats for any date (defaults to today).
// Accepts an optional ?date=YYYY-MM-DD query param for back-fill pre-fill.
// Back-fill is capped at BACKFILL_LIMIT_DAYS to prevent arbitrary history queries.
exports.getTodayStats = async (req, res) => {
  try {
    let targetDate;

    if (req.query.date) {
      // Validate and use provided date
      targetDate = new Date(req.query.date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      targetDate.setHours(0, 0, 0, 0);

      // Enforce back-fill limit for pre-fill queries too
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
      if (diffDays > BACKFILL_LIMIT_DAYS) {
        return res.status(400).json({
          success: false,
          message: `Cannot pre-fill stats for dates more than ${BACKFILL_LIMIT_DAYS} days ago.`
        });
      }
    } else {
      targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
    }

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [leadsCreated, followUpsDone, quotationsSent, salesClosed] = await Promise.all([
      prisma.lead.count({
        where: { createdById: req.user.id, createdAt: { gte: targetDate, lt: nextDay } }
      }),
      prisma.followUp.count({
        where: { assignedToId: req.user.id, status: 'COMPLETED', completedAt: { gte: targetDate, lt: nextDay } }
      }),
      prisma.quotation.count({
        where: { createdById: req.user.id, createdAt: { gte: targetDate, lt: nextDay } }
      }),
      prisma.sale.count({
        where: { createdById: req.user.id, createdAt: { gte: targetDate, lt: nextDay } }
      })
    ]);

    res.json({
      success: true,
      data: {
        leadsCreated,
        leadsContacted: 0,
        followUpsDone,
        quotationsSent,
        salesClosed,
        // Metadata to help the frontend label back-filled pre-fills
        reportDate: targetDate.toISOString().split('T')[0],
        isBackfill: req.query.date ? true : false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
