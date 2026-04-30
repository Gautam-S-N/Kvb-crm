const prisma = require('../utils/db');

// Recursive function to get all deep subordinates for a given user
const getSubordinateIds = async (userId, includeDelegated = true) => {
  const resultIds = new Set();
  
  const fetchSubordinates = async (managerId) => {
    // Direct subordinates
    const directSubs = await prisma.user.findMany({
      where: { managerId },
      select: { id: true }
    });
    
    for (const sub of directSubs) {
      if (!resultIds.has(sub.id)) {
        resultIds.add(sub.id);
        await fetchSubordinates(sub.id);
      }
    }

    // Delegated subordinates
    if (includeDelegated) {
      const delegatedToMe = await prisma.user.findMany({
        where: {
          delegatedManagerId: managerId,
          delegationExpiresAt: { gt: new Date() }
        },
        select: { id: true }
      });
      
      for (const delUser of delegatedToMe) {
        if (!resultIds.has(delUser.id)) {
          // If I am delegated to manage User A, I have access to User A's subordinates
          await fetchSubordinates(delUser.id);
        }
      }
    }
  };

  await fetchSubordinates(userId);
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
const requireElevated = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (req.user.role === 'ADMIN') return next();

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { permissions: true }
      });

      const perms = user?.permissions || {};

      if (perms[permissionName] === true) {
        return next();
      }

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
