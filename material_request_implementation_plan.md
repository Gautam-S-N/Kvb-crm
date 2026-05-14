# Material Request Module — Full Implementation Plan

> **Codebase**: React + Zustand + Tailwind (frontend) · Node.js + Express + Prisma + MySQL (backend)  
> **Fits into**: Existing permission system (`requireModule` / `requireElevated`), voice-upload pattern from Tasks, navigation pattern from Layout

---

## 1. Overview & Role Behaviour

| Who | What they can do |
|-----|-----------------|
| **Admin** | Create material requests, select items from catalog, set project/location, assign to employee, track purchase status per item |
| **Employee with `canCreateMaterialRequests`** | Same as Admin — full create access |
| **Employee without elevated perm** | Read-only on their own assigned requests; can mark COMPLETE or INCOMPLETE (with text/voice reason) |

---

## 2. Database Changes

### 2a. New Prisma Models — add to `schema.prisma`

```prisma
// ============================================
// MATERIAL REQUEST (Procurement Tracking)
// ============================================

enum MaterialRequestStatus {
  PENDING
  IN_PROGRESS
  COMPLETE
  INCOMPLETE
}

model MaterialRequest {
  id              String                  @id @default(uuid())
  title           String                  // e.g. "Solar Dryer Project — Phase 2"
  projectName     String?                 // Project name
  location        String?                 // Site / location
  notes           String?                 @db.Text
  status          MaterialRequestStatus   @default(PENDING)

  // Who created it (Admin or elevated employee)
  createdById     String
  createdBy       User                    @relation("MReqCreator", fields: [createdById], references: [id])

  // Who is responsible for fulfilling it
  assignedToId    String
  assignedTo      User                    @relation("MReqAssignee", fields: [assignedToId], references: [id])

  // Completion details (filled by assignee)
  completedAt     DateTime?
  completionNote  String?                 @db.Text
  completionVoiceUrl String?              // path to webm voice note

  // Incompletion reason
  failureReason   String?                 @db.Text
  failureVoiceUrl String?

  items           MaterialRequestItem[]

  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@map("material_requests")
}

model MaterialRequestItem {
  id                  String          @id @default(uuid())
  materialRequestId   String
  materialRequest     MaterialRequest @relation(fields: [materialRequestId], references: [id], onDelete: Cascade)

  // Snapshot from material catalog at time of request
  itemName            String
  itemCode            String?
  category            String?
  unit                String          @default("Nos")
  quantity            Decimal         @db.Decimal(15, 2)
  notes               String?         @db.Text

  // Admin tracks whether this specific item was purchased
  isPurchased         Boolean         @default(false)
  purchasedAt         DateTime?
  purchaseNote        String?         @db.Text

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@map("material_request_items")
}
```

### 2b. Add Relations to User model (in existing `model User {}`)

```prisma
// Inside model User — add these two lines alongside existing relations:
createdMaterialRequests  MaterialRequest[] @relation("MReqCreator")
assignedMaterialRequests MaterialRequest[] @relation("MReqAssignee")
```

### 2c. Migration SQL

Create file: `prisma/migrations/20260515000000_material_requests/migration.sql`

