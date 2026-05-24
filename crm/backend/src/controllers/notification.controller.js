const { eq, and, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res) => {
  try {
    const notificationsList = await db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, req.user.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50); // Limit to last 50 for performance

    res.json({ success: true, data: notificationsList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark a specific notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notificationList = await db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, id))
      .limit(1);
    
    if (notificationList.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    const notification = notificationList[0];
    
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(schema.notifications.id, id));

    const updated = { 
      ...notification, 
      isRead: true, 
      readAt: new Date() 
    };

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all notifications as read for the logged-in user
exports.markAllAsRead = async (req, res) => {
  try {
    await db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, req.user.id),
          eq(schema.notifications.isRead, false)
        )
      );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
