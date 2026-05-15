const prisma = require('../utils/db');
const path  = require('path');
const fs    = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────────────

const canCreate = (user) =>
  user.role === 'ADMIN' || user.canCreateMaterialRequests === true;

// ── GET /api/material-requests ───────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status, assignedToId, page = 1, limit = 100 } = req.query;
    const user = req.user;
    const where = {};

    if (status) where.status = status;

    // Non-creator employees see only their own assigned requests
    if (!canCreate(user)) {
      where.assignedToId = user.id;
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [requests, total] = await Promise.all([
      prisma.materialRequest.findMany({
        where,
        include: {
          items: true,
          createdBy:  { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.materialRequest.count({ where }),
    ]);

    res.json({ success: true, data: requests, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/material-requests/:id ───────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const user = req.user;
    const mr   = await prisma.materialRequest.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        createdBy:  { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!mr) return res.status(404).json({ success: false, message: 'Not found' });

    // Employee without create perm can only see their own
    if (!canCreate(user) && mr.assignedToId !== user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: mr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/material-requests ──────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { title, projectName, location, notes, assignedToId, items } = req.body;
    if (!title || !assignedToId || !items?.length)
      return res.status(400).json({ success: false, message: 'title, assignedToId and items are required' });

    const mr = await prisma.materialRequest.create({
      data: {
        title, projectName, location, notes,
        createdById: req.user.id,
        assignedToId,
        items: {
          create: items.map(i => ({
            itemName: i.itemName,
            itemCode: i.itemCode || null,
            category: i.category || null,
            unit:     i.unit || 'Nos',
            quantity: Number(i.quantity),
            notes:    i.notes || null,
          })),
        },
      },
      include: { items: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.status(201).json({ success: true, data: mr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/material-requests/:id ───────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { title, projectName, location, notes, assignedToId, items, status } = req.body;

    // Delete existing items and recreate
    await prisma.materialRequestItem.deleteMany({ where: { materialRequestId: req.params.id } });

    const mr = await prisma.materialRequest.update({
      where: { id: req.params.id },
      data: {
        title, projectName, location, notes,
        ...(status && { status }),
        ...(assignedToId && { assignedToId }),
        ...(items?.length && {
          items: {
            create: items.map(i => ({
              itemName: i.itemName,
              itemCode: i.itemCode || null,
              category: i.category || null,
              unit:     i.unit || 'Nos',
              quantity: Number(i.quantity),
              notes:    i.notes || null,
              isPurchased: Boolean(i.isPurchased),
              purchasedAt: i.isPurchased ? new Date() : null,
            })),
          },
        }),
      },
      include: { items: true },
    });

    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, data: mr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/material-requests/:id/status ──────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const user = req.user;
    const mr   = await prisma.materialRequest.findUnique({ where: { id: req.params.id } });
    if (!mr) return res.status(404).json({ success: false, message: 'Not found' });

    // Only assignee OR admin/elevated may update status
    if (!canCreate(user) && mr.assignedToId !== user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });

    const { status, completionNote, failureReason } = req.body;
    if (!['COMPLETE', 'INCOMPLETE', 'IN_PROGRESS', 'PENDING'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    // Voice file uploaded via multipart
    const voiceFile = req.file;
    const voiceField = status === 'COMPLETE' ? 'completionVoiceUrl' : 'failureVoiceUrl';
    const voicePath  = voiceFile
      ? `/uploads/voice/material-requests/${voiceFile.filename}`
      : undefined;

    const updated = await prisma.materialRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'COMPLETE' && {
          completedAt:    new Date(),
          completionNote: completionNote || null,
          ...(voicePath && { completionVoiceUrl: voicePath }),
        }),
        ...(status === 'INCOMPLETE' && {
          failureReason: failureReason || null,
          ...(voicePath && { failureVoiceUrl: voicePath }),
        }),
      },
    });

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
    const mr   = await prisma.materialRequest.findUnique({ where: { id: req.params.id } });
    if (!mr) return res.status(404).json({ success: false, message: 'Not found' });

    // Only assignee OR admin/elevated may toggle items
    if (!canCreate(user) && mr.assignedToId !== user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });

    const { isPurchased, purchaseNote } = req.body;
    const item = await prisma.materialRequestItem.update({
      where: { id: req.params.itemId },
      data: {
        isPurchased: Boolean(isPurchased),
        purchasedAt: isPurchased ? new Date() : null,
        purchaseNote: purchaseNote || null,
      },
    });
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/material-requests/:id ────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    await prisma.materialRequest.delete({ where: { id: req.params.id } });
    req.app.get('io')?.emit('REFRESH_DATA', { module: 'MATERIAL_REQUESTS' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
