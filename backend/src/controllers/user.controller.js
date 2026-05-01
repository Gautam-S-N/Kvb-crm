const prisma = require('../utils/db');
const bcrypt = require('bcrypt');

// Fields always returned when selecting a user
const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true, phone: true,
  role: true, status: true, avatar: true, createdAt: true, lastLoginAt: true,
  managerId: true, permissions: true, delegatedManagerId: true, delegationExpiresAt: true,
  isSuperAdmin: true,
  canAssignLeads: true, canAssignTasks: true, canViewSubordinates: true
};

// GET /api/users/unassigned-count — admin use: employees with no manager
exports.getUnassignedCount = async (req, res) => {
  try {
    const count = await prisma.user.count({
      where: { role: 'EMPLOYEE', status: 'ACTIVE', managerId: null }
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const where = role ? { role } : {};

    const users = await prisma.user.findMany({ where, select: USER_SELECT });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubordinateUsers = async (req, res) => {
  try {
    const { getSubordinateIds } = require('../middleware/permission.middleware');

    let validIds = await getSubordinateIds(req.user.id, true);

    if (req.user.role === 'ADMIN') {
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      validIds = allUsers.map(u => u.id).filter(id => id !== req.user.id);
    }

    const users = await prisma.user.findMany({
      where: { id: { in: validIds }, status: 'ACTIVE' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true }
    });

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, managerId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Build hierarchyPath: parent's path + new user's id
    let hierarchyPath = null;
    if (managerId) {
      const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { hierarchyPath: true } });
      hierarchyPath = (manager?.hierarchyPath || `/${managerId}/`) + `{PLACEHOLDER}/`;
    }

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName, phone, role: role || 'EMPLOYEE', managerId: managerId || null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, isSuperAdmin: true }
    });

    // Now update with real ID in the path
    if (managerId) {
      const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { hierarchyPath: true } });
      const finalPath = (manager?.hierarchyPath || `/${managerId}/`) + `${user.id}/`;
      await prisma.user.update({ where: { id: user.id }, data: { hierarchyPath: finalPath } });
    }

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, role, status, password, managerId, permissions, delegatedManagerId, delegationExpiresAt } = req.body;

    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // ── Super Admin guard ──────────────────────────────────────────────────
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { permissions: true, isSuperAdmin: true, role: true, status: true }
    });

    if (targetUser?.isSuperAdmin) {
      if (status && status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'The Super Admin account cannot be deactivated or suspended.'
        });
      }
      if (role && role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'The Super Admin account role cannot be changed.'
        });
      }
    }

    // ── Manager Suspension Handover guard ─────────────────────────────────
    // If suspending a user who is currently ACTIVE, check for active subordinates
    if (req.user.role === 'ADMIN' && status === 'SUSPENDED' && targetUser?.status === 'ACTIVE') {
      const activeSubordinateCount = await prisma.user.count({
        where: { managerId: id, status: 'ACTIVE' }
      });
      if (activeSubordinateCount > 0) {
        return res.status(409).json({
          success: false,
          code: 'MANAGER_HAS_SUBORDINATES',
          message: `This user manages ${activeSubordinateCount} active employee(s). Please reassign them before suspending.`,
          subordinateCount: activeSubordinateCount
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const data = { firstName, lastName, phone };

    if (req.user.role === 'ADMIN') {
      if (role) data.role = role;
      if (status) data.status = status;
      if (managerId !== undefined) data.managerId = managerId;
      if (permissions !== undefined) {
        data.permissions = permissions;
        // Keep native Boolean columns in sync with the JSON blob
        data.canAssignLeads      = Boolean(permissions.canAssignLeads);
        data.canAssignTasks      = Boolean(permissions.canAssignTasks);
        data.canViewSubordinates = Boolean(permissions.canViewSubordinates);
      }
      if (delegatedManagerId !== undefined) data.delegatedManagerId = delegatedManagerId;
      if (delegationExpiresAt !== undefined) data.delegationExpiresAt = delegationExpiresAt;
    }

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    // ── Recompute hierarchyPath when managerId changes ────────────────────
    if (req.user.role === 'ADMIN' && managerId !== undefined) {
      let newPath = null;
      if (managerId) {
        const mgr = await prisma.user.findUnique({ where: { id: managerId }, select: { hierarchyPath: true } });
        newPath = (mgr?.hierarchyPath || `/${managerId}/`) + `${id}/`;
      }
      await prisma.user.update({ where: { id }, data: { hierarchyPath: newPath } });

      // Cascade: update all subordinates whose path contained the old path segment
      const oldSubordinates = await prisma.user.findMany({
        where: { hierarchyPath: { contains: `/${id}/` } },
        select: { id: true, hierarchyPath: true }
      });
      for (const sub of oldSubordinates) {
        const pathAfterUser = sub.hierarchyPath.split(`/${id}/`)[1] || '';
        await prisma.user.update({
          where: { id: sub.id },
          data: { hierarchyPath: (newPath || `/${id}/`) + pathAfterUser }
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { ...USER_SELECT }
    });

    // ── Audit log if permissions changed ──────────────────────────────────
    if (req.user.role === 'ADMIN' && permissions !== undefined) {
      const prevPerms = targetUser.permissions ? JSON.stringify(targetUser.permissions) : '{}';
      const newPerms = JSON.stringify(permissions);

      if (prevPerms !== newPerms) {
        await prisma.userPermissionAuditLog.create({
          data: {
            targetUserId: id,
            changedById: req.user.id,
            previousState: targetUser.permissions || {},
            newState: permissions
          }
        });

        // ── Real-time permission push via Socket.IO ───────────────────────
        const io = req.app.get('io');
        if (io) {
          io.to(id).emit('permission_updated', {
            type: 'PERMISSION_UPDATED',
            title: 'Permissions Updated',
            body: 'Your access permissions have been updated by an administrator. Please refresh your session.',
          });
        }
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users/:id/transfer-subordinates
// Bulk-reassigns all active subordinates of :id to a new manager (or null = unassigned)
// Then proceeds to suspend :id automatically
exports.transferSubordinates = async (req, res) => {
  try {
    const { id } = req.params;
    const { newManagerId } = req.body; // null = move to unassigned pool

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Bulk-update all active subordinates
    await prisma.user.updateMany({
      where: { managerId: id, status: 'ACTIVE' },
      data: { managerId: newManagerId || null }
    });

    // Now suspend the original manager
    const suspended = await prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
      select: USER_SELECT
    });

    res.json({ success: true, message: 'Subordinates transferred and manager suspended.', data: suspended });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getPermissionAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const logs = await prisma.userPermissionAuditLog.findMany({
      where: { targetUserId: id },
      include: {
        changedBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
