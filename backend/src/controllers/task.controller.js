const prisma = require('../utils/db');

const generateTaskId = () => `task_${Date.now()}`;

// GET /api/tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedToId, type, search, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    let where = {};

    if (req.user.role === 'EMPLOYEE') {
      // Employees only see TEAM tasks assigned to them
      where.assignedToId = userId;
      where.type = 'TEAM';
    } else {
      // Admins see only TEAM tasks (PERSONAL todos are separate in /todos)
      where.type = 'TEAM';
    }

    // Additional query filters (additive, applied on top of role filter)
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    if (type)     where.type     = type;
    if (assignedToId) {
      // Narrow results to a specific assignee (used by EmployeeTracking expand)
      if (where.OR) {
        // Combine: must be TEAM type AND match the assignee
        where = { assignedToId, type: 'TEAM' };
      } else {
        where.assignedToId = assignedToId;
      }
    }

    if (search) {
      where.title = { contains: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          createdBy:  { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { checklist: true } }
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        skip,
        take: parseInt(limit)
      }),
      prisma.task.count({ where })
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy:  { select: { id: true, firstName: true, lastName: true } },
        checklist: { orderBy: { id: 'asc' } }
      }
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    const {
      title, description, type, priority, dueDate, startDate,
      assignedToId, checklist,
      isRecurring, recurrence, recurrenceEnd,
      reminderAt,
      assignmentVoiceUrl, assignmentVoiceNote
    } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        // Force TEAM type when assigning to someone else so task appears in task list
        type: type || (assignedToId && assignedToId !== req.user.id ? 'TEAM' : 'PERSONAL'),
        priority: priority || 'MEDIUM',
        dueDate: new Date(dueDate),
        startDate: startDate ? new Date(startDate) : null,
        createdById: req.user.id,
        assignedToId: assignedToId || req.user.id,
        isRecurring: isRecurring || false,
        recurrence: recurrence || null,
        recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        assignmentVoiceUrl: assignmentVoiceUrl || null,
        assignmentVoiceNote: assignmentVoiceNote || null,
        checklist: checklist?.length ? {
          create: checklist.map(item => ({ content: item }))
        } : undefined
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy:  { select: { id: true, firstName: true, lastName: true } },
        checklist: true
      }
    });

    // Notify assignee via Socket.IO
    const io = req.app.get('io');
    if (task.assignedToId !== req.user.id) {
      io.emit('notification', {
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        body: `"${task.title}" has been assigned to you`,
        entityType: 'task',
        entityId: task.id,
        targetUserId: task.assignedToId
      });

      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          body: `"${task.title}" has been assigned to you`,
          entityType: 'task',
          entityId: task.id
        }
      });
    }

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, status, assignedToId } = req.body;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(status && { status }),
        ...(assignedToId && { assignedToId })
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy:  { select: { id: true, firstName: true, lastName: true } }
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id/complete — worker marks task done + optional voice note
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionVoiceUrl, completionVoiceNote, attachmentUrl } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionVoiceUrl: completionVoiceUrl || null,
        completionVoiceNote: completionVoiceNote || null,
        attachmentUrl: attachmentUrl || null
      }
    });

    // Notify task creator
    const io = req.app.get('io');
    if (task.createdById !== req.user.id) {
      const notifBody = completionVoiceUrl
        ? `"${task.title}" marked complete. Voice note attached.`
        : `"${task.title}" has been marked as completed`;

      io.emit('notification', {
        type: 'TASK_COMPLETED',
        title: 'Task Completed',
        body: notifBody,
        entityType: 'task',
        entityId: id,
        targetUserId: task.createdById
      });

      await prisma.notification.create({
        data: {
          userId: task.createdById,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          body: notifBody,
          entityType: 'task',
          entityId: id
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id/fail — worker marks task failed/cancelled + optional reason, photo, voice
exports.failTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { failureReason, attachmentUrl, completionVoiceUrl } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        failureReason: failureReason || null,
        attachmentUrl: attachmentUrl || null,
        completionVoiceUrl: completionVoiceUrl || null
      }
    });

    // Notify task creator
    const io = req.app.get('io');
    if (task.createdById !== req.user.id) {
      const notifBody = `"${task.title}" was marked incomplete. Reason: ${failureReason?.substring(0, 50) || 'None'}`;

      io.emit('notification', {
        type: 'TASK_COMPLETED',
        title: 'Task Incomplete',
        body: notifBody,
        entityType: 'task',
        entityId: id,
        targetUserId: task.createdById
      });

      await prisma.notification.create({
        data: {
          userId: task.createdById,
          type: 'TASK_COMPLETED',
          title: 'Task Incomplete',
          body: notifBody,
          entityType: 'task',
          entityId: id
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id/checklist-item/:itemId
exports.toggleChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await prisma.taskChecklistItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const updated = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted: !item.isCompleted,
        completedAt: !item.isCompleted ? new Date() : null
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tasks/stats — employee-wise performance stats (admin only)
exports.getTaskStats = async (req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true }
    });

    const stats = await Promise.all(employees.map(async (emp) => {
      const [total, completed, overdue, pending, inProgress] = await Promise.all([
        prisma.task.count({ where: { assignedToId: emp.id } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'COMPLETED' } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'OVERDUE' } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'PENDING' } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'IN_PROGRESS' } })
      ]);

      const score = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

      return {
        employee: emp,
        total,
        completed,
        overdue,
        pending,
        inProgress,
        score: parseFloat(score)
      };
    }));

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