```sql
-- CreateEnum
CREATE TABLE IF NOT EXISTS `_prisma_migrations` (`id` VARCHAR(36) PRIMARY KEY);

ALTER TABLE `users`
  -- no column changes needed; relations handled by Prisma

;

CREATE TABLE `material_requests` (
  `id`                VARCHAR(191) NOT NULL,
  `title`             VARCHAR(191) NOT NULL,
  `projectName`       VARCHAR(191) NULL,
  `location`          VARCHAR(191) NULL,
  `notes`             TEXT NULL,
  `status`            ENUM('PENDING','IN_PROGRESS','COMPLETE','INCOMPLETE') NOT NULL DEFAULT 'PENDING',
  `createdById`       VARCHAR(191) NOT NULL,
  `assignedToId`      VARCHAR(191) NOT NULL,
  `completedAt`       DATETIME(3) NULL,
  `completionNote`    TEXT NULL,
  `completionVoiceUrl` VARCHAR(191) NULL,
  `failureReason`     TEXT NULL,
  `failureVoiceUrl`   VARCHAR(191) NULL,
  `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `material_requests_createdById_fkey` (`createdById`),
  INDEX `material_requests_assignedToId_fkey` (`assignedToId`),
  CONSTRAINT `material_requests_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `material_requests_assignedToId_fkey`
    FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `material_request_items` (
  `id`                  VARCHAR(191) NOT NULL,
  `materialRequestId`   VARCHAR(191) NOT NULL,
  `itemName`            VARCHAR(191) NOT NULL,
  `itemCode`            VARCHAR(191) NULL,
  `category`            VARCHAR(191) NULL,
  `unit`                VARCHAR(191) NOT NULL DEFAULT 'Nos',
  `quantity`            DECIMAL(15,2) NOT NULL,
  `notes`               TEXT NULL,
  `isPurchased`         BOOLEAN NOT NULL DEFAULT false,
  `purchasedAt`         DATETIME(3) NULL,
  `purchaseNote`        TEXT NULL,
  `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `material_request_items_materialRequestId_fkey` (`materialRequestId`),
  CONSTRAINT `material_request_items_materialRequestId_fkey`
    FOREIGN KEY (`materialRequestId`) REFERENCES `material_requests`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 3. Backend

### 3a. Controller — `src/controllers/materialRequest.controller.js`

```js
const prisma = require('../utils/db');
const path  = require('path');
const fs    = require('fs');
const { getSubordinateIds } = require('../middleware/permission.middleware');

// ── Helpers ──────────────────────────────────────────────────────────────────

const canCreate = (user) =>
  user.role === 'ADMIN' || user.canCreateMaterialRequests === true;

// ── GET /api/material-requests ───────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status, assignedToId, page = 1, limit = 50 } = req.query;
    const user = req.user;
    const where = {};

    if (status)      where.status = status;

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
// Requires elevated perm canCreateMaterialRequests (checked in route)
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
// Admin/elevated: edit title, project, location, assignee, items
exports.update = async (req, res) => {
  try {
    const { title, projectName, location, notes, assignedToId, items } = req.body;

    await prisma.materialRequestItem.deleteMany({ where: { materialRequestId: req.params.id } });

    const mr = await prisma.materialRequest.update({
      where: { id: req.params.id },
      data: {
        title, projectName, location, notes,
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
              isPurchased: i.isPurchased || false,
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
// Employee marks COMPLETE or INCOMPLETE (with reason + optional voice note)
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

    // Voice file uploaded via multipart (reuses existing upload middleware pattern)
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
// Admin toggles isPurchased on individual line items
exports.toggleItemPurchased = async (req, res) => {
  try {
    const { isPurchased, purchaseNote } = req.body;
    const item = await prisma.materialRequestItem.update({
      where: { id: req.params.itemId },
      data: {
        isPurchased: Boolean(isPurchased),
        purchasedAt:  isPurchased ? new Date() : null,
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
```

---

### 3b. Routes — `src/routes/materialRequest.routes.js`

```js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const { authenticate } = require('../middleware/auth.middleware');
const { requireModule, requireElevated } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/materialRequest.controller');

// Voice upload storage (mirrors existing tasks voice pattern)
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/voice/material-requests');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `mr-voice-${Date.now()}.webm`),
});
const upload = multer({ storage: voiceStorage });

router.use(authenticate);
router.use(requireModule('MATERIAL_REQUESTS'));

// Read — any authenticated user with module access
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// Write — requires elevated perm
router.post('/',    requireElevated('canCreateMaterialRequests'), ctrl.create);
router.put('/:id',  requireElevated('canCreateMaterialRequests'), ctrl.update);
router.delete('/:id', requireElevated('canCreateMaterialRequests'), ctrl.remove);

// Status update — assignee or elevated (permission checked in controller)
router.patch('/:id/status', upload.single('voiceNote'), ctrl.updateStatus);

// Toggle purchase status on individual items — admin/elevated only
router.patch(
  '/:id/items/:itemId/purchased',
  requireElevated('canCreateMaterialRequests'),
  ctrl.toggleItemPurchased
);

module.exports = router;
```

---

### 3c. Register route in `src/server.js`

```js
// Add alongside existing route registrations:
const materialRequestRoutes = require('./routes/materialRequest.routes');
app.use('/api/material-requests', materialRequestRoutes);

// Add static serving for voice notes:
app.use('/uploads/voice/material-requests',
  express.static(path.join(__dirname, '../uploads/voice/material-requests'))
);
```

