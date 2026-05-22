const { eq, and, or, like, asc, inArray } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// GET all todos for the logged-in admin
const getTodos = async (req, res) => {
  try {
    const { status, priority, search } = req.query;

    const conditions = [
      eq(schema.tasks.createdById, req.user.id),
      eq(schema.tasks.type, 'PERSONAL')
    ];

    if (status && status !== 'ALL') {
      conditions.push(eq(schema.tasks.status, status));
    }
    if (priority && priority !== 'ALL') {
      conditions.push(eq(schema.tasks.priority, priority));
    }
    if (search) {
      conditions.push(
        or(
          like(schema.tasks.title, `%${search}%`),
          like(schema.tasks.description, `%${search}%`)
        )
      );
    }

    const todosList = await db.select()
      .from(schema.tasks)
      .where(and(...conditions))
      .orderBy(asc(schema.tasks.status), asc(schema.tasks.dueDate));

    let checklists = [];
    if (todosList.length > 0) {
      checklists = await db.select()
        .from(schema.taskChecklistItems)
        .where(inArray(schema.taskChecklistItems.taskId, todosList.map(t => t.id)));
    }

    const checklistMap = {};
    checklists.forEach(item => {
      if (!checklistMap[item.taskId]) {
        checklistMap[item.taskId] = [];
      }
      checklistMap[item.taskId].push(item);
    });

    const todos = todosList.map(todo => ({
      ...todo,
      checklist: checklistMap[todo.id] || []
    }));

    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE a new personal todo
const createTodo = async (req, res) => {
  try {
    const { title, description, priority, dueDate, reminderAt, checklist } = req.body;

    let todo;
    const todoId = randomUUID();

    await db.transaction(async (tx) => {
      const newTodo = {
        id: todoId,
        title,
        description: description || null,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        type: 'PERSONAL',
        dueDate: new Date(dueDate),
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        reminderSent: false,
        createdById: req.user.id,
        assignedToId: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await tx.insert(schema.tasks).values(newTodo);

      const checklistRecords = [];
      if (checklist && checklist.length > 0) {
        for (const item of checklist) {
          const itemId = randomUUID();
          const newItem = {
            id: itemId,
            taskId: todoId,
            content: item,
            isCompleted: false,
            completedAt: null
          };
          await tx.insert(schema.taskChecklistItems).values(newItem);
          checklistRecords.push(newItem);
        }
      }

      todo = {
        ...newTodo,
        checklist: checklistRecords
      };
    });

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TODOS' });
    }

    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE a todo
const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, reminderAt } = req.body;

    const existingList = await db.select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, id),
          eq(schema.tasks.createdById, req.user.id)
        )
      )
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'To-do not found' });
    }

    const existing = existingList[0];

    const updateData = {
      title: title !== undefined ? title : existing.title,
      description: description !== undefined ? description : existing.description,
      priority: priority !== undefined ? priority : existing.priority,
      dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
      reminderAt: reminderAt ? new Date(reminderAt) : (reminderAt === null ? null : existing.reminderAt),
      reminderSent: reminderAt ? false : existing.reminderSent,
      updatedAt: new Date()
    };

    await db.update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, id));

    const checklist = await db.select()
      .from(schema.taskChecklistItems)
      .where(eq(schema.taskChecklistItems.taskId, id));

    const todo = {
      ...existing,
      ...updateData,
      checklist
    };

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TODOS' });
    }

    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// COMPLETE a todo
const completeTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const existingList = await db.select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, id),
          eq(schema.tasks.createdById, req.user.id)
        )
      )
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'To-do not found' });
    }

    const existing = existingList[0];

    const updateData = {
      status: 'COMPLETED',
      completedAt: new Date(),
      updatedAt: new Date()
    };

    await db.update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, id));

    const checklist = await db.select()
      .from(schema.taskChecklistItems)
      .where(eq(schema.taskChecklistItems.taskId, id));

    const todo = {
      ...existing,
      ...updateData,
      checklist
    };

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TODOS' });
    }

    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE a todo
const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const existingList = await db.select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, id),
          eq(schema.tasks.createdById, req.user.id)
        )
      )
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json({ success: false, message: 'To-do not found' });
    }

    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TODOS' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// TOGGLE checklist item
const toggleTodoChecklist = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const itemsList = await db.select()
      .from(schema.taskChecklistItems)
      .where(
        and(
          eq(schema.taskChecklistItems.id, itemId),
          eq(schema.taskChecklistItems.taskId, id)
        )
      )
      .limit(1);

    if (itemsList.length === 0) {
      return res.status(404).json({ success: false, message: 'Checklist item not found' });
    }

    const item = itemsList[0];
    const newCompletedState = !item.isCompleted;

    const updateData = {
      isCompleted: newCompletedState,
      completedAt: newCompletedState ? new Date() : null
    };

    await db.update(schema.taskChecklistItems)
      .set(updateData)
      .where(eq(schema.taskChecklistItems.id, itemId));

    const updated = {
      ...item,
      ...updateData
    };

    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'TODOS' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTodos,
  createTodo,
  updateTodo,
  completeTodo,
  deleteTodo,
  toggleTodoChecklist,
};
