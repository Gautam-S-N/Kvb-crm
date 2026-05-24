const { eq, and, sql, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { sendNotification } = require('../services/notification.service');
const { randomUUID } = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
// Maximum number of days in the past an employee can back-fill a report for.
// Prevents falsification of records for arbitrarily old dates.
const BACKFILL_LIMIT_DAYS = parseInt(process.env.DAILY_REPORT_BACKFILL_DAYS || '7');

// Helper to count tables for today stats
const countMetric = async (table, userField, dateField, start, end, extra = []) => {
  const cond = [
    eq(table[userField], reqUserId), // note: we will pass reqUserId explicitly
    gte(table[dateField], start),
    sql`${table[dateField]} < ${end}`,
    ...extra
  ];
  const res = await db.select({ count: sql`count(*)` })
    .from(table)
    .where(and(...cond));
  return Number(res[0]?.count || 0);
};

// GET /api/daily-reports
exports.getDailyReports = async (req, res) => {
  try {
    const { employeeId, date, from, to, page = 1, limit = 20 } = req.query;

    const conditions = [];
    if (req.user.role === 'EMPLOYEE') {
      conditions.push(eq(schema.dailyReports.employeeId, req.user.id));
    } else if (employeeId) {
      conditions.push(eq(schema.dailyReports.employeeId, employeeId));
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      conditions.push(gte(schema.dailyReports.reportDate, start));
      conditions.push(lte(schema.dailyReports.reportDate, end));
    } else if (from || to) {
      if (from) conditions.push(gte(schema.dailyReports.reportDate, new Date(from)));
      if (to)   conditions.push(lte(schema.dailyReports.reportDate, new Date(to)));
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schema.dailyReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(totalResult[0]?.count || 0);

    const reportsRaw = await db.select({
      id: schema.dailyReports.id,
      reportDate: schema.dailyReports.reportDate,
      leadsCreated: schema.dailyReports.leadsCreated,
      leadsContacted: schema.dailyReports.leadsContacted,
      followUpsDone: schema.dailyReports.followUpsDone,
      quotationsSent: schema.dailyReports.quotationsSent,
      salesClosed: schema.dailyReports.salesClosed,
      revenue: schema.dailyReports.revenue,
      activities: schema.dailyReports.activities,
      challenges: schema.dailyReports.challenges,
      nextDayPlan: schema.dailyReports.nextDayPlan,
      employeeId: schema.dailyReports.employeeId,
      createdAt: schema.dailyReports.createdAt,
      employeeId_: schema.users.id,
      employeeFirstName: schema.users.firstName,
      employeeLastName: schema.users.lastName,
      employeeRole: schema.users.role
    })
    .from(schema.dailyReports)
    .leftJoin(schema.users, eq(schema.dailyReports.employeeId, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.dailyReports.reportDate))
    .limit(parsedLimit)
    .offset(skip);

    const reports = reportsRaw.map(r => ({
      id: r.id,
      reportDate: r.reportDate,
      leadsCreated: r.leadsCreated,
      leadsContacted: r.leadsContacted,
      followUpsDone: r.followUpsDone,
      quotationsSent: r.quotationsSent,
      salesClosed: r.salesClosed,
      revenue: r.revenue,
      activities: r.activities,
      challenges: r.challenges,
      nextDayPlan: r.nextDayPlan,
      employeeId: r.employeeId,
      createdAt: r.createdAt,
      employee: r.employeeId_ ? {
        id: r.employeeId_,
        firstName: r.employeeFirstName,
        lastName: r.employeeLastName,
        role: r.employeeRole
      } : null
    }));

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/daily-reports/:id
exports.getDailyReportById = async (req, res) => {
  try {
    const reportsRaw = await db.select({
      id: schema.dailyReports.id,
      reportDate: schema.dailyReports.reportDate,
      leadsCreated: schema.dailyReports.leadsCreated,
      leadsContacted: schema.dailyReports.leadsContacted,
      followUpsDone: schema.dailyReports.followUpsDone,
      quotationsSent: schema.dailyReports.quotationsSent,
      salesClosed: schema.dailyReports.salesClosed,
      revenue: schema.dailyReports.revenue,
      activities: schema.dailyReports.activities,
      challenges: schema.dailyReports.challenges,
      nextDayPlan: schema.dailyReports.nextDayPlan,
      employeeId: schema.dailyReports.employeeId,
      createdAt: schema.dailyReports.createdAt,
      employeeId_: schema.users.id,
      employeeFirstName: schema.users.firstName,
      employeeLastName: schema.users.lastName
    })
    .from(schema.dailyReports)
    .leftJoin(schema.users, eq(schema.dailyReports.employeeId, schema.users.id))
    .where(eq(schema.dailyReports.id, req.params.id))
    .limit(1);

    if (reportsRaw.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = {
      id: reportsRaw[0].id,
      reportDate: reportsRaw[0].reportDate,
      leadsCreated: reportsRaw[0].leadsCreated,
      leadsContacted: reportsRaw[0].leadsContacted,
      followUpsDone: reportsRaw[0].followUpsDone,
      quotationsSent: reportsRaw[0].quotationsSent,
      salesClosed: reportsRaw[0].salesClosed,
      revenue: reportsRaw[0].revenue,
      activities: reportsRaw[0].activities,
      challenges: reportsRaw[0].challenges,
      nextDayPlan: reportsRaw[0].nextDayPlan,
      employeeId: reportsRaw[0].employeeId,
      createdAt: reportsRaw[0].createdAt,
      employee: reportsRaw[0].employeeId_ ? {
        id: reportsRaw[0].employeeId_,
        firstName: reportsRaw[0].employeeFirstName,
        lastName: reportsRaw[0].employeeLastName
      } : null
    };

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

    // Upsert logic using query + insert/update
    const existingList = await db.select()
      .from(schema.dailyReports)
      .where(
        and(
          eq(schema.dailyReports.employeeId, req.user.id),
          eq(schema.dailyReports.reportDate, date)
        )
      )
      .limit(1);

    const values = {
      leadsCreated: leadsCreated || 0,
      leadsContacted: leadsContacted || 0,
      followUpsDone: followUpsDone || 0,
      quotationsSent: quotationsSent || 0,
      salesClosed: salesClosed || 0,
      revenue: revenue || '0.00',
      activities: activities || null,
      challenges: challenges || null,
      nextDayPlan: nextDayPlan || null
    };

    let report;
    if (existingList.length > 0) {
      await db.update(schema.dailyReports)
        .set(values)
        .where(eq(schema.dailyReports.id, existingList[0].id));
      report = { ...existingList[0], ...values };
    } else {
      const id = randomUUID();
      const newReport = {
        id,
        employeeId: req.user.id,
        reportDate: date,
        createdAt: new Date(),
        ...values
      };
      await db.insert(schema.dailyReports).values(newReport);
      report = newReport;
    }

    // ── Notify admin when a back-filled report is submitted ───────────────────
    if (isBackfill) {
      const io = req.app.get('io');
      const submitterList = await db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
        .from(schema.users)
        .where(eq(schema.users.id, req.user.id))
        .limit(1);
      
      const admins = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.role, 'ADMIN'),
            eq(schema.users.status, 'ACTIVE')
          )
        );

      const reportDateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const submittedAtStr = submittedAt.toLocaleString('en-IN');
      const submitter = submitterList[0];

      if (submitter) {
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

    const reqUserId = req.user.id;

    // Fast metric query function using Drizzle
    const countMetricLocal = async (table, userField, dateField, start, end, extra = []) => {
      const cond = [
        eq(table[userField], reqUserId),
        gte(table[dateField], start),
        sql`${table[dateField]} < ${end}`,
        ...extra
      ];
      const resCount = await db.select({ count: sql`count(*)` })
        .from(table)
        .where(and(...cond));
      return Number(resCount[0]?.count || 0);
    };

    const [leadsCreated, followUpsDone, quotationsSent, salesClosed] = await Promise.all([
      countMetricLocal(schema.leads, 'createdById', 'createdAt', targetDate, nextDay),
      countMetricLocal(schema.followUps, 'assignedToId', 'completedAt', targetDate, nextDay, [eq(schema.followUps.status, 'COMPLETED')]),
      countMetricLocal(schema.quotations, 'createdById', 'createdAt', targetDate, nextDay),
      countMetricLocal(schema.sales, 'createdById', 'createdAt', targetDate, nextDay)
    ]);

    res.json({
      success: true,
      data: {
        leadsCreated,
        leadsContacted: 0,
        followUpsDone,
        quotationsSent,
        salesClosed,
        reportDate: targetDate.toISOString().split('T')[0],
        isBackfill: req.query.date ? true : false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