---

### 3d. `permission.middleware.js` — add `canCreateMaterialRequests` to native columns

```js
// Change this line:
const NATIVE_PERM_COLUMNS = ['canAssignLeads', 'canAssignTasks', 'canViewSubordinates'];

// To:
const NATIVE_PERM_COLUMNS = [
  'canAssignLeads',
  'canAssignTasks',
  'canViewSubordinates',
  'canCreateMaterialRequests',   // ← NEW
];
```

Then add the native column to the `User` model in `schema.prisma`:

```prisma
// Inside model User, alongside the other can* columns:
canCreateMaterialRequests Boolean @default(false)
```

And the corresponding migration:

```sql
ALTER TABLE `users`
  ADD COLUMN `canCreateMaterialRequests` BOOLEAN NOT NULL DEFAULT false;
```

---

## 4. Frontend

### 4a. Zustand Store — `src/stores/materialRequestStore.js`

```js
import { create } from 'zustand';
import api from '../services/api';

export const useMaterialRequestStore = create((set, get) => ({
  requests: [],
  loading:  false,
  error:    null,

  fetchRequests: async (params = {}) => {
    set({ loading: true });
    try {
      const q = new URLSearchParams(params).toString();
      const { data } = await api.get(`/material-requests?${q}`);
      set({ requests: data.data, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  createRequest: async (payload) => {
    const { data } = await api.post('/material-requests', payload);
    await get().fetchRequests();
    return data;
  },

  updateRequest: async (id, payload) => {
    const { data } = await api.put(`/material-requests/${id}`, payload);
    await get().fetchRequests();
    return data;
  },

  updateStatus: async (id, statusPayload, voiceFile) => {
    const form = new FormData();
    Object.entries(statusPayload).forEach(([k, v]) => v && form.append(k, v));
    if (voiceFile) form.append('voiceNote', voiceFile);
    const { data } = await api.patch(`/material-requests/${id}/status`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await get().fetchRequests();
    return data;
  },

  toggleItemPurchased: async (requestId, itemId, isPurchased, purchaseNote) => {
    const { data } = await api.patch(
      `/material-requests/${requestId}/items/${itemId}/purchased`,
      { isPurchased, purchaseNote }
    );
    await get().fetchRequests();
    return data;
  },

  deleteRequest: async (id) => {
    await api.delete(`/material-requests/${id}`);
    await get().fetchRequests();
  },
}));
```

---

### 4b. New Page — `src/pages/MaterialRequests.jsx`

The page has **two modes** controlled by user role/permission:

**Admin / `canCreateMaterialRequests` view:**

```
┌─ Material Requests ─────────────────────────────── [+ New Request] ─┐
│  Filters: Status ▾  Assignee ▾  Project ▾                          │
├──────────────────────────────────────────────────────────────────────┤
│  Card grid — each card shows:                                        │
│    Title · Project/Location badge                                    │
│    Assignee chip · Status badge (PENDING / IN_PROGRESS / etc.)      │
│    Progress bar: X of Y items purchased ✓                           │
│    [View Details]  [Edit]  [Delete]                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Detail / Edit Drawer (slide-in panel):**

```
┌─ Solar Dryer Phase 2 ───────────────────────────── [Close] ─────────┐
│  Project: Solar Dryer  |  Location: Bengaluru  |  Assignee: Raj     │
│  Status: PENDING                                                     │
├──────────────────────────────────────────────────────────────────────┤
│  Material Items Table:                                               │
│  ┌──────────────┬──────┬─────┬──────┬──────────┬──────────────────┐ │
│  │ Item Name    │ Code │ Qty │ Unit │ Category │ Purchased?       │ │
│  ├──────────────┼──────┼─────┼──────┼──────────┼──────────────────┤ │
│  │ MS Pipe 2"   │ P-12 │ 10  │ Nos  │ Piping   │ ☑ (toggle)      │ │
│  │ Insulation   │ I-03 │ 5   │ Nos  │ Thermal  │ ☐               │ │
│  └──────────────┴──────┴─────┴──────┴──────────┴──────────────────┘ │
│                                                                      │
│  Completion voice note: [▶ Play] — if employee submitted one        │
│  Failure reason: "—"                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Employee view (assigned requests only):**

