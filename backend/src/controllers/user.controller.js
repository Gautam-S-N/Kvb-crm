const prisma = require('../utils/db');
const bcrypt = require('bcrypt');

exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const where = role ? { role } : {};
    
    // Admins see everyone. Employees might need to see colleagues for task assignment.
    const users = await prisma.user.findMany({
      where,
      select: { 
        id: true, email: true, firstName: true, lastName: true, phone: true, 
        role: true, status: true, avatar: true, createdAt: true, lastLoginAt: true,
        managerId: true, permissions: true, delegatedManagerId: true, delegationExpiresAt: true
      }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubordinateUsers = async (req, res) => {
  try {
    const { getSubordinateIds } = require('../middleware/permission.middleware');
    
    // If admin, they might want to see everyone or just the hierarchy tree
    // But typically this endpoint is used by managers to populate assignment dropdowns
    let validIds = await getSubordinateIds(req.user.id, true);
    
    // Admin can assign to anyone if needed, but normally we just return subordinates
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

    const user = await prisma.user.findUnique({
      where: { id },
      select: { 
        id: true, email: true, firstName: true, lastName: true, phone: true, 
        role: true, status: true, avatar: true, createdAt: true, lastLoginAt: true,
        managerId: true, permissions: true, delegatedManagerId: true, delegationExpiresAt: true
      }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;
    
    // Check existing
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName, phone, role: role || 'EMPLOYEE' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true }
    });

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

    // Fetch existing for audit
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { permissions: true }
    });

    const data = { firstName, lastName, phone };
    
    // Only Admin can update these fields
    if (req.user.role === 'ADMIN') {
      if (role) data.role = role;
      if (status) data.status = status;
      if (managerId !== undefined) data.managerId = managerId;
      if (permissions !== undefined) data.permissions = permissions;
      if (delegatedManagerId !== undefined) data.delegatedManagerId = delegatedManagerId;
      if (delegationExpiresAt !== undefined) data.delegationExpiresAt = delegationExpiresAt;
    }
    
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, managerId: true, permissions: true, delegatedManagerId: true, delegationExpiresAt: true }
    });

    // Audit Log Creation if permissions changed
    if (req.user.role === 'ADMIN' && permissions !== undefined) {
      const prevPerms = existingUser.permissions ? JSON.stringify(existingUser.permissions) : '{}';
      const newPerms = JSON.stringify(permissions);
      
      if (prevPerms !== newPerms) {
        await prisma.userPermissionAuditLog.create({
          data: {
            targetUserId: id,
            changedById: req.user.id,
            previousState: existingUser.permissions || {},
            newState: permissions
          }
        });
      }
    }

    res.json({ success: true, data: user });
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
