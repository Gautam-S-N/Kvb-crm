const prisma = require('../utils/db');

// GET /api/logs  — admin only
exports.getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.performedBy = userId;

    // Try ActivityLog model; gracefully fall back if not available
    let logs = [];
    let total = 0;
    try {
      [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: { select: { firstName: true, lastName: true, email: true, role: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.activityLog.count({ where })
      ]);
    } catch (_) {
      // If ActivityLog model doesn't exist, return Lead Timeline as audit proxy
      [logs, total] = await Promise.all([
        prisma.leadTimeline.findMany({
          include: {
            user: { select: { firstName: true, lastName: true, email: true, role: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.leadTimeline.count()
      ]);
    }

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