```
┌─ My Material Requests ───────────────────────────────────────────────┐
│  Card per request — shows items list, project, status                │
│  [Mark Complete]  [Mark Incomplete]                                  │
│                                                                      │
│  On "Mark Incomplete" → modal with:                                  │
│    • Text area: "Describe the issue…"                                │
│    • VoiceRecorder component (reuse existing)                        │
│    • [Submit]                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Create Request modal (admin/elevated):**

```
┌─ New Material Request ──────────────────────────────────────────────┐
│  Title: [_______________]                                            │
│  Project Name: [___________]   Location: [____________]             │
│  Assign To: [employee dropdown]                                      │
│  Notes: [textarea]                                                   │
├─ Select Materials ──────────────────────────────────────────────────┤
│  Search: [_______]   Category filter: [All ▾]                       │
│                                                                      │
│  Spreadsheet-style table (loaded from /api/materials):              │
│  ┌────┬──────────────┬──────┬─────┬──────┬───────┬──────────────┐  │
│  │ ☐  │ Item Name    │ Code │ Cat │ Unit │ Stock │ Qty to Order │  │
│  ├────┼──────────────┼──────┼─────┼──────┼───────┼──────────────┤  │
│  │ ☑  │ MS Pipe 2"   │ P-12 │ Pip │ Nos  │  24   │ [  10      ] │  │
│  │ ☐  │ Insulation   │ I-03 │ Thm │ Nos  │   3   │ [          ] │  │
│  └────┴──────────────┴──────┴─────┴──────┴───────┴──────────────┘  │
│  (Items loaded from material catalog; sheet tabs shown as category  │
│   filter tabs matching the two Excel sheet categories)              │
│                                                                      │
│              [Cancel]  [Create Request]                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Full JSX outline** (implement with these sections):

```jsx
// src/pages/MaterialRequests.jsx
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useMaterialRequestStore } from '../stores/materialRequestStore';
import { useMaterialStore } from '../stores/materialStore';  // existing catalog
import VoiceRecorder from '../components/VoiceRecorder/VoiceRecorder';
import api from '../services/api';

const STATUS_COLORS = {
  PENDING:     'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETE:    'bg-green-100 text-green-700',
  INCOMPLETE:  'bg-red-100 text-red-700',
};

export default function MaterialRequests() {
  const { user } = useAuthStore();
  const { requests, fetchRequests, createRequest, updateStatus, toggleItemPurchased, deleteRequest } = useMaterialRequestStore();
  const { materials, fetchMaterials } = useMaterialStore();

  const canCreate = user?.role === 'ADMIN' || user?.permissions?.canCreateMaterialRequests;

  // ── State ──────────────────────────────────────────────────────────
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedReq, setSelectedReq]     = useState(null);
  const [statusModal, setStatusModal]     = useState(null); // { id, targetStatus }
  const [statusNote, setStatusNote]       = useState('');
  const [statusVoice, setStatusVoice]     = useState(null); // Blob

  // Create form state
  const [form, setForm]       = useState({ title: '', projectName: '', location: '', notes: '', assignedToId: '' });
  const [selectedItems, setSelectedItems] = useState({}); // { materialId: quantity }
  const [employees, setEmployees]         = useState([]);
  const [catFilter, setCatFilter]         = useState('ALL');

  // ── Effects ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchRequests();
    if (canCreate) {
      fetchMaterials();
      api.get('/users?role=EMPLOYEE').then(r => setEmployees(r.data.data || []));
    }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    const items = Object.entries(selectedItems)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([matId, qty]) => {
        const m = materials.find(x => x.id === matId);
        return { itemName: m.itemName, itemCode: m.itemCode, category: m.category, unit: m.unit, quantity: qty };
      });
    await createRequest({ ...form, items });
    setShowCreate(false);
    setForm({ title: '', projectName: '', location: '', notes: '', assignedToId: '' });
    setSelectedItems({});
  };

  const handleStatusSubmit = async () => {
    const payload = {
      status: statusModal.targetStatus,
      ...(statusModal.targetStatus === 'COMPLETE'   && { completionNote: statusNote }),
      ...(statusModal.targetStatus === 'INCOMPLETE' && { failureReason:  statusNote }),
    };
    await updateStatus(statusModal.id, payload, statusVoice);
    setStatusModal(null); setStatusNote(''); setStatusVoice(null);
  };

  // Categories from catalog (for tab filter)
  const categories = ['ALL', ...new Set(materials.map(m => m.category).filter(Boolean))];

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Header */}
      {/* Filter bar (admin) / My requests heading (employee) */}
      {/* Request cards grid */}
      {/* Create modal (admin) */}
      {/* Status update modal */}
      {/* Detail drawer */}
    </Layout>
  );
}
```

