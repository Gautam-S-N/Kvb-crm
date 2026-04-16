const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const dashboardRoutes = require('./routes/dashboard.routes');
const productRoutes = require('./routes/product.routes');
const quotationRoutes = require('./routes/quotation.routes');
const saleRoutes = require('./routes/sale.routes');
const vendorRoutes = require('./routes/vendor.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const taskRoutes = require('./routes/task.routes');
const uploadRoutes = require('./routes/upload.routes');
const dailyReportRoutes = require('./routes/dailyReport.routes');
const salesTargetRoutes = require('./routes/salesTarget.routes');
const bulkMessageRoutes = require('./routes/bulkMessage.routes');
const exportRoutes = require('./routes/export.routes');
const startCronJobs = require('./jobs/targetCron');
const startFollowUpReminderJob = require('./jobs/followupReminder');
const startTodoReminderJob = require('./jobs/todoReminder');
const todoRoutes = require('./routes/todo.routes');
const activityLogRoutes = require('./routes/activityLog.routes');



// Load env vars
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leadRoutes = require('./routes/lead.routes');
const settingRoutes = require('./routes/setting.routes');

const materialRoutes = require('./routes/material.routes');

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
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files for uploads
app.use('/uploads', express.static('uploads'));


// Register routes (Move dashboard up so it doesn't fall through)
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', uploadRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/targets', salesTargetRoutes);
app.use('/api/bulk-messages', bulkMessageRoutes);
app.use('/api/export', exportRoutes);

// Register todo routes
app.use('/api/todos', todoRoutes);

// Start background cron jobs
startCronJobs();
startFollowUpReminderJob(app);
startTodoReminderJob(app);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/settings', settingRoutes);
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
  console.log(`User connected: ${socket.userId} (Socket: ${socket.id})`);
  
  socket.join(socket.userId);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
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