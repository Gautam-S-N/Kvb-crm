const { mysqlTable, varchar, text, timestamp, boolean, decimal, json, int } = require('drizzle-orm/mysql-core');

// ============================================
// SYSTEM SETTINGS
// ============================================
const settings = mysqlTable('settings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  key: varchar('key', { length: 255 }).notNull(),
  value: text('value').notNull(),
  description: varchar('description', { length: 255 }),
  category: varchar('category', { length: 255 }).default('GENERAL').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// SUPPLIER/VENDOR MANAGEMENT
// ============================================
const vendors = mysqlTable('vendors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  companyName: varchar('companyName', { length: 255 }).notNull(),
  contactName: varchar('contactName', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 255 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 255 }),
  state: varchar('state', { length: 255 }),
  pinCode: varchar('pinCode', { length: 255 }),
  gstNumber: varchar('gstNumber', { length: 255 }),
  paymentTerms: varchar('paymentTerms', { length: 255 }),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// PURCHASE ORDER MANAGEMENT
// ============================================
const purchaseOrders = mysqlTable('purchase_orders', {
  id: varchar('id', { length: 36 }).primaryKey(),
  poNumber: varchar('poNumber', { length: 255 }).notNull(),
  status: varchar('status', { length: 255 }).default('DRAFT').notNull(),
  subTotal: decimal('subTotal', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('taxAmount', { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal('totalAmount', { precision: 15, scale: 2 }).notNull(),
  orderDate: timestamp('orderDate').defaultNow().notNull(),
  expectedDate: timestamp('expectedDate'),
  receivedDate: timestamp('receivedDate'),
  notes: text('notes'),
  pdfUrl: varchar('pdfUrl', { length: 255 }),
  vendorId: varchar('vendorId', { length: 36 }).notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const purchaseOrderItems = mysqlTable('purchase_order_items', {
  id: varchar('id', { length: 191 }).primaryKey(),
  purchaseOrderId: varchar('purchaseOrderId', { length: 191 }).notNull(),
  itemName: varchar('itemName', { length: 191 }).notNull(),
  description: text('description'),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unitPrice', { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal('totalPrice', { precision: 15, scale: 2 }).notNull(),
  materialId: varchar('materialId', { length: 191 }),
  hsnCode: varchar('hsnCode', { length: 191 }),
  purchaseItemId: varchar('purchaseItemId', { length: 191 }),
});

// ============================================
// IN-APP NOTIFICATIONS
// ============================================
const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('userId', { length: 36 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  entityType: varchar('entityType', { length: 255 }),
  entityId: varchar('entityId', { length: 255 }),
  isRead: boolean('isRead').default(false).notNull(),
  readAt: timestamp('readAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ============================================
// USER MANAGEMENT & HIERARCHY
// ============================================
const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  firstName: varchar('firstName', { length: 255 }).notNull(),
  lastName: varchar('lastName', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 255 }),
  role: varchar('role', { length: 255 }).default('USER').notNull(),
  status: varchar('status', { length: 255 }).default('ACTIVE').notNull(),
  avatar: varchar('avatar', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  lastLoginAt: timestamp('lastLoginAt'),
  managerId: varchar('managerId', { length: 36 }),
  hierarchyPath: text('hierarchyPath'),
  isSuperAdmin: boolean('isSuperAdmin').default(false).notNull(),
  permissions: json('permissions'),
  canAssignLeads: boolean('canAssignLeads').default(false).notNull(),
  canAssignTasks: boolean('canAssignTasks').default(false).notNull(),
  canViewSubordinates: boolean('canViewSubordinates').default(false).notNull(),
  canCreateMaterialRequests: boolean('canCreateMaterialRequests').default(false).notNull(),
  delegatedManagerId: varchar('delegatedManagerId', { length: 36 }),
  delegationExpiresAt: timestamp('delegationExpiresAt'),
});

// ============================================
// SYSTEM ACTIVITY LOGS
// ============================================
const activityLogs = mysqlTable('activity_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entityType', { length: 255 }).notNull(),
  entityId: varchar('entityId', { length: 255 }).notNull(),
  description: text('description'),
  metadata: json('metadata'),
  performedBy: varchar('performedBy', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ============================================
// LEAD HISTORY TIMELINE
// ============================================
const leadTimeline = mysqlTable('lead_timeline', {
  id: varchar('id', { length: 36 }).primaryKey(),
  leadId: varchar('leadId', { length: 255 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  description: text('description'),
  oldValue: varchar('oldValue', { length: 255 }),
  newValue: varchar('newValue', { length: 255 }),
  performedBy: varchar('performedBy', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ============================================
// PURCHASE CATALOG ITEMS
// ============================================
const purchaseItems = mysqlTable('purchase_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  hsnCode: varchar('hsnCode', { length: 255 }),
  description: text('description'),
  unit: varchar('unit', { length: 255 }).default('Nos').notNull(),
  rate: decimal('rate', { precision: 15, scale: 2 }).default('0.00').notNull(),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// SALES CATALOG PRODUCTS
// ============================================
const products = mysqlTable('products', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sku: varchar('sku', { length: 255 }).notNull(),
  hsnCode: varchar('hsnCode', { length: 255 }),
  category: varchar('category', { length: 255 }),
  unitOfMeasure: varchar('unitOfMeasure', { length: 255 }).default('Units').notNull(),
  basePrice: decimal('basePrice', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('taxRate', { precision: 5, scale: 2 }).default('18.00').notNull(),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// TASK / TODO LIST MANAGEMENT
// ============================================
const tasks = mysqlTable('tasks', {
  id: varchar('id', { length: 191 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 255 }).default('PENDING').notNull(),
  priority: varchar('priority', { length: 255 }).default('MEDIUM').notNull(),
  type: varchar('type', { length: 255 }).default('PERSONAL').notNull(),
  startDate: timestamp('startDate'),
  dueDate: timestamp('dueDate').notNull(),
  completedAt: timestamp('completedAt'),
  isRecurring: boolean('isRecurring').default(false).notNull(),
  recurrence: varchar('recurrence', { length: 255 }),
  recurrenceEnd: timestamp('recurrenceEnd'),
  reminderAt: timestamp('reminderAt'),
  reminderSent: boolean('reminderSent').default(false).notNull(),
  assignmentVoiceUrl: varchar('assignmentVoiceUrl', { length: 255 }),
  assignmentVoiceNote: text('assignmentVoiceNote'),
  completedVoiceUrl: varchar('completionVoiceUrl', { length: 255 }), // mapped to completionVoiceUrl in DB
  completionVoiceNote: text('completionVoiceNote'),
  createdById: varchar('createdById', { length: 191 }).notNull(),
  assignedToId: varchar('assignedToId', { length: 191 }).notNull(),
  snapshotManagerId: varchar('snapshotManagerId', { length: 191 }),
  isArchived: boolean('isArchived').default(false).notNull(),
  deletedAt: timestamp('deletedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  attachmentUrl: varchar('attachmentUrl', { length: 255 }),
  failureReason: text('failureReason'),
});

const taskChecklistItems = mysqlTable('task_checklist_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  taskId: varchar('taskId', { length: 36 }).notNull(),
  content: text('content').notNull(),
  isCompleted: boolean('isCompleted').default(false).notNull(),
  completedAt: timestamp('completedAt'),
});

// ============================================
// INVENTORY MATERIAL MANAGEMENT
// ============================================
const materials = mysqlTable('materials', {
  id: varchar('id', { length: 36 }).primaryKey(),
  itemName: varchar('itemName', { length: 255 }).notNull(),
  itemCode: varchar('itemCode', { length: 255 }),
  category: varchar('category', { length: 255 }),
  unit: varchar('unit', { length: 255 }).default('Nos').notNull(),
  inQty: decimal('inQty', { precision: 15, scale: 2 }).default('0.00').notNull(),
  outQty: decimal('outQty', { precision: 15, scale: 2 }).default('0.00').notNull(),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  minQuantity: decimal('minQuantity', { precision: 15, scale: 2 }).default('0.00').notNull(),
  rate: decimal('rate', { precision: 15, scale: 2 }).default('0.00').notNull(),
  totalValue: decimal('totalValue', { precision: 15, scale: 2 }).default('0.00').notNull(),
  location: varchar('location', { length: 255 }),
  projectSite: varchar('projectSite', { length: 255 }),
  remarks: text('remarks'),
  date: timestamp('date').defaultNow(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// SALES PERFORMANCE TARGETS
// ============================================
const salesTargets = mysqlTable('sales_targets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  employeeId: varchar('employeeId', { length: 36 }).notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  periodType: varchar('periodType', { length: 255 }).default('MONTHLY').notNull(),
  periodYear: int('periodYear').notNull(),
  periodNumber: int('periodNumber').default(1).notNull(),
  revenueTarget: decimal('revenueTarget', { precision: 15, scale: 2 }).notNull(),
  leadsTarget: int('leadsTarget').default(0).notNull(),
  quotationsTarget: int('quotationsTarget').default(0).notNull(),
  revenueAchieved: decimal('revenueAchieved', { precision: 15, scale: 2 }).default('0.00').notNull(),
  leadsAchieved: int('leadsAchieved').default(0).notNull(),
  quotationsSent: int('quotationsSent').default(0).notNull(),
  notes: text('notes'),
  isRecurring: boolean('isRecurring').default(false).notNull(),
  reminderAt: timestamp('reminderAt'),
  reminderSent: boolean('reminderSent').default(false).notNull(),
  parentTargetId: varchar('parentTargetId', { length: 36 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// PERMISSION CHANGE AUDITING
// ============================================
const userPermissionAuditLogs = mysqlTable('user_permission_audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  targetUserId: varchar('targetUserId', { length: 36 }).notNull(),
  changedById: varchar('changedById', { length: 36 }).notNull(),
  previousState: json('previousState').notNull(),
  newState: json('newState').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ============================================
// MATERIAL REQUEST (Procurement Tracking)
// ============================================
const materialRequests = mysqlTable('material_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  projectName: varchar('projectName', { length: 255 }),
  location: varchar('location', { length: 255 }),
  notes: text('notes'),
  status: varchar('status', { length: 255 }).default('PENDING').notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  assignedToId: varchar('assignedToId', { length: 36 }).notNull(),
  completedAt: timestamp('completedAt'),
  completionNote: text('completionNote'),
  completionVoiceUrl: varchar('completionVoiceUrl', { length: 255 }),
  failureReason: text('failureReason'),
  failureVoiceUrl: varchar('failureVoiceUrl', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const materialRequestItems = mysqlTable('material_request_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  materialRequestId: varchar('materialRequestId', { length: 36 }).notNull(),
  itemName: varchar('itemName', { length: 255 }).notNull(),
  itemCode: varchar('itemCode', { length: 255 }),
  category: varchar('category', { length: 255 }),
  unit: varchar('unit', { length: 255 }).default('Nos').notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  isPurchased: boolean('isPurchased').default(false).notNull(),
  purchasedAt: timestamp('purchasedAt'),
  purchaseNote: text('purchaseNote'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// CUSTOMERS & LEADS
// ============================================
const customers = mysqlTable('customers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  companyName: varchar('companyName', { length: 255 }),
  contactName: varchar('contactName', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 255 }).notNull(),
  alternatePhone: varchar('alternatePhone', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 255 }),
  state: varchar('state', { length: 255 }),
  pincode: varchar('pincode', { length: 255 }),
  country: varchar('country', { length: 255 }).default('India').notNull(),
  gstNumber: varchar('gstNumber', { length: 255 }),
  facebookPsid: varchar('facebookPsid', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const leads = mysqlTable('leads', {
  id: varchar('id', { length: 36 }).primaryKey(),
  leadNumber: varchar('leadNumber', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 255 }).default('NEW').notNull(),
  source: varchar('source', { length: 255 }).default('OTHER').notNull(),
  estimateAmount: decimal('estimateAmount', { precision: 15, scale: 2 }),
  closeDate: timestamp('closeDate'),
  customerId: varchar('customerId', { length: 36 }).notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  assignedToId: varchar('assignedToId', { length: 36 }),
  snapshotManagerId: varchar('snapshotManagerId', { length: 36 }),
  isArchived: boolean('isArchived').default(false).notNull(),
  deletedAt: timestamp('deletedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const leadProducts = mysqlTable('lead_products', {
  id: varchar('id', { length: 36 }).primaryKey(),
  leadId: varchar('leadId', { length: 36 }).notNull(),
  productId: varchar('productId', { length: 36 }).notNull(),
  quantity: int('quantity').default(1).notNull(),
  notes: text('notes'),
});

const followUps = mysqlTable('follow_ups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  type: varchar('type', { length: 255 }).notNull(),
  description: text('description').notNull(),
  scheduledAt: timestamp('scheduledAt').notNull(),
  completedAt: timestamp('completedAt'),
  status: varchar('status', { length: 255 }).default('SCHEDULED').notNull(),
  outcome: text('outcome'),
  reminderSent: boolean('reminderSent').default(false).notNull(),
  leadId: varchar('leadId', { length: 36 }).notNull(),
  assignedToId: varchar('assignedToId', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// ============================================
// DAILY REPORTS
// ============================================
const dailyReports = mysqlTable('daily_reports', {
  id: varchar('id', { length: 36 }).primaryKey(),
  reportDate: timestamp('reportDate').notNull(),
  leadsCreated: int('leadsCreated').default(0).notNull(),
  leadsContacted: int('leadsContacted').default(0).notNull(),
  followUpsDone: int('followUpsDone').default(0).notNull(),
  quotationsSent: int('quotationsSent').default(0).notNull(),
  salesClosed: int('salesClosed').default(0).notNull(),
  revenue: decimal('revenue', { precision: 15, scale: 2 }).default('0.00').notNull(),
  activities: text('activities'),
  challenges: text('challenges'),
  nextDayPlan: text('nextDayPlan'),
  employeeId: varchar('employeeId', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ============================================
// QUOTATIONS & SALES
// ============================================
const quotations = mysqlTable('quotations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  quotationNumber: varchar('quotationNumber', { length: 255 }).notNull(),
  version: int('version').default(1).notNull(),
  status: varchar('status', { length: 255 }).default('DRAFT').notNull(),
  subTotal: decimal('subTotal', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discountAmount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  discountPercent: decimal('discountPercent', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxAmount: decimal('taxAmount', { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal('totalAmount', { precision: 15, scale: 2 }).notNull(),
  quotationDate: timestamp('quotationDate').defaultNow().notNull(),
  validUntil: timestamp('validUntil'),
  paymentTerms: varchar('paymentTerms', { length: 255 }),
  deliveryTerms: varchar('deliveryTerms', { length: 255 }),
  notes: text('notes'),
  termsConditions: text('termsConditions'),
  pdfUrl: varchar('pdfUrl', { length: 255 }),
  templateType: varchar('templateType', { length: 255 }).default('STANDARD').notNull(),
  customFields: json('customFields'),
  leadId: varchar('leadId', { length: 36 }).notNull(),
  customerId: varchar('customerId', { length: 36 }).notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  parentId: varchar('parentId', { length: 36 }),
  versionLabel: varchar('versionLabel', { length: 255 }).default('A').notNull(),
  originalDate: timestamp('originalDate'),
  isLatest: boolean('isLatest').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const quotationCounters = mysqlTable('quotation_counters', {
  id: varchar('id', { length: 36 }).primaryKey(),
  productCode: varchar('productCode', { length: 255 }).notNull(),
  counter: int('counter').default(0).notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const quotationReservations = mysqlTable('quotation_reservations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  productCode: varchar('productCode', { length: 255 }).notNull(),
  quotationNumber: varchar('quotationNumber', { length: 255 }).notNull(),
  reservedBy: varchar('reservedBy', { length: 36 }).notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

const quotationItems = mysqlTable('quotation_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  quotationId: varchar('quotationId', { length: 36 }).notNull(),
  productId: varchar('productId', { length: 36 }).notNull(),
  description: text('description'),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unitPrice', { precision: 15, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxRate: decimal('taxRate', { precision: 5, scale: 2 }).notNull(),
  totalPrice: decimal('totalPrice', { precision: 15, scale: 2 }).notNull(),
});

const sales = mysqlTable('sales', {
  id: varchar('id', { length: 36 }).primaryKey(),
  saleNumber: varchar('saleNumber', { length: 255 }).notNull(),
  status: varchar('status', { length: 255 }).default('PENDING').notNull(),
  paymentStatus: varchar('paymentStatus', { length: 255 }).default('UNPAID').notNull(),
  subTotal: decimal('subTotal', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discountAmount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  taxAmount: decimal('taxAmount', { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal('totalAmount', { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal('paidAmount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  balanceAmount: decimal('balanceAmount', { precision: 15, scale: 2 }).notNull(),
  saleDate: timestamp('saleDate').defaultNow().notNull(),
  expectedDelivery: timestamp('expectedDelivery'),
  actualDelivery: timestamp('actualDelivery'),
  notes: text('notes'),
  invoiceUrl: varchar('invoiceUrl', { length: 255 }),
  customerId: varchar('customerId', { length: 36 }).notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  quotationId: varchar('quotationId', { length: 36 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const saleItems = mysqlTable('sale_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  saleId: varchar('saleId', { length: 36 }).notNull(),
  productId: varchar('productId', { length: 36 }).notNull(),
  description: text('description'),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unitPrice', { precision: 15, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxRate: decimal('taxRate', { precision: 5, scale: 2 }).notNull(),
  totalPrice: decimal('totalPrice', { precision: 15, scale: 2 }).notNull(),
});

const payments = mysqlTable('payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  paymentMethod: varchar('paymentMethod', { length: 255 }).notNull(),
  paymentDate: timestamp('paymentDate').defaultNow().notNull(),
  referenceNumber: varchar('referenceNumber', { length: 255 }),
  notes: varchar('notes', { length: 255 }),
  receiptUrl: varchar('receiptUrl', { length: 255 }),
  saleId: varchar('saleId', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ============================================
// BULK LEAD MESSAGING
// ============================================
const bulkMessageCampaigns = mysqlTable('bulk_message_campaigns', {
  id: varchar('id', { length: 36 }).primaryKey(),
  campaignName: varchar('campaignName', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 255 }).notNull(),
  messageTemplate: text('messageTemplate').notNull(),
  subject: varchar('subject', { length: 255 }),
  status: varchar('status', { length: 255 }).default('DRAFT').notNull(),
  totalLeads: int('totalLeads').default(0).notNull(),
  sentCount: int('sentCount').default(0).notNull(),
  failedCount: int('failedCount').default(0).notNull(),
  scheduledAt: timestamp('scheduledAt'),
  sentAt: timestamp('sentAt'),
  filterStatus: varchar('filterStatus', { length: 255 }),
  filterSource: varchar('filterSource', { length: 255 }),
  filterAssignee: varchar('filterAssignee', { length: 255 }),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

const bulkMessageLogs = mysqlTable('bulk_message_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  campaignId: varchar('campaignId', { length: 36 }).notNull(),
  leadId: varchar('leadId', { length: 36 }).notNull(),
  channel: varchar('channel', { length: 255 }).notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  status: varchar('status', { length: 255 }).notNull(),
  errorMsg: varchar('errorMsg', { length: 255 }),
  sentAt: timestamp('sentAt').defaultNow().notNull(),
});

// ============================================
// NOTES & COMMUNICATIONS
// ============================================
const notes = mysqlTable('notes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  content: text('content').notNull(),
  isVoiceNote: boolean('isVoiceNote').default(false).notNull(),
  voiceUrl: varchar('voiceUrl', { length: 255 }),
  leadId: varchar('leadId', { length: 36 }).notNull(),
  createdById: varchar('createdById', { length: 36 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

module.exports = {
  settings,
  vendors,
  purchaseOrders,
  purchaseOrderItems,
  notifications,
  users,
  activityLogs,
  leadTimeline,
  purchaseItems,
  products,
  tasks,
  taskChecklistItems,
  materials,
  salesTargets,
  userPermissionAuditLogs,
  materialRequests,
  materialRequestItems,
  customers,
  leads,
  leadProducts,
  followUps,
  dailyReports,
  quotations,
  quotationCounters,
  quotationReservations,
  quotationItems,
  sales,
  saleItems,
  payments,
  bulkMessageCampaigns,
  bulkMessageLogs,
  notes,
};