---

### 4c. Update `src/pages/UserManagement.jsx`

**Step 1 — Add to `ALL_MODULES`:**

```js
// Find the ALL_MODULES array and add:
{ key: 'MATERIAL_REQUESTS', label: 'Material Requests' },
```

**Step 2 — Add to `DEFAULT_PERMISSIONS`:**

```js
modules: {
  // ... existing ...
  MATERIAL_REQUESTS: false,
},
canCreateMaterialRequests: false,   // ← NEW elevated perm
```

**Step 3 — Add elevated perm toggle in the Elevated Perms tab** (find the section with canAssignTasks, canAssignLeads, canViewSubordinates and add):

```jsx
<Toggle
  label="Create Material Requests"
  checked={permissions.canCreateMaterialRequests}
  onChange={v => setElevated('canCreateMaterialRequests', v)}
/>
```

Add a helper description below it:

```jsx
<p className="text-xs text-gray-400 ml-3 -mt-1 mb-2">
  Allows this employee to create and assign material request orders. Without this,
  they can only view and action requests assigned to them.
</p>
```

**Step 4 — Show in permission badges** (find the badge row with canAssignTasks / canAssignLeads):

```jsx
{perms.canCreateMaterialRequests && (
  <PermBadge label="Material Requests" color="teal" />
)}
```

---

### 4d. Update `src/components/Layout.jsx`

**Step 1 — Add nav item** (add after the Inventory entry):

```js
{ to: '/material-requests', icon: ClipboardCheck, label: 'Material Requests', roles: ['ADMIN', 'EMPLOYEE'] },
```

Import `ClipboardCheck` from `lucide-react` at the top of Layout.

**Step 2 — Add module guard mapping** (find the `MODULE_MAP` object / the section that maps routes to module keys):

```js
'/material-requests': 'MATERIAL_REQUESTS',
```

---

### 4e. Update `src/App.jsx`

```jsx
// Import at top:
import MaterialRequests from './pages/MaterialRequests';

// Add route alongside existing ones:
<Route path="/material-requests" element={<PrivateRoute element={<MaterialRequests />} />} />
```

**Add real-time refresh handler** (inside the `handleRefresh` switch block):

```js
} else if (module === 'MATERIAL_REQUESTS') {
  const { useMaterialRequestStore } = await import('./stores/materialRequestStore');
  useMaterialRequestStore.getState().fetchRequests();
}
```

---

## 5. Permission Flow Summary

```
User logs in
    │
    ├─ role === ADMIN
    │      └─ Full access: create, edit, delete, toggle purchased, see all requests
    │
    └─ role === EMPLOYEE
           │
           ├─ permissions.modules.MATERIAL_REQUESTS === false
           │      └─ Nav item hidden, route blocked by Layout guard
           │
           └─ permissions.modules.MATERIAL_REQUESTS === true
                  │
                  ├─ canCreateMaterialRequests === true
                  │      └─ Same as Admin: create + assign + purchased toggle
                  │
                  └─ canCreateMaterialRequests === false  (default)
                         └─ Read-only, sees only assigned requests
                            Can mark COMPLETE or INCOMPLETE (+ voice note)
```

---

## 6. File Upload — Voice Notes

Reuse the exact same pattern as Tasks. Create the directory at startup:

```
uploads/
  voice/
    material-requests/     ← new folder (auto-created by multer)
      mr-voice-1716800000.webm
      mr-voice-1716800001.webm
```

The existing `VoiceRecorder` component in `src/components/VoiceRecorder/VoiceRecorder.jsx` can be used directly — it already provides an audio Blob via `onRecordingComplete` prop.

---

## 7. Admin Purchase Tracking View

