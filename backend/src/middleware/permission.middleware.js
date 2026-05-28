const { eq, and, gt, like, inArray } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

// Fast subordinate lookup using materialized hierarchyPath.
const getSubordinateIds = async (userId, includeDelegated = true) => {
  // Fast path: single query using materialized path
  const fastSubs = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(like(schema.users.hierarchyPath, `%/${userId}/%`));

  const resultIds = new Set(fastSubs.map(u => u.id));

  // Delegated subordinates
  if (includeDelegated) {
    const delegatedToMe = await db.select({
      id: schema.users.id,
      hierarchyPath: schema.users.hierarchyPath
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.delegatedManagerId, userId),
        gt(schema.users.delegationExpiresAt, new Date())
      )
    );

    for (const del of delegatedToMe) {
      resultIds.add(del.id);
      // Also get their subordinates
      const delSubs = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(like(schema.users.hierarchyPath, `%/${del.id}/%`));
      
      delSubs.forEach(s => resultIds.add(s.id));
    }
  }

  // Fallback: legacy recursive approach
  if (resultIds.size === 0) {
    const legacyFetch = async (managerId) => {
      const directSubs = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.managerId, managerId));
        
      for (const sub of directSubs) {
        if (!resultIds.has(sub.id)) {
          resultIds.add(sub.id);
          await legacyFetch(sub.id);
        }
      }
    };
    await legacyFetch(userId);
  }

  return Array.from(resultIds);
};

// Middleware to check module access
const requireModule = (moduleName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (req.user.role === 'ADMIN') return next();

      const userRows = await db.select({ permissions: schema.users.permissions })
        .from(schema.users)
        .where(eq(schema.users.id, req.user.id))
        .limit(1);

      const user = userRows[0];
      const perms = user?.permissions 
        ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) 
        : {};
      const modules = perms.modules || {};

      if (modules[moduleName] === true) {
        return next();
      }

      return res.status(403).json({ success: false, message: `Access denied to module: ${moduleName}` });
    } catch (error) {
      console.error('[requireModule] failed:', error);
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

const NATIVE_PERM_COLUMNS = ['canAssignLeads', 'canAssignTasks', 'canViewSubordinates', 'canCreateMaterialRequests', 'canCreateProjectPlans'];

const requireElevated = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (req.user.role === 'ADMIN') return next();

      if (NATIVE_PERM_COLUMNS.includes(permissionName)) {
        // Dynamic select using index key in Drizzle
        const selectFields = {};
        selectFields[permissionName] = schema.users[permissionName];

        const userRows = await db.select(selectFields)
          .from(schema.users)
          .where(eq(schema.users.id, req.user.id))
          .limit(1);

        const user = userRows[0];
        if (user?.[permissionName] === true) return next();

        return res.status(403).json({ success: false, message: `Missing elevated permission: ${permissionName}` });
      }

      const userRows = await db.select({ permissions: schema.users.permissions })
        .from(schema.users)
        .where(eq(schema.users.id, req.user.id))
        .limit(1);

      const user = userRows[0];
      const perms = user?.permissions 
        ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) 
        : {};
      if (perms[permissionName] === true) return next();

      return res.status(403).json({ success: false, message: `Missing elevated permission: ${permissionName}` });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

module.exports = {
  getSubordinateIds,
  requireModule,
  requireElevated
};
