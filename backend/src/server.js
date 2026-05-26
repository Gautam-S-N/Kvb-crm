require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const dashboardRoutes = require('./routes/dashboard.routes');
const productRoutes = require('./routes/product.routes');
const quotationRoutes = require('./routes/quotation.routes');
const saleRoutes = require('./routes/sale.routes');
const vendorRoutes = require('./routes/vendor.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const purchaseItemRoutes = require('./routes/purchaseItem.routes');
const taskRoutes = require('./routes/task.routes');
const uploadRoutes = require('./routes/upload.routes');
const dailyReportRoutes = require('./routes/dailyReport.routes');
const salesTargetRoutes = require('./routes/salesTarget.routes');
const bulkMessageRoutes = require('./routes/bulkMessage.routes');
const exportRoutes = require('./routes/export.routes');
const startCronJobs = require('./jobs/targetCron');
const startFollowUpReminderJob = require('./jobs/followupReminder');
const startTodoReminderJob = require('./jobs/todoReminder');
const startTaskCron = require('./jobs/taskCron');
const startCleanupJob = require('./jobs/cleanupCron');
const todoRoutes = require('./routes/todo.routes');
const activityLogRoutes = require('./routes/activityLog.routes');


// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leadRoutes = require('./routes/lead.routes');
const settingRoutes = require('./routes/setting.routes');
const notificationRoutes = require('./routes/notification.routes');

const materialRoutes = require('./routes/material.routes');
const materialRequestRoutes = require('./routes/materialRequest.routes');
const materialCatalogRoutes = require('./routes/materialCatalog.routes');



// Initialize express
const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

// Socket.IO setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(compression()); // Gzip all responses
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '2mb' })); // Cap payload size
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Rate limit auth routes to prevent brute-force attacks
// 100 attempts per 15 minutes per IP:
//   - Covers 30 office staff all logging in from same IP in the morning
//   - Still blocks automated password guessing (attackers try thousands)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' }
});

// General API limiter — 4,000 req/min per IP
// Sizing rationale (worst case):
//   - 30 office staff share 1 public IP (NAT)
//   - Peak heavy user: ~60 req/min (rapid navigation + real-time socket data)
//   - 30 users × 60 req/min = 1,800 req/min average peak
//   - 4,000 = 2× safety buffer for burst spikes
//   - 20 remote users each get their own independent 4,000/min → no issue
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 4000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' }
});

// Static files for uploads — only allow non-sensitive assets
// Sensitive files (receipts, invoices, voice) require authenticated file routes
app.use('/uploads/images', express.static('uploads/images'));
// NOTE: /uploads/receipts, /uploads/invoices, /uploads/voice are NOT served statically


// Register routes (Move dashboard up so it doesn't fall through)
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/material-catalog', materialCatalogRoutes);
app.use('/api/material-requests', materialRequestRoutes);


app.use('/api/quotations', quotationRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/purchase-items', purchaseItemRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', uploadRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/targets', salesTargetRoutes);
app.use('/api/bulk-messages', bulkMessageRoutes);
app.use('/api/export', exportRoutes);

// Register todo routes
app.use('/api/todos', todoRoutes);

const startTargetAutomationJob = require('./jobs/targetAutomation');
const startLeadEscalationJob = require('./jobs/leadEscalation');

// Start background cron jobs
startCronJobs(app);        // Nightly target refresh (now uses app for socket.io)
startFollowUpReminderJob(app);
startTodoReminderJob(app);
startTargetAutomationJob(app);
startLeadEscalationJob(app);
startTaskCron(app);        // Hourly: marks overdue tasks + escalation
startCleanupJob();         // Nightly: prune old notifications and temp PDF files

// API Routes (auth with rate limiter)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/leads', apiLimiter, leadRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/logs', activityLogRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  socket.join(socket.userId);
  socket.on('disconnect', () => { /* cleanup handled by socket.io */ });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for real-time connections`);
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please close the other process and restart.`);
    process.exit(1);
  } else {
    throw err;
  }
});

module.exports = { app, io };