Inside the Detail Drawer, the admin gets a dedicated **"Purchase Status"** panel:

```
Purchase Status   3 / 7 items purchased  ████████░░░░░ 43%

Item Name       Code    Qty    Purchased?       Note
────────────────────────────────────────────────────────
MS Pipe 2"      P-12    10     ✓ 14 May 2026    —
Insulation      I-03     5     ✗ [Mark Bought]
GI Sheet        G-07    20     ✗ [Mark Bought]
Fasteners       F-01   100     ✓ 13 May 2026    "Delivered batch 1"
```

The **[Mark Bought]** button calls `PATCH /api/material-requests/:id/items/:itemId/purchased`.

The admin can also optionally add a `purchaseNote` (supplier, invoice ref, etc.) when marking as purchased.

---

## 8. Excel Catalog Import (Two Sheets)

The user's Excel file has two sheets of materials. The material catalog is already in the `materials` DB table. For the initial import use the existing Inventory import mechanism:

1. Open the Excel file, note the two sheet names (e.g. "Electrical" and "Mechanical")
2. Each row becomes a `Material` record with `category` set to the sheet name
3. Import via the existing `/api/materials` POST endpoint in bulk, or:

```bash
# one-time import script (save as scripts/importMaterialCatalog.js)
const XLSX = require('xlsx');
const prisma = require('../src/utils/db');

async function run() {
  const wb = XLSX.readFile('./src/assets/material_catalog.xlsx');
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    for (const row of rows) {
      await prisma.material.create({
        data: {
          itemName: row['Item Name'] || row['itemName'],
          itemCode: row['Item Code'] || row['itemCode'] || undefined,
          category: sheetName,         // sheet name becomes category
          unit:     row['Unit'] || 'Nos',
          rate:     Number(row['Rate']) || 0,
          balance:  Number(row['Balance'] || row['Qty'] || 0),
        }
      });
    }
  }
  console.log('Done');
}
run().catch(console.error).finally(() => prisma.$disconnect());
```

Run once: `node scripts/importMaterialCatalog.js`

In the **Create Request** UI the two sheet names appear as category filter tabs so the admin can quickly browse "Electrical" or "Mechanical" items — exactly mirroring the two-sheet layout.

---

## 9. Implementation Order

| Step | Task | File(s) |
|------|------|---------|
| 1 | Add `canCreateMaterialRequests` native column to User schema + migration | `schema.prisma`, SQL |
| 2 | Add `MaterialRequest` + `MaterialRequestItem` models + migration | `schema.prisma`, SQL |
| 3 | Create voice upload directory in `uploads/voice/material-requests/` | — |
| 4 | Write `materialRequest.controller.js` | new file |
| 5 | Write `materialRequest.routes.js` | new file |
| 6 | Register route + static path in `server.js` | `server.js` |
| 7 | Update `permission.middleware.js` NATIVE_PERM_COLUMNS | `permission.middleware.js` |
| 8 | Write `materialRequestStore.js` | new file |
| 9 | Write `MaterialRequests.jsx` page | new file |
| 10 | Update `UserManagement.jsx` — ALL_MODULES + DEFAULT_PERMISSIONS + toggle UI | `UserManagement.jsx` |
| 11 | Update `Layout.jsx` — nav item + module guard | `Layout.jsx` |
| 12 | Update `App.jsx` — route + real-time handler | `App.jsx` |
| 13 | Run Excel import script to load catalog | `scripts/importMaterialCatalog.js` |
| 14 | Test: Admin creates request → Employee sees it → Employee marks status → Admin sees voice note + toggles purchased | — |

---

## 10. Quick API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/material-requests` | Module | List (admin: all, employee: own) |
| GET | `/api/material-requests/:id` | Module | Detail |
| POST | `/api/material-requests` | Module + `canCreateMaterialRequests` | Create |
| PUT | `/api/material-requests/:id` | Module + `canCreateMaterialRequests` | Edit |
| DELETE | `/api/material-requests/:id` | Module + `canCreateMaterialRequests` | Delete |
| PATCH | `/api/material-requests/:id/status` | Module | Mark complete/incomplete + voice |
| PATCH | `/api/material-requests/:id/items/:itemId/purchased` | Module + `canCreateMaterialRequests` | Toggle item purchased |
