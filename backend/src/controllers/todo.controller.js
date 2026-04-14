const prisma = require('../utils/db');

// GET all todos for the logged-in admin
const getTodos = async (req, res) => {
  try {
    const { status, priority, search } = req.query;

    const where = {
      createdById: req.user.id,
      type: 'PERSONAL',          // ⬅️ strict separation from team tasks
    };

    if (status && status !== 'ALL') where.status = status;
    if (priority && priority !== 'ALL') where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const todos = await prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: {
        checklist: true,
      },
    });

    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE a new personal todo
const createTodo = async (req, res) => {
  try {
    const { title, description, priority, dueDate, reminderAt, checklist } = req.body;

    const todo = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        type: 'PERSONAL',
        dueDate: new Date(dueDate),
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        reminderSent: false,
        createdById: req.user.id,
        assignedToId: req.user.id,
        checklist: checklist && checklist.length > 0
          ? {
              create: checklist.map((item) => ({
                content: item,
                isCompleted: false,
              })),
            }
          : undefined,
      },
      include: { checklist: true },
    });

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

    const existing = await prisma.task.findFirst({
      where: { id, createdById: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'To-do not found' });
    }

    const todo = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        reminderSent: reminderAt ? false : existing.reminderSent,
      },
      include: { checklist: true },
    });

    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// COMPLETE a todo
const completeTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.task.findFirst({
      where: { id, createdById: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'To-do not found' });
    }

    const todo = await prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: { checklist: true },
    });

    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE a todo
const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.task.findFirst({
      where: { id, createdById: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'To-do not found' });
    }

    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// TOGGLE checklist item
const toggleTodoChecklist = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const item = await prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId: id },
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Checklist item not found' });
    }

    const updated = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted: !item.isCompleted,
        completedAt: !item.isCompleted ? new Date() : null,
      },
    });

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
