const { eq, and, inArray, sql, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────────────

const canCreate = (user) =>
  user.role === 'ADMIN' || user.canCreateMaterialRequests === true;

// ── GET /api/material-requests ───────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status, assignedToId, page = 1, limit = 100 } = req.query;
    const user = req.user;
    const conditions = [];

    if (status) {
      conditions.push(eq(schema.materialRequests.status, status));
    }

    // Non-creator employees see only their own assigned requests
    if (!canCreate(user)) {
      conditions.push(eq(schema.materialRequests.assignedToId, user.id));
    } else if (assignedToId) {
      conditions.push(eq(schema.materialRequests.assignedToId, assignedToId));
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schema.materialRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(totalResult[0]?.count || 0);

    const requestsRaw = await db.select({
      id: schema.materialRequests.id,
      title: schema.materialRequests.title,
      projectName: schema.materialRequests.projectName,
      location: schema.materialRequests.location,
      notes: schema.materialRequests.notes,
      status: schema.materialRequests.status,
      createdById: schema.materialRequests.createdById,
      assignedToId: schema.materialRequests.assignedToId,
      completedAt: schema.materialRequests.completedAt,
      completionNote: schema.materialRequests.completionNote,
      completionVoiceUrl: schema.materialRequests.completionVoiceUrl,
      failureReason: schema.materialRequests.failureReason,
      failureVoiceUrl: schema.materialRequests.failureVoiceUrl,
      createdAt: schema.materialRequests.createdAt,
      updatedAt: schema.materialRequests.updatedAt,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.materialRequests)
    .leftJoin(schema.users, eq(schema.materialRequests.createdById, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.materialRequests.createdAt))
    .limit(parsedLimit)
    .offset(skip);

    const requestsRows = requestsRaw.map(r => ({
      id: r.id, title: r.title, projectName: r.projectName, location: r.location,
      notes: r.notes, status: r.status, createdById: r.createdById, assignedToId: r.assignedToId,
      completedAt: r.completedAt, completionNote: r.completionNote, completionVoiceUrl: r.completionVoiceUrl,
      failureReason: r.failureReason, failureVoiceUrl: r.failureVoiceUrl, createdAt: r.createdAt, updatedAt: r.updatedAt,
      createdBy: r.createdById_ ? { id: r.createdById_, firstName: r.createdByFirstName, lastName: r.createdByLastName } : null
    }));

    // Fetch assignees and items in batch to keep Drizzle code clean and extremely fast
    let assigneesMap = {};
    let itemsMap = {};
    if (requestsRows.length > 0) {
      const mrIds = requestsRows.map(r => r.id);
      const assigneeIds = [...new Set(requestsRows.map(r => r.assignedToId))];

      const assignees = await db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName
      })
      .from(schema.users)
      .where(inArray(schema.users.id, assigneeIds));

      for (const u of assignees) {
        assigneesMap[u.id] = u;
      }

      const items = await db.select()
        .from(schema.materialRequestItems)
        .where(inArray(schema.materialRequestItems.materialRequestId, mrIds));

      for (const item of items) {
        if (!itemsMap[item.materialRequestId]) itemsMap[item.materialRequestId] = [];
        itemsMap[item.materialRequestId].push(item);
      }
    }

    const formattedRequests = requestsRows.map(r => ({
      ...r,
      createdBy: r.createdBy?.id ? r.createdBy : null,
      assignedTo: assigneesMap[r.assignedToId] || null,
      items: itemsMap[r.id] || []
    }));

    res.json({
      success: true,
      data: formattedRequests,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/material-requests/:id ───────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const user = req.user;
    const mrRows = await db.select({
      id: schema.materialRequests.id,
      title: schema.materialRequests.title,
      projectName: schema.materialRequests.projectName,
      location: schema.materialRequests.location,
      notes: schema.materialRequests.notes,
      status: schema.materialRequests.status,
      createdById: schema.materialRequests.createdById,
      assignedToId: schema.materialRequests.assignedToId,
      completedAt: schema.materialRequests.completedAt,
      completionNote: schema.materialRequests.completionNote,
      completionVoiceUrl: schema.materialRequests.completionVoiceUrl,
      failureReason: schema.materialRequests.failureReason,
      failureVoiceUrl: schema.materialRequests.failureVoiceUrl,
      createdAt: schema.materialRequests.createdAt,
      updatedAt: schema.materialRequests.updatedAt,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.materialRequests)
    .leftJoin(schema.users, eq(schema.materialRequests.createdById, schema.users.id))
    .where(eq(schema.materialRequests.id, req.params.id))
    .limit(1);

    if (mrRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const rawMr = mrRows[0];
    const mr = {
      id: rawMr.id, title: rawMr.title, projectName: rawMr.projectName, location: rawMr.location,
      notes: rawMr.notes, status: rawMr.status, createdById: rawMr.createdById, assignedToId: rawMr.assignedToId,
      completedAt: rawMr.completedAt, completionNote: rawMr.completionNote, completionVoiceUrl: rawMr.completionVoiceUrl,
      failureReason: rawMr.failureReason, failureVoiceUrl: rawMr.failureVoiceUrl, createdAt: rawMr.createdAt, updatedAt: rawMr.updatedAt,
      createdBy: rawMr.createdById_ ? { id: rawMr.createdById_, firstName: rawMr.createdByFirstName, lastName: rawMr.createdByLastName } : null
    };

    // Employee without create perm can only see their own
    if (!canCreate(user) && mr.assignedToId !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Fetch assignee
    const assigneeList = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName
    })
    .from(schema.users)
    .where(eq(schema.users.id, mr.assignedToId))
    .limit(1);
    mr.assignedTo = assigneeList[0] || null;

    // Fetch items
    const items = await db.select()
      .from(schema.materialRequestItems)
      .where(eq(schema.materialRequestItems.materialRequestId, mr.id));
    mr.items = items;

    res.json({ success: true, data: mr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/material-requests ──────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { title, projectName, location, notes, assignedToId, items } = req.body;
    if (!title || !assignedToId || !items?.length) {
      return res.status(400).json({ success: false, message: 'title, assignedToId and items are required' });
    }

    const mrId = randomUUID();

    const requestData = {
      id: mrId,
      title,
      projectName: projectName || null,
      location: location || null,
      notes: notes || null,
      status: 'PENDING',
      createdById: req.user.id,
      assignedToId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const finalMr = await db.transaction(async (tx) => {
      await tx.insert(schema.materialRequests).values(requestData);

      const itemsToInsert = items.map(i => ({
        id: randomUUID(),
        materialRequestId: mrId,
        itemName: i.itemName,
        itemCode: i.itemCode || null,
        category: i.category || null,
        unit: i.unit || 'Nos',
        quantity: String(i.quantity),
        notes: i.notes || null,
        isPurchased: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await tx.insert(schema.materialRequestItems).values(itemsToInsert);

      return {
        ...requestData,
        items: itemsToInsert
      };
    });

    const assigneeList = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName
    })
    .from(schema.users)
    .where(eq(schema.users.id, assignedToId))
    .limit(1);
    finalMr.assignedTo = assigneeList[0] || null;

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.status(201).json({ success: true, data: finalMr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/material-requests/:id ───────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { title, projectName, location, notes, assignedToId, items, status } = req.body;

    const mrList = await db.select().from(schema.materialRequests).where(eq(schema.materialRequests.id, req.params.id)).limit(1);
    if (mrList.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const mrUpdate = {
      updatedAt: new Date()
    };
    if (title !== undefined) mrUpdate.title = title;
    if (projectName !== undefined) mrUpdate.projectName = projectName || null;
    if (location !== undefined) mrUpdate.location = location || null;
    if (notes !== undefined) mrUpdate.notes = notes || null;
    if (status !== undefined) mrUpdate.status = status;
    if (assignedToId !== undefined) mrUpdate.assignedToId = assignedToId;

    const finalUpdated = await db.transaction(async (tx) => {
      await tx.update(schema.materialRequests)
        .set(mrUpdate)
        .where(eq(schema.materialRequests.id, req.params.id));

      if (items?.length) {
        // Delete existing items and recreate
        await tx.delete(schema.materialRequestItems)
          .where(eq(schema.materialRequestItems.materialRequestId, req.params.id));

        const itemsToInsert = items.map(i => ({
          id: randomUUID(),
          materialRequestId: req.params.id,
          itemName: i.itemName,
          itemCode: i.itemCode || null,
          category: i.category || null,
          unit: i.unit || 'Nos',
          quantity: String(i.quantity),
          notes: i.notes || null,
          isPurchased: Boolean(i.isPurchased),
          purchasedAt: i.isPurchased ? new Date() : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        await tx.insert(schema.materialRequestItems).values(itemsToInsert);
      }

      const updatedMr = await tx.select().from(schema.materialRequests).where(eq(schema.materialRequests.id, req.params.id)).limit(1).then(r => r[0]);
      const updatedItems = await tx.select().from(schema.materialRequestItems).where(eq(schema.materialRequestItems.materialRequestId, req.params.id));
      updatedMr.items = updatedItems;
      return updatedMr;
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, data: finalUpdated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/material-requests/:id/status ──────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const user = req.user;
    const mrList = await db.select().from(schema.materialRequests).where(eq(schema.materialRequests.id, req.params.id)).limit(1);
    const mr = mrList[0];
    if (!mr) return res.status(404).json({ success: false, message: 'Not found' });

    // Only assignee OR admin/elevated may update status
    if (!canCreate(user) && mr.assignedToId !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { status, completionNote, failureReason } = req.body;
    if (!['COMPLETE', 'INCOMPLETE', 'IN_PROGRESS', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Voice file uploaded via multipart
    const voiceFile = req.file;
    const voicePath  = voiceFile
      ? `/uploads/voice/material-requests/${voiceFile.filename}`
      : undefined;

    const mrUpdate = {
      status,
      updatedAt: new Date()
    };

    if (status === 'COMPLETE') {
      mrUpdate.completedAt = new Date();
      mrUpdate.completionNote = completionNote || null;
      if (voicePath) mrUpdate.completionVoiceUrl = voicePath;
    } else if (status === 'INCOMPLETE') {
      mrUpdate.failureReason = failureReason || null;
      if (voicePath) mrUpdate.failureVoiceUrl = voicePath;
    }

    await db.update(schema.materialRequests)
      .set(mrUpdate)
      .where(eq(schema.materialRequests.id, req.params.id));

    const updated = await db.select().from(schema.materialRequests).where(eq(schema.materialRequests.id, req.params.id)).limit(1).then(r => r[0]);

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/material-requests/:id/items/:itemId/purchased ─────────────────
exports.toggleItemPurchased = async (req, res) => {
  try {
    const user = req.user;
    const mrList = await db.select().from(schema.materialRequests).where(eq(schema.materialRequests.id, req.params.id)).limit(1);
    const mr = mrList[0];
    if (!mr) return res.status(404).json({ success: false, message: 'Not found' });

    // Only assignee OR admin/elevated may toggle items
    if (!canCreate(user) && mr.assignedToId !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { isPurchased, purchaseNote } = req.body;
    
    await db.update(schema.materialRequestItems)
      .set({
        isPurchased: Boolean(isPurchased),
        purchasedAt: isPurchased ? new Date() : null,
        purchaseNote: purchaseNote || null,
        updatedAt: new Date()
      })
      .where(eq(schema.materialRequestItems.id, req.params.itemId));

    const item = await db.select().from(schema.materialRequestItems).where(eq(schema.materialRequestItems.id, req.params.itemId)).limit(1).then(r => r[0]);

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/material-requests/:id ────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.materialRequestItems)
        .where(eq(schema.materialRequestItems.materialRequestId, req.params.id));
      await tx.delete(schema.materialRequests)
        .where(eq(schema.materialRequests.id, req.params.id));
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
