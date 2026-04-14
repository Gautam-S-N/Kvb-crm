const prisma = require('../utils/db');
const bcrypt = require('bcrypt');

exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const where = role ? { role } : {};
    
    // Admins see everyone. Employees might need to see colleagues for task assignment.
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, avatar: true, createdAt: true, lastLoginAt: true }
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
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, avatar: true, createdAt: true, lastLoginAt: true }
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
    const { firstName, lastName, phone, role, status, password } = req.body;

    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = { firstName, lastName, phone };
    if (req.user.role === 'ADMIN') {
      if (role) data.role = role;
      if (status) data.status = status;
    }
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
