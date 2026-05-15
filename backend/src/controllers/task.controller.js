const prisma = require('../utils/db');
const { getSubordinateIds } = require('../middleware/permission.middleware');

const generateTaskId = () => `task_${Date.now()}`;

// GET /api/tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedToId, type, search, page = 1, limit = 100 } = req.query;
    const userId = req.user.id;

    let where = { isArchived: false };

    if (req.user.role === 'EMPLOYEE') {
      // Employees see TEAM tasks assigned to them or their cascading subordinates
      const validUserIds = await getSubordinateIds(userId, true);
      validUserIds.push(userId);

      where.type = 'TEAM';
      where.OR = [
        { assignedToId: { in: validUserIds } },
        { createdById: userId }
      ];
    } else if (req.user.role === 'ADMIN') {
      // Admins see all TEAM tasks (PERSONAL todos are separate in /todos)
      where.type = 'TEAM';
    }

    // Additional query filters (additive, applied on top of role filter)
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    if (type)     where.type     = type;
    if (assignedToId) {
      // Employees may only query tasks for users within their subordinate scope
      if (req.user.role === 'EMPLOYEE') {
        const validUserIds = await getSubordinateIds(req.user.id, true);
        validUserIds.push(req.user.id);
        if (!validUserIds.includes(assignedToId)) {
          return res.status(403).json({ success: false, message: 'Access denied: Cannot view tasks for this user.' });
        }
      }

      // Narrow results to a specific assignee (used by EmployeeTracking expand)
      if (where.OR) {
        // If OR already exists from role check, wrap everything in an AND
        where = {
          AND: [
            { OR: where.OR },
            { assignedToId, type: 'TEAM' }
          ]
        };
        delete where.OR; // cleanup top-level OR
        delete where.type;
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

    // If requested or if assignedToId is present (typical for tracking), include Material Requests
    let combinedData = tasks;
    let combinedTotal = total;

    if (req.query.includeMaterialRequests === 'true' || (assignedToId && req.path.includes('/tasks') && !req.query.type)) {
      const mreqWhere = { assignedToId: assignedToId || undefined };
      
      // Map task status filters to material request status
      if (status) {
        if (status === 'COMPLETED') mreqWhere.status = 'COMPLETE';
        else if (status === 'PENDING') mreqWhere.status = 'PENDING';
        else if (status === 'IN_PROGRESS') mreqWhere.status = 'IN_PROGRESS';
        else if (status === 'CANCELLED') mreqWhere.status = 'INCOMPLETE';
      }

      const mreqs = await prisma.materialRequest.findMany({
        where: mreqWhere,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          createdBy:  { select: { id: true, firstName: true, lastName: true } },
          items: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedMreqs = mreqs.map(m => ({
        id: m.id,
        title: `${m.title} (Material Request)`,
        description: `${m.projectName || ''} ${m.location || ''} ${m.notes || ''}`.trim(),
        status: m.status === 'COMPLETE' ? 'COMPLETED' : m.status === 'INCOMPLETE' ? 'CANCELLED' : m.status,
        priority: 'MEDIUM',
        dueDate: m.createdAt,
        assignedTo: m.assignedTo,
        createdBy: m.createdBy,
        items: m.items, // Pass items through
        isMaterialRequest: true,
        type: 'TEAM'
      }));

      combinedData = [...tasks, ...formattedMreqs];
      combinedTotal = total + formattedMreqs.length;
    }

    res.json({
      success: true,
      data: combinedData,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: combinedTotal, pages: Math.ceil(combinedTotal / parseInt(limit)) }
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
    if (!task || task.isArchived) return res.status(404).json({ success: false, message: 'Task not found' });
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

    // Force real-time UI refresh for both sides
    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TASKS' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
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

    const io = req.app.get('io');
    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

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

    // Snapshot the assignee's current managerId for time-travel analytics
    const assignee = await prisma.user.findUnique({
      where: { id: task.assignedToId },
      select: { managerId: true }
    });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionVoiceUrl: completionVoiceUrl || null,
        completionVoiceNote: completionVoiceNote || null,
        attachmentUrl: attachmentUrl || null,
        snapshotManagerId: assignee?.managerId || null
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

    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
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

    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
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

// Archive task — soft delete
exports.deleteTask = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    await prisma.task.update({
      where: { id: req.params.id },
      data: { isArchived: true, deletedAt: new Date() }
    });
    res.json({ success: true, message: 'Task archived successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tasks/stats — employee-wise performance stats (admin/manager view)
exports.getTaskStats = async (req, res) => {
  try {
    let targetIds = [];
    if (req.user.role === 'ADMIN') {
      const allEmps = await prisma.user.findMany({ where: { role: 'EMPLOYEE', status: 'ACTIVE' }, select: { id: true } });
      targetIds = allEmps.map(u => u.id);
    } else {
      targetIds = await getSubordinateIds(req.user.id, true);
    }

    if (targetIds.length === 0) return res.json({ success: true, data: [] });

    const employees = await prisma.user.findMany({
      where: { id: { in: targetIds }, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, managerId: true }
    });

    const stats = await Promise.all(employees.map(async (emp) => {
      // Fetch Task stats
      const [taskTotal, taskCompleted, taskOverdue, taskPending, taskInProgress] = await Promise.all([
        prisma.task.count({ where: { assignedToId: emp.id, type: 'TEAM', isArchived: false } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'COMPLETED', type: 'TEAM', isArchived: false } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'OVERDUE', type: 'TEAM', isArchived: false } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'PENDING', type: 'TEAM', isArchived: false } }),
        prisma.task.count({ where: { assignedToId: emp.id, status: 'IN_PROGRESS', type: 'TEAM', isArchived: false } })
      ]);

      // Fetch Material Request stats
      const [mreqTotal, mreqCompleted, mreqPending, mreqInProgress] = await Promise.all([
        prisma.materialRequest.count({ where: { assignedToId: emp.id } }),
        prisma.materialRequest.count({ where: { assignedToId: emp.id, status: 'COMPLETE' } }),
        prisma.materialRequest.count({ where: { assignedToId: emp.id, status: 'PENDING' } }),
        prisma.materialRequest.count({ where: { assignedToId: emp.id, status: 'IN_PROGRESS' } })
      ]);

      const total = taskTotal + mreqTotal;
      const completed = taskCompleted + mreqCompleted;
      const overdue = taskOverdue;
      const pending = taskPending + mreqPending;
      const inProgress = taskInProgress + mreqInProgress;

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
