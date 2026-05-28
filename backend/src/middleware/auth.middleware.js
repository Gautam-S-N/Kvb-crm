const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userRows = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      role: schema.users.role,
      status: schema.users.status,
      currentSessionId: schema.users.currentSessionId
    })
    .from(schema.users)
    .where(eq(schema.users.id, decoded.id))
    .limit(1);

    const user = userRows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Account is suspended. Please contact your administrator.' });
    }

    // Single active session check (with grace period guard)
    if (user.currentSessionId && decoded.sessionId !== user.currentSessionId) {
      return res.status(401).json({
        success: false,
        sessionExpired: true,
        message: 'Your account has been logged in on another device. This session is now terminated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
    next();
  };
};

module.exports = { authMiddleware, authorize };