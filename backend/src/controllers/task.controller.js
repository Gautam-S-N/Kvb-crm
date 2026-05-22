const { eq, and, or, like, inArray, sql, desc, asc, aliasedTable } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { getSubordinateIds } = require('../middleware/permission.middleware');
const { randomUUID } = require('crypto');

const generateTaskId = () => `task_${Date.now()}`;

// Helper to count records using Drizzle
const countTasksQuery = async (conditions) => {
  const result = await db.select({ count: sql`count(*)` })
    .from(schema.tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(result[0]?.count || 0);
};

// GET /api/tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedToId, type, search, page = 1, limit = 100 } = req.query;
    const userId = req.user.id;

    const conditions = [eq(schema.tasks.isArchived, false)];

    if (req.user.role === 'EMPLOYEE') {
      const validUserIds = await getSubordinateIds(userId, true);
      validUserIds.push(userId);

      conditions.push(eq(schema.tasks.type, 'TEAM'));
      conditions.push(
        or(
          inArray(schema.tasks.assignedToId, validUserIds),
          eq(schema.tasks.createdById, userId)
        )
      );
    } else if (req.user.role === 'ADMIN') {
      conditions.push(eq(schema.tasks.type, 'TEAM'));
    }

    if (status)   conditions.push(eq(schema.tasks.status, status));
    if (priority) conditions.push(eq(schema.tasks.priority, priority));
    if (type)     conditions.push(eq(schema.tasks.type, type));

    if (assignedToId) {
      if (req.user.role === 'EMPLOYEE') {
        const validUserIds = await getSubordinateIds(req.user.id, true);
        validUserIds.push(req.user.id);
        if (!validUserIds.includes(assignedToId)) {
          return res.status(403).json({ success: false, message: 'Access denied: Cannot view tasks for this user.' });
        }
      }
      conditions.push(eq(schema.tasks.assignedToId, assignedToId));
      conditions.push(eq(schema.tasks.type, 'TEAM'));
    }

    if (search) {
      conditions.push(like(schema.tasks.title, `%${search}%`));
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const assignedTo = aliasedTable(schema.users, 'assignedTo');
    const createdBy = aliasedTable(schema.users, 'createdBy');

    // Run pagination & counts parallelly
    const [tasksRawRows, total] = await Promise.all([
      db.select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        description: schema.tasks.description,
        status: schema.tasks.status,
        priority: schema.tasks.priority,
        type: schema.tasks.type,
        dueDate: schema.tasks.dueDate,
        completedAt: schema.tasks.completedAt,
        completedVoiceUrl: schema.tasks.completedVoiceUrl,
        reminderAt: schema.tasks.reminderAt,
        reminderSent: schema.tasks.reminderSent,
        createdById: schema.tasks.createdById,
        assignedToId: schema.tasks.assignedToId,
        snapshotManagerId: schema.tasks.snapshotManagerId,
        isArchived: schema.tasks.isArchived,
        deletedAt: schema.tasks.deletedAt,
        createdAt: schema.tasks.createdAt,
        updatedAt: schema.tasks.updatedAt,
        assignedToId_: assignedTo.id,
        assignedToFirstName: assignedTo.firstName,
        assignedToLastName: assignedTo.lastName,
        createdById_: createdBy.id,
        createdByFirstName: createdBy.firstName,
        createdByLastName: createdBy.lastName
      })
      .from(schema.tasks)
      .leftJoin(assignedTo, eq(schema.tasks.assignedToId, assignedTo.id))
      .leftJoin(createdBy, eq(schema.tasks.createdById, createdBy.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schema.tasks.status), asc(schema.tasks.dueDate))
      .limit(parsedLimit)
      .offset(skip),
      countTasksQuery(conditions)
    ]);

    const tasksRows = tasksRawRows.map(r => ({
      id: r.id, title: r.title, description: r.description, status: r.status,
      priority: r.priority, type: r.type, dueDate: r.dueDate, completedAt: r.completedAt,
      completedVoiceUrl: r.completedVoiceUrl, reminderAt: r.reminderAt, reminderSent: r.reminderSent,
      createdById: r.createdById, assignedToId: r.assignedToId, snapshotManagerId: r.snapshotManagerId,
      isArchived: r.isArchived, deletedAt: r.deletedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
      assignedTo: r.assignedToId_ ? { id: r.assignedToId_, firstName: r.assignedToFirstName, lastName: r.assignedToLastName } : null,
      createdBy: r.createdById_ ? { id: r.createdById_, firstName: r.createdByFirstName, lastName: r.createdByLastName } : null
    }));

    // Gather checklist item counts in memory (resolving join N+1 duplicates cleanly)
    let checklistCountsMap = {};
    if (tasksRows.length > 0) {
      const taskIdsList = tasksRows.map(t => t.id);
      const countsList = await db.select({
        taskId: schema.taskChecklistItems.taskId,
        count: sql`count(${schema.taskChecklistItems.id})`
      })
      .from(schema.taskChecklistItems)
      .where(inArray(schema.taskChecklistItems.taskId, taskIdsList))
      .groupBy(schema.taskChecklistItems.taskId);

      for (const item of countsList) {
        checklistCountsMap[item.taskId] = Number(item.count);
      }
    }

    const formattedTasks = tasksRows.map(t => ({
      ...t,
      _count: {
        checklist: checklistCountsMap[t.id] || 0
      }
    }));

    let combinedData = formattedTasks;
    let combinedTotal = total;

    if (req.query.includeMaterialRequests === 'true' || (assignedToId && req.path.includes('/tasks') && !req.query.type)) {
      const mreqConditions = [];
      if (assignedToId) {
        mreqConditions.push(eq(schema.materialRequests.assignedToId, assignedToId));
      }

      if (status) {
        if (status === 'COMPLETED') mreqConditions.push(eq(schema.materialRequests.status, 'COMPLETE'));
        else if (status === 'PENDING') mreqConditions.push(eq(schema.materialRequests.status, 'PENDING'));
        else if (status === 'IN_PROGRESS') mreqConditions.push(eq(schema.materialRequests.status, 'IN_PROGRESS'));
        else if (status === 'CANCELLED') mreqConditions.push(eq(schema.materialRequests.status, 'INCOMPLETE'));
      }

      const mreqAssignedTo = aliasedTable(schema.users, 'mreqAssignedTo');
      const mreqCreatedBy = aliasedTable(schema.users, 'mreqCreatedBy');

      const mreqsRaw = await db.select({
        id: schema.materialRequests.id,
        title: schema.materialRequests.title,
        projectName: schema.materialRequests.projectName,
        location: schema.materialRequests.location,
        notes: schema.materialRequests.notes,
        status: schema.materialRequests.status,
        createdAt: schema.materialRequests.createdAt,
        mreqAssignedToId_: mreqAssignedTo.id,
        mreqAssignedToFirstName: mreqAssignedTo.firstName,
        mreqAssignedToLastName: mreqAssignedTo.lastName,
        mreqCreatedById_: mreqCreatedBy.id,
        mreqCreatedByFirstName: mreqCreatedBy.firstName,
        mreqCreatedByLastName: mreqCreatedBy.lastName
      })
      .from(schema.materialRequests)
      .leftJoin(mreqAssignedTo, eq(schema.materialRequests.assignedToId, mreqAssignedTo.id))
      .leftJoin(mreqCreatedBy, eq(schema.materialRequests.createdById, mreqCreatedBy.id))
      .where(mreqConditions.length > 0 ? and(...mreqConditions) : undefined)
      .orderBy(desc(schema.materialRequests.createdAt));

      const mreqsRows = mreqsRaw.map(r => ({
        id: r.id, title: r.title, projectName: r.projectName, location: r.location,
        notes: r.notes, status: r.status, createdAt: r.createdAt,
        assignedTo: r.mreqAssignedToId_ ? { id: r.mreqAssignedToId_, firstName: r.mreqAssignedToFirstName, lastName: r.mreqAssignedToLastName } : null,
        createdBy: r.mreqCreatedById_ ? { id: r.mreqCreatedById_, firstName: r.mreqCreatedByFirstName, lastName: r.mreqCreatedByLastName } : null
      }));

      // Fetch items for these material requests
      let itemsMap = {};
      if (mreqsRows.length > 0) {
        const mreqIds = mreqsRows.map(m => m.id);
        const mreqItems = await db.select()
          .from(schema.materialRequestItems)
          .where(inArray(schema.materialRequestItems.materialRequestId, mreqIds));
        
        for (const item of mreqItems) {
          if (!itemsMap[item.materialRequestId]) {
            itemsMap[item.materialRequestId] = [];
          }
          itemsMap[item.materialRequestId].push(item);
        }
      }

      const formattedMreqs = mreqsRows.map(m => ({
        id: m.id,
        title: `${m.title} (Material Request)`,
        description: `${m.projectName || ''} ${m.location || ''} ${m.notes || ''}`.trim(),
        status: m.status === 'COMPLETE' ? 'COMPLETED' : m.status === 'INCOMPLETE' ? 'CANCELLED' : m.status,
        priority: 'MEDIUM',
        dueDate: m.createdAt,
        assignedTo: m.assignedTo,
        createdBy: m.createdBy,
        items: itemsMap[m.id] || [],
        isMaterialRequest: true,
        type: 'TEAM'
      }));

      combinedData = [...formattedTasks, ...formattedMreqs];
      combinedTotal = total + formattedMreqs.length;
    }

    res.json({
      success: true,
      data: combinedData,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: combinedTotal,
        pages: Math.ceil(combinedTotal / parsedLimit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  try {
    const assignedTo = aliasedTable(schema.users, 'assignedTo');
    const createdBy = aliasedTable(schema.users, 'createdBy');

    const tasksRows = await db.select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      description: schema.tasks.description,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      type: schema.tasks.type,
      dueDate: schema.tasks.dueDate,
      completedAt: schema.tasks.completedAt,
      completedVoiceUrl: schema.tasks.completedVoiceUrl,
      reminderAt: schema.tasks.reminderAt,
      reminderSent: schema.tasks.reminderSent,
      createdById: schema.tasks.createdById,
      assignedToId: schema.tasks.assignedToId,
      snapshotManagerId: schema.tasks.snapshotManagerId,
      isArchived: schema.tasks.isArchived,
      deletedAt: schema.tasks.deletedAt,
      createdAt: schema.tasks.createdAt,
      updatedAt: schema.tasks.updatedAt,
      assignedToId_: assignedTo.id,
      assignedToFirstName: assignedTo.firstName,
      assignedToLastName: assignedTo.lastName,
      assignedToEmail: assignedTo.email,
      createdById_: createdBy.id,
      createdByFirstName: createdBy.firstName,
      createdByLastName: createdBy.lastName
    })
    .from(schema.tasks)
    .leftJoin(assignedTo, eq(schema.tasks.assignedToId, assignedTo.id))
    .leftJoin(createdBy, eq(schema.tasks.createdById, createdBy.id))
    .where(
      and(
        eq(schema.tasks.id, req.params.id),
        eq(schema.tasks.isArchived, false)
      )
    )
    .limit(1);

    if (tasksRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const rawTask = tasksRows[0];
    const mappedTask = {
      id: rawTask.id, title: rawTask.title, description: rawTask.description, status: rawTask.status,
      priority: rawTask.priority, type: rawTask.type, dueDate: rawTask.dueDate, completedAt: rawTask.completedAt,
      completedVoiceUrl: rawTask.completedVoiceUrl, reminderAt: rawTask.reminderAt, reminderSent: rawTask.reminderSent,
      createdById: rawTask.createdById, assignedToId: rawTask.assignedToId, snapshotManagerId: rawTask.snapshotManagerId,
      isArchived: rawTask.isArchived, deletedAt: rawTask.deletedAt, createdAt: rawTask.createdAt, updatedAt: rawTask.updatedAt,
      assignedTo: rawTask.assignedToId_ ? { id: rawTask.assignedToId_, firstName: rawTask.assignedToFirstName, lastName: rawTask.assignedToLastName, email: rawTask.assignedToEmail } : null,
      createdBy: rawTask.createdById_ ? { id: rawTask.createdById_, firstName: rawTask.createdByFirstName, lastName: rawTask.createdByLastName } : null
    };

    const checklistItems = await db.select()
      .from(schema.taskChecklistItems)
      .where(eq(schema.taskChecklistItems.taskId, req.params.id))
      .orderBy(asc(schema.taskChecklistItems.id));

    const taskObj = {
      ...mappedTask,
      checklist: checklistItems
    };

    res.json({ success: true, data: taskObj });
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

    const taskId = generateTaskId();

    const taskData = {
      id: taskId,
      title,
      description: description || null,
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
      status: 'PENDING',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const taskWithRelation = await db.transaction(async (tx) => {
      await tx.insert(schema.tasks).values(taskData);
      
      let insertedChecklist = [];
      if (checklist && checklist.length > 0) {
        insertedChecklist = checklist.map(item => ({
          id: randomUUID(),
          taskId: taskId,
          content: item,
          isCompleted: false
        }));
        await tx.insert(schema.taskChecklistItems).values(insertedChecklist);
      }

      const assignedToUserList = await db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName
      })
      .from(schema.users)
      .where(eq(schema.users.id, taskData.assignedToId))
      .limit(1);

      const createdByUserList = await db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName
      })
      .from(schema.users)
      .where(eq(schema.users.id, taskData.createdById))
      .limit(1);

      return {
        ...taskData,
        assignedTo: assignedToUserList[0] || null,
        createdBy: createdByUserList[0] || null,
        checklist: insertedChecklist
      };
    });

    // Notify assignee via Socket.IO & notification table
    const io = req.app.get('io');
    if (taskWithRelation.assignedToId !== req.user.id) {
      if (io) {
        io.emit('notification', {
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          body: `"${taskWithRelation.title}" has been assigned to you`,
          entityType: 'task',
          entityId: taskWithRelation.id,
          targetUserId: taskWithRelation.assignedToId
        });
      }

      await db.insert(schema.notifications).values({
        id: randomUUID(),
        userId: taskWithRelation.assignedToId,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        body: `"${taskWithRelation.title}" has been assigned to you`,
        entityType: 'task',
        entityId: taskWithRelation.id,
        isRead: false,
        createdAt: new Date()
      });
    }

    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.status(201).json({ success: true, data: taskWithRelation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, status, assignedToId } = req.body;

    const data = {
      updatedAt: new Date()
    };
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;

    await db.update(schema.tasks)
      .set(data)
      .where(eq(schema.tasks.id, id));

    const assignedTo = aliasedTable(schema.users, 'assignedTo');
    const createdBy = aliasedTable(schema.users, 'createdBy');

    const updatedTaskRows = await db.select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      description: schema.tasks.description,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      type: schema.tasks.type,
      dueDate: schema.tasks.dueDate,
      completedAt: schema.tasks.completedAt,
      createdById: schema.tasks.createdById,
      assignedToId: schema.tasks.assignedToId,
      createdAt: schema.tasks.createdAt,
      updatedAt: schema.tasks.updatedAt,
      assignedToId_: assignedTo.id,
      assignedToFirstName: assignedTo.firstName,
      assignedToLastName: assignedTo.lastName,
      createdById_: createdBy.id,
      createdByFirstName: createdBy.firstName,
      createdByLastName: createdBy.lastName
    })
    .from(schema.tasks)
    .leftJoin(assignedTo, eq(schema.tasks.assignedToId, assignedTo.id))
    .leftJoin(createdBy, eq(schema.tasks.createdById, createdBy.id))
    .where(eq(schema.tasks.id, id))
    .limit(1);

    const rawUpdated = updatedTaskRows[0];
    const updatedTask = rawUpdated ? {
      id: rawUpdated.id, title: rawUpdated.title, description: rawUpdated.description,
      status: rawUpdated.status, priority: rawUpdated.priority, type: rawUpdated.type,
      dueDate: rawUpdated.dueDate, completedAt: rawUpdated.completedAt,
      createdById: rawUpdated.createdById, assignedToId: rawUpdated.assignedToId,
      createdAt: rawUpdated.createdAt, updatedAt: rawUpdated.updatedAt,
      assignedTo: rawUpdated.assignedToId_ ? { id: rawUpdated.assignedToId_, firstName: rawUpdated.assignedToFirstName, lastName: rawUpdated.assignedToLastName } : null,
      createdBy: rawUpdated.createdById_ ? { id: rawUpdated.createdById_, firstName: rawUpdated.createdByFirstName, lastName: rawUpdated.createdByLastName } : null
    } : null;

    const io = req.app.get('io');
    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.json({ success: true, data: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id/complete — worker marks task done + optional voice note
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionVoiceUrl, completionVoiceNote, attachmentUrl } = req.body;

    const taskList = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    if (taskList.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskList[0];

    const assigneeList = await db.select({ managerId: schema.users.managerId })
      .from(schema.users)
      .where(eq(schema.users.id, task.assignedToId))
      .limit(1);
    
    const assignee = assigneeList[0];

    const updateData = {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedVoiceUrl: completionVoiceUrl || null,
      completionVoiceNote: completionVoiceNote || null,
      attachmentUrl: attachmentUrl || null,
      snapshotManagerId: assignee?.managerId || null,
      updatedAt: new Date()
    };

    await db.update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, id));

    const updatedTask = {
      ...task,
      ...updateData
    };

    const io = req.app.get('io');
    if (task.createdById !== req.user.id) {
      const notifBody = completionVoiceUrl
        ? `"${task.title}" marked complete. Voice note attached.`
        : `"${task.title}" has been marked as completed`;

      if (io) {
        io.emit('notification', {
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          body: notifBody,
          entityType: 'task',
          entityId: id,
          targetUserId: task.createdById
        });
      }

      await db.insert(schema.notifications).values({
        id: randomUUID(),
        userId: task.createdById,
        type: 'TASK_COMPLETED',
        title: 'Task Completed',
        body: notifBody,
        entityType: 'task',
        entityId: id,
        isRead: false,
        createdAt: new Date()
      });
    }

    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.json({ success: true, data: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id/fail — worker marks task failed/cancelled + optional reason, photo, voice
exports.failTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { failureReason, attachmentUrl, completionVoiceUrl } = req.body;

    const taskList = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    if (taskList.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskList[0];

    const updateData = {
      status: 'CANCELLED',
      failureReason: failureReason || null,
      attachmentUrl: attachmentUrl || null,
      completedVoiceUrl: completionVoiceUrl || null, // Fail task maps to completionVoiceUrl in DB schema as well
      updatedAt: new Date()
    };

    await db.update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, id));

    const updatedTask = {
      ...task,
      ...updateData
    };

    const io = req.app.get('io');
    if (task.createdById !== req.user.id) {
      const notifBody = `"${task.title}" was marked incomplete. Reason: ${failureReason?.substring(0, 50) || 'None'}`;

      if (io) {
        io.emit('notification', {
          type: 'TASK_COMPLETED',
          title: 'Task Incomplete',
          body: notifBody,
          entityType: 'task',
          entityId: id,
          targetUserId: task.createdById
        });
      }

      await db.insert(schema.notifications).values({
        id: randomUUID(),
        userId: task.createdById,
        type: 'TASK_COMPLETED',
        title: 'Task Incomplete',
        body: notifBody,
        entityType: 'task',
        entityId: id,
        isRead: false,
        createdAt: new Date()
      });
    }

    if (io) {
      io.emit('REFRESH_DATA', { module: 'TASKS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.json({ success: true, data: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/tasks/:id/checklist-item/:itemId
exports.toggleChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemRows = await db.select()
      .from(schema.taskChecklistItems)
      .where(eq(schema.taskChecklistItems.id, itemId))
      .limit(1);

    if (itemRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const item = itemRows[0];

    const data = {
      isCompleted: !item.isCompleted,
      completedAt: !item.isCompleted ? new Date() : null
    };

    await db.update(schema.taskChecklistItems)
      .set(data)
      .where(eq(schema.taskChecklistItems.id, itemId));

    res.json({ success: true, data: { ...item, ...data } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Archive task — soft delete
exports.deleteTask = async (req, res) => {
  try {
    const taskRows = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, req.params.id))
      .limit(1);

    if (taskRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await db.update(schema.tasks)
      .set({
        isArchived: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, req.params.id));

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
      const allEmps = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.role, 'EMPLOYEE'),
            eq(schema.users.status, 'ACTIVE')
          )
        );
      targetIds = allEmps.map(u => u.id);
    } else {
      targetIds = await getSubordinateIds(req.user.id, true);
    }

    if (targetIds.length === 0) return res.json({ success: true, data: [] });

    const employees = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      managerId: schema.users.managerId
    })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.id, targetIds),
        eq(schema.users.status, 'ACTIVE')
      )
    );

    const stats = await Promise.all(employees.map(async (emp) => {
      // Helper function to count tasks for this employee with extra status filters
      const countTasksForEmp = async (extraConditions = []) => {
        const cond = [
          eq(schema.tasks.assignedToId, emp.id),
          eq(schema.tasks.type, 'TEAM'),
          eq(schema.tasks.isArchived, false),
          ...extraConditions
        ];
        const resCount = await db.select({ count: sql`count(*)` })
          .from(schema.tasks)
          .where(and(...cond));
        return Number(resCount[0]?.count || 0);
      };

      // Helper function to count material requests for this employee with extra status filters
      const countMreqsForEmp = async (extraConditions = []) => {
        const cond = [
          eq(schema.materialRequests.assignedToId, emp.id),
          ...extraConditions
        ];
        const resCount = await db.select({ count: sql`count(*)` })
          .from(schema.materialRequests)
          .where(cond.length > 0 ? and(...cond) : undefined);
        return Number(resCount[0]?.count || 0);
      };

      // Fetch Task stats parallelly
      const [taskTotal, taskCompleted, taskOverdue, taskPending, taskInProgress] = await Promise.all([
        countTasksForEmp(),
        countTasksForEmp([eq(schema.tasks.status, 'COMPLETED')]),
        countTasksForEmp([eq(schema.tasks.status, 'OVERDUE')]),
        countTasksForEmp([eq(schema.tasks.status, 'PENDING')]),
        countTasksForEmp([eq(schema.tasks.status, 'IN_PROGRESS')])
      ]);

      // Fetch Material Request stats parallelly
      const [mreqTotal, mreqCompleted, mreqPending, mreqInProgress] = await Promise.all([
        countMreqsForEmp(),
        countMreqsForEmp([eq(schema.materialRequests.status, 'COMPLETE')]),
        countMreqsForEmp([eq(schema.materialRequests.status, 'PENDING')]),
        countMreqsForEmp([eq(schema.materialRequests.status, 'IN_PROGRESS')])
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
