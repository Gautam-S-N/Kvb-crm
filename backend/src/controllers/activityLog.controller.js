const { eq, and, desc, sql, like } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

// GET /api/logs  — admin only
exports.getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = and(
      action ? like(schema.activityLogs.action, `%${action}%`) : undefined,
      userId ? eq(schema.activityLogs.performedBy, userId) : undefined
    );

    let logs = [];
    let total = 0;
    
    try {
      const [rawLogs, countResult] = await Promise.all([
        db.select({
          id: schema.activityLogs.id,
          action: schema.activityLogs.action,
          entityType: schema.activityLogs.entityType,
          entityId: schema.activityLogs.entityId,
          description: schema.activityLogs.description,
          metadata: schema.activityLogs.metadata,
          performedBy: schema.activityLogs.performedBy,
          createdAt: schema.activityLogs.createdAt,
          userFirstName: schema.users.firstName,
          userLastName: schema.users.lastName,
          userEmail: schema.users.email,
          userRole: schema.users.role,
        })
        .from(schema.activityLogs)
        .leftJoin(schema.users, eq(schema.activityLogs.performedBy, schema.users.id))
        .where(whereClause)
        .orderBy(desc(schema.activityLogs.createdAt))
        .limit(parseInt(limit))
        .offset(skip),
        
        db.select({ count: sql`count(*)` })
          .from(schema.activityLogs)
          .where(whereClause)
      ]);

      logs = rawLogs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        description: log.description,
        metadata: log.metadata,
        performedBy: log.performedBy,
        createdAt: log.createdAt,
        user: log.userFirstName ? {
          firstName: log.userFirstName,
          lastName: log.userLastName,
          email: log.userEmail,
          role: log.userRole,
        } : null
      }));
      
      total = countResult[0].count;
    } catch (_) {
      // Fallback: If activityLogs fails, use leadTimeline as proxy audit
      const [rawTimeline, countResult] = await Promise.all([
        db.select({
          id: schema.leadTimeline.id,
          leadId: schema.leadTimeline.leadId,
          action: schema.leadTimeline.action,
          description: schema.leadTimeline.description,
          performedBy: schema.leadTimeline.performedBy,
          createdAt: schema.leadTimeline.createdAt,
          userFirstName: schema.users.firstName,
          userLastName: schema.users.lastName,
          userEmail: schema.users.email,
          userRole: schema.users.role,
        })
        .from(schema.leadTimeline)
        .leftJoin(schema.users, eq(schema.leadTimeline.performedBy, schema.users.id))
        .orderBy(desc(schema.leadTimeline.createdAt))
        .limit(parseInt(limit))
        .offset(skip),
        
        db.select({ count: sql`count(*)` })
          .from(schema.leadTimeline)
      ]);

      logs = rawTimeline.map(log => ({
        id: log.id,
        leadId: log.leadId,
        action: log.action,
        description: log.description,
        performedBy: log.performedBy,
        createdAt: log.createdAt,
        user: log.userFirstName ? {
          firstName: log.userFirstName,
          lastName: log.userLastName,
          email: log.userEmail,
          role: log.userRole,
        } : null
      }));

      total = countResult[0].count;
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
