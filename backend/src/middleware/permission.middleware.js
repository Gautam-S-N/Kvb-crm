const prisma = require('../utils/db');

// Fast subordinate lookup using materialized hierarchyPath.
// Falls back to recursive fetching if hierarchyPath is not yet populated.
const getSubordinateIds = async (userId, includeDelegated = true) => {
  // Fast path: single query using materialized path
  const fastSubs = await prisma.user.findMany({
    where: { hierarchyPath: { contains: `/${userId}/` } },
    select: { id: true }
  });

  const resultIds = new Set(fastSubs.map(u => u.id));

  // Delegated subordinates (always checked the same way)
  if (includeDelegated) {
    const delegatedToMe = await prisma.user.findMany({
      where: {
        delegatedManagerId: userId,
        delegationExpiresAt: { gt: new Date() }
      },
      select: { id: true, hierarchyPath: true }
    });

    for (const del of delegatedToMe) {
      resultIds.add(del.id);
      // Also get their subordinates
      const delSubs = await prisma.user.findMany({
        where: { hierarchyPath: { contains: `/${del.id}/` } },
        select: { id: true }
      });
      delSubs.forEach(s => resultIds.add(s.id));
    }
  }

  // Fallback: if no results from materialized path, use legacy recursive approach
  // (handles users created before hierarchyPath was introduced)
  if (resultIds.size === 0) {
    const legacyFetch = async (managerId) => {
      const directSubs = await prisma.user.findMany({
        where: { managerId },
        select: { id: true }
      });
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

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { permissions: true }
      });

      const perms = user?.permissions || {};
      const modules = perms.modules || {};

      if (modules[moduleName] === true) {
        return next();
      }

      return res.status(403).json({ success: false, message: `Access denied to module: ${moduleName}` });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

// Middleware to check elevated permissions
// Reads the native Boolean columns (canAssignLeads, canAssignTasks, canViewSubordinates)
// for fast, indexable lookups instead of parsing the JSON blob.
const NATIVE_PERM_COLUMNS = ['canAssignLeads', 'canAssignTasks', 'canViewSubordinates'];

const requireElevated = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (req.user.role === 'ADMIN') return next();

      // If this permission has a dedicated native column, query it directly (fast path)
      if (NATIVE_PERM_COLUMNS.includes(permissionName)) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { [permissionName]: true }
        });

        if (user?.[permissionName] === true) return next();

        return res.status(403).json({ success: false, message: `Missing elevated permission: ${permissionName}` });
      }

      // Fallback: check JSON blob for any non-native permission keys
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { permissions: true }
      });

      const perms = user?.permissions || {};
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
