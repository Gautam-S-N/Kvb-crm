const { eq, ne, and, or, like, isNull, inArray, sql, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

// GET /api/users/unassigned-count — admin use: employees with no manager
exports.getUnassignedCount = async (req, res) => {
  try {
    const countResult = await db.select({ count: sql`count(*)` })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.role, 'EMPLOYEE'),
          eq(schema.users.status, 'ACTIVE'),
          isNull(schema.users.managerId)
        )
      );
    res.json({ success: true, count: countResult[0].count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    
    const conditions = [ne(schema.users.status, 'INACTIVE')];
    if (role) {
      conditions.push(eq(schema.users.role, role));
    }
    
    if (search) {
      conditions.push(
        or(
          like(schema.users.firstName, `%${search}%`),
          like(schema.users.lastName, `%${search}%`),
          like(schema.users.email, `%${search}%`)
        )
      );
    }

    const users = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      role: schema.users.role,
      status: schema.users.status,
      avatar: schema.users.avatar,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt,
      managerId: schema.users.managerId,
      permissions: schema.users.permissions,
      delegatedManagerId: schema.users.delegatedManagerId,
      delegationExpiresAt: schema.users.delegationExpiresAt,
      isSuperAdmin: schema.users.isSuperAdmin,
      canAssignLeads: schema.users.canAssignLeads,
      canAssignTasks: schema.users.canAssignTasks,
      canViewSubordinates: schema.users.canViewSubordinates,
      canCreateMaterialRequests: schema.users.canCreateMaterialRequests
    })
    .from(schema.users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.users.firstName);

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
      const allUsers = await db.select({ id: schema.users.id }).from(schema.users);
      validIds = allUsers.map(u => u.id).filter(id => id !== req.user.id);
    }

    let users = [];
    if (validIds.length > 0) {
      users = await db.select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        role: schema.users.role
      })
      .from(schema.users)
      .where(
        and(
          inArray(schema.users.id, validIds),
          eq(schema.users.status, 'ACTIVE')
        )
      );
    }

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

    const usersList = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      role: schema.users.role,
      status: schema.users.status,
      avatar: schema.users.avatar,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt,
      managerId: schema.users.managerId,
      permissions: schema.users.permissions,
      delegatedManagerId: schema.users.delegatedManagerId,
      delegationExpiresAt: schema.users.delegationExpiresAt,
      isSuperAdmin: schema.users.isSuperAdmin,
      canAssignLeads: schema.users.canAssignLeads,
      canAssignTasks: schema.users.canAssignTasks,
      canViewSubordinates: schema.users.canViewSubordinates,
      canCreateMaterialRequests: schema.users.canCreateMaterialRequests
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

    if (usersList.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: usersList[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, managerId } = req.body;

    const existingList = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingList.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let hierarchyPath = null;
    if (managerId) {
      const managerList = await db.select({ hierarchyPath: schema.users.hierarchyPath })
        .from(schema.users)
        .where(eq(schema.users.id, managerId))
        .limit(1);

      hierarchyPath = (managerList[0]?.hierarchyPath || `/${managerId}/`) + `{PLACEHOLDER}/`;
    }

    const id = randomUUID();
    const newUser = {
      id,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      role: role || 'EMPLOYEE',
      managerId: managerId || null,
      hierarchyPath,
      status: 'ACTIVE',
      isSuperAdmin: false,
      canAssignLeads: false,
      canAssignTasks: false,
      canViewSubordinates: false,
      canCreateMaterialRequests: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.users).values(newUser);

    if (managerId) {
      const managerList = await db.select({ hierarchyPath: schema.users.hierarchyPath })
        .from(schema.users)
        .where(eq(schema.users.id, managerId))
        .limit(1);

      const finalPath = (managerList[0]?.hierarchyPath || `/${managerId}/`) + `${id}/`;
      
      await db.update(schema.users)
        .set({ hierarchyPath: finalPath })
        .where(eq(schema.users.id, id));
      
      newUser.hierarchyPath = finalPath;
    }

    const userResponse = {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      status: newUser.status,
      isSuperAdmin: newUser.isSuperAdmin
    };

    res.status(201).json({ success: true, data: userResponse });
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

    const targetList = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (targetList.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = targetList[0];

    if (targetUser.isSuperAdmin) {
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

    if (req.user.role === 'ADMIN' && status === 'SUSPENDED' && targetUser.status === 'ACTIVE') {
      const subordinateCountResult = await db.select({ count: sql`count(*)` })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.managerId, id),
            eq(schema.users.status, 'ACTIVE')
          )
        );
      
      const activeSubordinateCount = subordinateCountResult[0].count;
      if (activeSubordinateCount > 0) {
        return res.status(409).json({
          success: false,
          code: 'MANAGER_HAS_SUBORDINATES',
          message: `This user manages ${activeSubordinateCount} active employee(s). Please reassign them before suspending.`,
          subordinateCount: activeSubordinateCount
        });
      }
    }

    const data = {
      firstName: firstName !== undefined ? firstName : targetUser.firstName,
      lastName: lastName !== undefined ? lastName : targetUser.lastName,
      phone: phone !== undefined ? phone : targetUser.phone,
      updatedAt: new Date()
    };

    if (req.user.role === 'ADMIN') {
      if (role) data.role = role;
      if (status) data.status = status;
      if (managerId !== undefined) data.managerId = managerId;
      if (permissions !== undefined) {
        data.permissions = permissions;
        data.canAssignLeads               = Boolean(permissions.canAssignLeads);
        data.canAssignTasks               = Boolean(permissions.canAssignTasks);
        data.canViewSubordinates          = Boolean(permissions.canViewSubordinates);
        data.canCreateMaterialRequests    = Boolean(permissions.canCreateMaterialRequests);
      }

      if (delegatedManagerId !== undefined) data.delegatedManagerId = delegatedManagerId;
      if (delegationExpiresAt !== undefined) data.delegationExpiresAt = delegationExpiresAt ? new Date(delegationExpiresAt) : null;
    }

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    if (req.user.role === 'ADMIN' && managerId !== undefined) {
      let newPath = null;
      if (managerId) {
        const mgrList = await db.select({ hierarchyPath: schema.users.hierarchyPath })
          .from(schema.users)
          .where(eq(schema.users.id, managerId))
          .limit(1);

        newPath = (mgrList[0]?.hierarchyPath || `/${managerId}/`) + `${id}/`;
      }
      data.hierarchyPath = newPath;

      // Cascade: update all subordinates whose path contained the old path segment
      const oldSubordinates = await db.select()
        .from(schema.users)
        .where(like(schema.users.hierarchyPath, `%/${id}/%`));
      
      for (const sub of oldSubordinates) {
        const pathAfterUser = sub.hierarchyPath.split(`/${id}/`)[1] || '';
        await db.update(schema.users)
          .set({ hierarchyPath: (newPath || `/${id}/`) + pathAfterUser, updatedAt: new Date() })
          .where(eq(schema.users.id, sub.id));
      }
    }

    await db.update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id));

    const updatedUser = {
      ...targetUser,
      ...data
    };

    if (req.user.role === 'ADMIN' && permissions !== undefined) {
      const prevPerms = targetUser.permissions ? JSON.stringify(targetUser.permissions) : '{}';
      const newPerms = JSON.stringify(permissions);

      if (prevPerms !== newPerms) {
        const auditLogId = randomUUID();
        await db.insert(schema.userPermissionAuditLogs).values({
          id: auditLogId,
          targetUserId: id,
          changedById: req.user.id,
          previousState: targetUser.permissions || {},
          newState: permissions,
          timestamp: new Date()
        });

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

    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk-reassigns all active subordinates of :id to a new manager (or null = unassigned) and proceed to suspend
exports.transferSubordinates = async (req, res) => {
  try {
    const { id } = req.params;
    const { newManagerId } = req.body;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await db.update(schema.users)
      .set({ managerId: newManagerId || null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.users.managerId, id),
          eq(schema.users.status, 'ACTIVE')
        )
      );

    await db.update(schema.users)
      .set({ status: 'SUSPENDED', updatedAt: new Date() })
      .where(eq(schema.users.id, id));

    const suspendedList = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      role: schema.users.role,
      status: schema.users.status,
      avatar: schema.users.avatar,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt,
      managerId: schema.users.managerId,
      permissions: schema.users.permissions,
      delegatedManagerId: schema.users.delegatedManagerId,
      delegationExpiresAt: schema.users.delegationExpiresAt,
      isSuperAdmin: schema.users.isSuperAdmin,
      canAssignLeads: schema.users.canAssignLeads,
      canAssignTasks: schema.users.canAssignTasks,
      canViewSubordinates: schema.users.canViewSubordinates,
      canCreateMaterialRequests: schema.users.canCreateMaterialRequests
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

    res.json({ success: true, message: 'Subordinates transferred and manager suspended.', data: suspendedList[0] });
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

    const rawLogs = await db.select({
      id: schema.userPermissionAuditLogs.id,
      targetUserId: schema.userPermissionAuditLogs.targetUserId,
      changedById: schema.userPermissionAuditLogs.changedById,
      previousState: schema.userPermissionAuditLogs.previousState,
      newState: schema.userPermissionAuditLogs.newState,
      timestamp: schema.userPermissionAuditLogs.timestamp,
      changerFirstName: schema.users.firstName,
      changerLastName: schema.users.lastName
    })
    .from(schema.userPermissionAuditLogs)
    .leftJoin(schema.users, eq(schema.userPermissionAuditLogs.changedById, schema.users.id))
    .where(eq(schema.userPermissionAuditLogs.targetUserId, id))
    .orderBy(desc(schema.userPermissionAuditLogs.timestamp));

    const logs = rawLogs.map(log => ({
      id: log.id,
      targetUserId: log.targetUserId,
      changedById: log.changedById,
      previousState: log.previousState,
      newState: log.newState,
      timestamp: log.timestamp,
      changedBy: log.changerFirstName ? {
        firstName: log.changerFirstName,
        lastName: log.changerLastName
      } : null
    }));

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied. Only admins can delete users.' });
    }

    const targetList = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (targetList.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = targetList[0];

    if (targetUser.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'The Super Admin account cannot be deleted.' });
    }

    const subordinateCountResult = await db.select({ count: sql`count(*)` })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.managerId, id),
          ne(schema.users.status, 'INACTIVE')
        )
      );

    if (subordinateCountResult[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User has active subordinates. Please reassign them before deleting.' 
      });
    }

    try {
      await db.delete(schema.users).where(eq(schema.users.id, id));
    } catch (dbErr) {
      const code = dbErr.code || dbErr.cause?.code;
      const errno = dbErr.errno || dbErr.cause?.errno;
      if (code === 'ER_ROW_IS_REFERENCED_2' || errno === 1451) {
        await db.update(schema.users)
          .set({ status: 'INACTIVE', managerId: null, updatedAt: new Date() })
          .where(eq(schema.users.id, id));
      } else {
        throw dbErr;
      }
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
