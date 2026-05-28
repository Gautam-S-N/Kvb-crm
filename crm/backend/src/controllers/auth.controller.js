const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// Register (Admin only - for creating users)
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    // Check if user exists
    const existingList = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingList.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const id = randomUUID();
    const newUser = {
      id,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      role: role || 'USER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      isSuperAdmin: false,
      canAssignLeads: false,
      canAssignTasks: false,
      canViewSubordinates: false,
      canCreateMaterialRequests: false,
      canCreateProjectPlans: false
    };

    await db.insert(schema.users).values(newUser);

    const userResponse = {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      status: newUser.status,
      createdAt: newUser.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const usersList = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (usersList.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = usersList[0];

    // Check status
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact your administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login and session ID
    const currentSessionId = randomUUID();
    await db.update(schema.users)
      .set({ lastLoginAt: new Date(), currentSessionId })
      .where(eq(schema.users.id, user.id));

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, sessionId: currentSessionId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return user data (without password)
    const { password: _, ...userData } = user;
    userData.lastLoginAt = new Date(); // Reflecting immediate update
    userData.currentSessionId = currentSessionId;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user
exports.me = async (req, res) => {
  try {
    const usersList = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      role: schema.users.role,
      status: schema.users.status,
      avatar: schema.users.avatar,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      permissions: schema.users.permissions,
      managerId: schema.users.managerId,
      delegatedManagerId: schema.users.delegatedManagerId,
      isSuperAdmin: schema.users.isSuperAdmin,
      canAssignLeads: schema.users.canAssignLeads,
      canAssignTasks: schema.users.canAssignTasks,
      canViewSubordinates: schema.users.canViewSubordinates,
      canCreateMaterialRequests: schema.users.canCreateMaterialRequests,
      canCreateProjectPlans: schema.users.canCreateProjectPlans,
      currentSessionId: schema.users.currentSessionId
    })
    .from(schema.users)
    .where(eq(schema.users.id, req.user.id))
    .limit(1);

    if (usersList.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: usersList[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const usersList = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (usersList.length === 0) {
      return res.json({ success: true, message: 'If email exists, reset link sent' });
    }

    res.json({ success: true, message: 'Password reset link sent to email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};