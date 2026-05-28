const { eq, and, or, like, inArray, sql, desc, asc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { incrementAndGet, syncCounterToMax } = require('../services/counter.service');
const { getSubordinateIds } = require('../middleware/permission.middleware');
const { triggerRefreshForEmployee } = require('../services/achievement.service');
const { randomUUID } = require('crypto');
const { getFinancialYear } = require('../utils/financialYear');

// Get all leads with filters
exports.getLeads = async (req, res) => {
  try {
    const { status, source, assignedTo, search, page = 1, limit = 100 } = req.query;
    const fy = req.query.fy || getFinancialYear();
    
    const conditions = [eq(schema.leads.isArchived, false), eq(schema.leads.financialYear, fy)];
    
    // Role-based filtering
    if (req.user.role === 'EMPLOYEE') {
      const validUserIds = await getSubordinateIds(req.user.id, true);
      validUserIds.push(req.user.id);
      
      conditions.push(inArray(schema.leads.assignedToId, validUserIds));
    } else if (req.user.role === 'USER') {
      conditions.push(eq(schema.leads.createdById, req.user.id));
    }
    
    // Apply filters
    if (status) conditions.push(eq(schema.leads.status, status));
    if (source) conditions.push(eq(schema.leads.source, source));
    if (assignedTo) conditions.push(eq(schema.leads.assignedToId, assignedTo));
    
    // Search by name, email, or lead number
    if (search) {
      conditions.push(
        or(
          like(schema.leads.leadNumber, `%${search}%`),
          like(schema.leads.title, `%${search}%`),
          like(schema.customers.contactName, `%${search}%`),
          like(schema.customers.email, `%${search}%`),
          like(schema.customers.phone, `%${search}%`)
        )
      );
    }
    
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;
    
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schema.leads)
      .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(totalResult[0]?.count || 0);

    const leadsRows = await db.select({
      id: schema.leads.id,
      leadNumber: schema.leads.leadNumber,
      title: schema.leads.title,
      description: schema.leads.description,
      status: schema.leads.status,
      source: schema.leads.source,
      estimateAmount: schema.leads.estimateAmount,
      closeDate: schema.leads.closeDate,
      customerId: schema.leads.customerId,
      createdById: schema.leads.createdById,
      assignedToId: schema.leads.assignedToId,
      createdAt: schema.leads.createdAt,
      updatedAt: schema.leads.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      customerCompanyName: schema.customers.companyName,
      assignedToId_: schema.users.id,
      assignedToFirstName: schema.users.firstName,
      assignedToLastName: schema.users.lastName,
      assignedToEmail: schema.users.email
    })
    .from(schema.leads)
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.leads.assignedToId, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.leads.createdAt))
    .limit(parsedLimit)
    .offset(skip);

    const leadsRowsMapped = leadsRows.map(r => ({
      id: r.id, leadNumber: r.leadNumber, title: r.title, description: r.description,
      status: r.status, source: r.source, estimateAmount: r.estimateAmount,
      closeDate: r.closeDate, customerId: r.customerId, createdById: r.createdById,
      assignedToId: r.assignedToId, createdAt: r.createdAt, updatedAt: r.updatedAt,
      customer: r.customerId_ ? { id: r.customerId_, contactName: r.customerContactName, email: r.customerEmail, phone: r.customerPhone, companyName: r.customerCompanyName } : null,
      assignedTo: r.assignedToId_ ? { id: r.assignedToId_, firstName: r.assignedToFirstName, lastName: r.assignedToLastName, email: r.assignedToEmail } : null
    }));

    // Fetch creators for the leads
    let creatorsMap = {};
    if (leadsRowsMapped.length > 0) {
      const creatorIds = [...new Set(leadsRowsMapped.map(l => l.createdById))];
      const creators = await db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName
      })
      .from(schema.users)
      .where(inArray(schema.users.id, creatorIds));

      for (const u of creators) {
        creatorsMap[u.id] = u;
      }
    }

    // N+1 aggregate counts in memory
    let followUpMap = {};
    let notesMap = {};
    let quotationMap = {};

    if (leadsRowsMapped.length > 0) {
      const leadIds = leadsRowsMapped.map(l => l.id);

      const fCounts = await db.select({ leadId: schema.followUps.leadId, count: sql`count(*)` })
        .from(schema.followUps)
        .where(inArray(schema.followUps.leadId, leadIds))
        .groupBy(schema.followUps.leadId);
      for (const item of fCounts) {
        followUpMap[item.leadId] = Number(item.count);
      }

      const nCounts = await db.select({ leadId: schema.notes.leadId, count: sql`count(*)` })
        .from(schema.notes)
        .where(inArray(schema.notes.leadId, leadIds))
        .groupBy(schema.notes.leadId);
      for (const item of nCounts) {
        notesMap[item.leadId] = Number(item.count);
      }

      const qCounts = await db.select({ leadId: schema.quotations.leadId, count: sql`count(*)` })
        .from(schema.quotations)
        .where(inArray(schema.quotations.leadId, leadIds))
        .groupBy(schema.quotations.leadId);
      for (const item of qCounts) {
        quotationMap[item.leadId] = Number(item.count);
      }
    }

    const formattedLeads = leadsRowsMapped.map(l => ({
      ...l,
      createdBy: creatorsMap[l.createdById] || null,
      _count: {
        followUps: followUpMap[l.id] || 0,
        notes: notesMap[l.id] || 0,
        quotations: quotationMap[l.id] || 0
      }
    }));
    
    res.json({
      success: true,
      data: formattedLeads,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single lead with details
exports.getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const leadsRows = await db.select({
      id: schema.leads.id,
      leadNumber: schema.leads.leadNumber,
      title: schema.leads.title,
      description: schema.leads.description,
      status: schema.leads.status,
      source: schema.leads.source,
      estimateAmount: schema.leads.estimateAmount,
      closeDate: schema.leads.closeDate,
      customerId: schema.leads.customerId,
      createdById: schema.leads.createdById,
      assignedToId: schema.leads.assignedToId,
      createdAt: schema.leads.createdAt,
      updatedAt: schema.leads.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      customerCompanyName: schema.customers.companyName,
      customerAlternatePhone: schema.customers.alternatePhone,
      customerAddress: schema.customers.address,
      customerCity: schema.customers.city,
      customerState: schema.customers.state,
      customerPincode: schema.customers.pincode,
      customerCountry: schema.customers.country,
      customerGstNumber: schema.customers.gstNumber,
      customerFacebookPsid: schema.customers.facebookPsid,
      customerCreatedAt: schema.customers.createdAt,
      customerUpdatedAt: schema.customers.updatedAt,
      assignedToId_: schema.users.id,
      assignedToFirstName: schema.users.firstName,
      assignedToLastName: schema.users.lastName,
      assignedToEmail: schema.users.email,
      assignedToPhone: schema.users.phone
    })
    .from(schema.leads)
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.leads.assignedToId, schema.users.id))
    .where(
      and(
        eq(schema.leads.id, id),
        eq(schema.leads.isArchived, false)
      )
    )
    .limit(1);
    
    if (leadsRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    const rawLead = leadsRows[0];
    const lead = {
      id: rawLead.id, leadNumber: rawLead.leadNumber, title: rawLead.title,
      description: rawLead.description, status: rawLead.status, source: rawLead.source,
      estimateAmount: rawLead.estimateAmount, closeDate: rawLead.closeDate,
      customerId: rawLead.customerId, createdById: rawLead.createdById,
      assignedToId: rawLead.assignedToId, createdAt: rawLead.createdAt, updatedAt: rawLead.updatedAt,
      customer: rawLead.customerId_ ? {
        id: rawLead.customerId_, contactName: rawLead.customerContactName, email: rawLead.customerEmail,
        phone: rawLead.customerPhone, companyName: rawLead.customerCompanyName,
        alternatePhone: rawLead.customerAlternatePhone, address: rawLead.customerAddress,
        city: rawLead.customerCity, state: rawLead.customerState, pincode: rawLead.customerPincode,
        country: rawLead.customerCountry, gstNumber: rawLead.customerGstNumber,
        facebookPsid: rawLead.customerFacebookPsid, createdAt: rawLead.customerCreatedAt, updatedAt: rawLead.customerUpdatedAt
      } : null,
      assignedTo: rawLead.assignedToId_ ? {
        id: rawLead.assignedToId_, firstName: rawLead.assignedToFirstName,
        lastName: rawLead.assignedToLastName, email: rawLead.assignedToEmail, phone: rawLead.assignedToPhone
      } : null
    };
    
    // Check permissions — employees can only view leads assigned to them
    if (req.user.role === 'EMPLOYEE' && lead.assignedToId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const creatorList = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName
    })
    .from(schema.users)
    .where(eq(schema.users.id, lead.createdById))
    .limit(1);
    lead.createdBy = creatorList[0] || null;

    // Fetch products
    const leadProductsRaw = await db.select({
      id: schema.leadProducts.id,
      leadId: schema.leadProducts.leadId,
      productId: schema.leadProducts.productId,
      quantity: schema.leadProducts.quantity,
      notes: schema.leadProducts.notes,
      productId_: schema.products.id,
      productName: schema.products.name,
      productBasePrice: schema.products.basePrice,
      productUnitOfMeasure: schema.products.unitOfMeasure
    })
    .from(schema.leadProducts)
    .leftJoin(schema.products, eq(schema.leadProducts.productId, schema.products.id))
    .where(eq(schema.leadProducts.leadId, id));

    const leadProductsRows = leadProductsRaw.map(r => ({
      id: r.id, leadId: r.leadId, productId: r.productId, quantity: r.quantity, notes: r.notes,
      product: r.productId_ ? { id: r.productId_, name: r.productName, basePrice: r.productBasePrice, unitOfMeasure: r.productUnitOfMeasure } : null
    }));

    // Fetch follow-ups
    const followUpsRows = await db.select()
      .from(schema.followUps)
      .where(eq(schema.followUps.leadId, id))
      .orderBy(desc(schema.followUps.scheduledAt));

    // Fetch notes
    const notesRaw = await db.select({
      id: schema.notes.id,
      content: schema.notes.content,
      isVoiceNote: schema.notes.isVoiceNote,
      voiceUrl: schema.notes.voiceUrl,
      leadId: schema.notes.leadId,
      createdById: schema.notes.createdById,
      createdAt: schema.notes.createdAt,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.notes)
    .leftJoin(schema.users, eq(schema.notes.createdById, schema.users.id))
    .where(eq(schema.notes.leadId, id))
    .orderBy(desc(schema.notes.createdAt));

    const notesRows = notesRaw.map(r => ({
      id: r.id, content: r.content, isVoiceNote: r.isVoiceNote, voiceUrl: r.voiceUrl,
      leadId: r.leadId, createdById: r.createdById, createdAt: r.createdAt,
      createdBy: r.createdByFirstName ? { firstName: r.createdByFirstName, lastName: r.createdByLastName } : null
    }));

    // Fetch quotations & items
    const quotationsRows = await db.select()
      .from(schema.quotations)
      .where(eq(schema.quotations.leadId, id))
      .orderBy(desc(schema.quotations.createdAt));

    let quotationItemsMap = {};
    if (quotationsRows.length > 0) {
      const qIds = quotationsRows.map(q => q.id);
      const qItems = await db.select({
        id: schema.quotationItems.id,
        quotationId: schema.quotationItems.quotationId,
        productId: schema.quotationItems.productId,
        description: schema.quotationItems.description,
        quantity: schema.quotationItems.quantity,
        unitPrice: schema.quotationItems.unitPrice,
        discount: schema.quotationItems.discount,
        taxRate: schema.quotationItems.taxRate,
        totalPrice: schema.quotationItems.totalPrice,
        productId_: schema.products.id,
        productName: schema.products.name,
        productSku: schema.products.sku,
        productUnitOfMeasure: schema.products.unitOfMeasure,
        productBasePrice: schema.products.basePrice
      })
      .from(schema.quotationItems)
      .leftJoin(schema.products, eq(schema.quotationItems.productId, schema.products.id))
      .where(inArray(schema.quotationItems.quotationId, qIds));

      for (const item of qItems) {
        const mapped = {
          id: item.id, quotationId: item.quotationId, productId: item.productId,
          description: item.description, quantity: item.quantity, unitPrice: item.unitPrice,
          discount: item.discount, taxRate: item.taxRate, totalPrice: item.totalPrice,
          product: item.productId_ ? { id: item.productId_, name: item.productName, sku: item.productSku, unitOfMeasure: item.productUnitOfMeasure, basePrice: item.productBasePrice } : null
        };
        if (!quotationItemsMap[item.quotationId]) quotationItemsMap[item.quotationId] = [];
        quotationItemsMap[item.quotationId].push(mapped);
      }
    }

    const formattedQuotes = quotationsRows.map(q => ({
      ...q,
      items: quotationItemsMap[q.id] || []
    }));

    // Fetch timeline
    const timelineRaw = await db.select({
      id: schema.leadTimeline.id,
      leadId: schema.leadTimeline.leadId,
      action: schema.leadTimeline.action,
      description: schema.leadTimeline.description,
      oldValue: schema.leadTimeline.oldValue,
      newValue: schema.leadTimeline.newValue,
      performedBy: schema.leadTimeline.performedBy,
      createdAt: schema.leadTimeline.createdAt,
      userFirstName: schema.users.firstName,
      userLastName: schema.users.lastName
    })
    .from(schema.leadTimeline)
    .leftJoin(schema.users, eq(schema.leadTimeline.performedBy, schema.users.id))
    .where(eq(schema.leadTimeline.leadId, id))
    .orderBy(desc(schema.leadTimeline.createdAt))
    .limit(50);

    const timelineRows = timelineRaw.map(r => ({
      id: r.id, leadId: r.leadId, action: r.action, description: r.description,
      oldValue: r.oldValue, newValue: r.newValue, performedBy: r.performedBy, createdAt: r.createdAt,
      user: r.userFirstName ? { firstName: r.userFirstName, lastName: r.userLastName } : null
    }));

    const leadDetails = {
      ...lead,
      products: leadProductsRows,
      followUps: followUpsRows,
      notes: notesRows,
      quotations: formattedQuotes,
      timeline: timelineRows
    };
    
    res.json({ success: true, data: leadDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check for duplicate customer
exports.checkDuplicate = async (req, res) => {
  try {
    const { phone, email, excludeId } = req.query;
    
    if (!phone && !email) {
      return res.status(400).json({ success: false, message: 'Phone or email required' });
    }
    
    const conditions = [];
    if (phone) conditions.push(eq(schema.customers.phone, phone));
    if (email) conditions.push(eq(schema.customers.email, email));
    
    const existingList = await db.select()
      .from(schema.customers)
      .where(conditions.length > 0 ? or(...conditions) : undefined)
      .limit(1);
    
    const existing = existingList[0];

    if (existing && existing.id !== excludeId) {
      // Get the latest lead for this customer
      const latestLeads = await db.select({
        id: schema.leads.id,
        status: schema.leads.status,
        createdAt: schema.leads.createdAt
      })
      .from(schema.leads)
      .where(eq(schema.leads.customerId, existing.id))
      .orderBy(desc(schema.leads.createdAt))
      .limit(1);

      return res.status(409).json({
        success: false,
        message: 'Customer already exists',
        data: {
          ...existing,
          leads: latestLeads
        }
      });
    }
    
    res.json({ success: true, exists: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new lead
exports.createLead = async (req, res) => {
  try {
    const {
      title, description, status, source, estimateAmount, closeDate,
      customerName, customerEmail, customerPhone, customerCompany,
      customerAddress, customerCity, customerState, customerPincode,
      products, assignedToId
    } = req.body;
    
    let finalAssignedToId = assignedToId || req.user.id;
    if (req.user.role === 'EMPLOYEE' && finalAssignedToId !== req.user.id) {
      const validUserIds = await getSubordinateIds(req.user.id, true);
      validUserIds.push(req.user.id);
      
      if (!validUserIds.includes(finalAssignedToId)) {
        return res.status(403).json({ success: false, message: 'You can only assign leads to yourself or your subordinates.' });
      }
    }

    // Check for duplicate customer
    const conditions = [];
    if (customerPhone) conditions.push(eq(schema.customers.phone, customerPhone));
    if (customerEmail) conditions.push(eq(schema.customers.email, customerEmail));

    const existingCustList = await db.select()
      .from(schema.customers)
      .where(conditions.length > 0 ? or(...conditions) : undefined)
      .limit(1);

    const existingCustomer = existingCustList[0];
    
    let customerId;
    let isDuplicate = false;
    
    if (existingCustomer) {
      customerId = existingCustomer.id;
      isDuplicate = true;
    } else {
      customerId = randomUUID();
      await db.insert(schema.customers).values({
        id: customerId,
        contactName: customerName,
        email: customerEmail || null,
        phone: customerPhone,
        companyName: customerCompany || null,
        address: customerAddress || null,
        city: customerCity || null,
        state: customerState || null,
        pincode: customerPincode || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Generate lead number
    const countResult = await db.select({ count: sql`count(*)` }).from(schema.leads);
    const existingMax = Number(countResult[0]?.count || 0);
    await syncCounterToMax('LEAD', existingMax);
    const nextNum = await incrementAndGet('LEAD');
    const leadNumber = `L-${String(nextNum).padStart(5, '0')}`;
    
    const leadId = randomUUID();

    const leadData = {
      id: leadId,
      leadNumber,
      title,
      description: description || null,
      status: status || 'NEW',
      source: source || 'OTHER',
      estimateAmount: estimateAmount ? parseFloat(estimateAmount).toFixed(2) : null,
      closeDate: closeDate ? new Date(closeDate) : null,
      customerId,
      createdById: req.user.id,
      assignedToId: req.user.role === 'ADMIN' ? (assignedToId || req.user.id) : finalAssignedToId,
      isArchived: false,
      financialYear: getFinancialYear(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const finalLead = await db.transaction(async (tx) => {
      await tx.insert(schema.leads).values(leadData);

      if (products && products.length > 0) {
        const leadProds = products.map(p => ({
          id: randomUUID(),
          leadId: leadId,
          productId: p.productId,
          quantity: parseInt(p.quantity) || 1,
          notes: p.notes || null
        }));
        await tx.insert(schema.leadProducts).values(leadProds);
      }

      await tx.insert(schema.leadTimeline).values({
        id: randomUUID(),
        leadId: leadId,
        action: 'Lead Created',
        description: isDuplicate ? 'Lead created for existing customer' : 'New lead and customer created',
        performedBy: req.user.id,
        createdAt: new Date()
      });

      return leadData;
    });

    const customerObj = existingCustomer || await db.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1).then(r => r[0]);
    const assignedToUserObj = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email
    })
    .from(schema.users)
    .where(eq(schema.users.id, leadData.assignedToId))
    .limit(1)
    .then(r => r[0]);

    const leadResult = {
      ...finalLead,
      customer: customerObj,
      assignedTo: assignedToUserObj
    };
    
    // Emit notifications
    const io = req.app.get('io');
    if (assignedToId && assignedToId !== req.user.id) {
      if (io) {
        io.emit('notification', {
          type: 'LEAD_ASSIGNED',
          title: 'New Lead Assigned',
          body: `Lead ${leadResult.leadNumber} has been assigned to you`,
          entityType: 'lead',
          entityId: leadResult.id,
          targetUserId: assignedToId
        });
      }
      
      await db.insert(schema.notifications).values({
        id: randomUUID(),
        userId: assignedToId,
        type: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        body: `Lead ${leadResult.leadNumber} has been assigned to you`,
        entityType: 'lead',
        entityId: leadResult.id,
        isRead: false,
        createdAt: new Date()
      });
    }
    
    if (io) {
      io.emit('REFRESH_DATA', { module: 'LEADS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.status(201).json({
      success: true,
      message: isDuplicate ? 'Lead created for existing customer' : 'Lead created successfully',
      data: leadResult,
      isDuplicate
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update lead
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const leadList = await db.select().from(schema.leads).where(and(eq(schema.leads.id, id), eq(schema.leads.isArchived, false))).limit(1);
    const lead = leadList[0];
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Check permissions
    if (req.user.role === 'EMPLOYEE' && lead.assignedToId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const oldStatus = lead.status;
    const newStatus = updateData.status;
    
    // Closure snapshot logic
    const closingStatuses = ['WON', 'LOST'];
    const isClosing = newStatus && closingStatuses.includes(newStatus) && !closingStatuses.includes(oldStatus);
    let snapshotManagerId = null;
    if (isClosing && lead.assignedToId) {
      const assigneeList = await db.select({ managerId: schema.users.managerId })
        .from(schema.users)
        .where(eq(schema.users.id, lead.assignedToId))
        .limit(1);
      snapshotManagerId = assigneeList[0]?.managerId || null;
    }

    const updateFields = {
      updatedAt: new Date()
    };
    
    for (const key of Object.keys(updateData)) {
      if (updateData[key] !== undefined) {
        updateFields[key] = updateData[key];
      }
    }

    if (updateData.estimateAmount !== undefined) {
      updateFields.estimateAmount = updateData.estimateAmount ? parseFloat(updateData.estimateAmount).toFixed(2) : null;
    }
    if (updateData.closeDate !== undefined) {
      updateFields.closeDate = updateData.closeDate ? new Date(updateData.closeDate) : null;
    }
    if (isClosing) {
      updateFields.snapshotManagerId = snapshotManagerId;
    }

    await db.update(schema.leads)
      .set(updateFields)
      .where(eq(schema.leads.id, id));

    // Fetch updated lead details
    const updatedLeadList = await db.select({
      id: schema.leads.id,
      leadNumber: schema.leads.leadNumber,
      title: schema.leads.title,
      description: schema.leads.description,
      status: schema.leads.status,
      source: schema.leads.source,
      estimateAmount: schema.leads.estimateAmount,
      closeDate: schema.leads.closeDate,
      customerId: schema.leads.customerId,
      assignedToId: schema.leads.assignedToId,
      createdAt: schema.leads.createdAt,
      updatedAt: schema.leads.updatedAt,
      customerId_: schema.customers.id,
      customerContactName: schema.customers.contactName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      customerCompanyName: schema.customers.companyName,
      assignedToId_: schema.users.id,
      assignedToFirstName: schema.users.firstName,
      assignedToLastName: schema.users.lastName
    })
    .from(schema.leads)
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.leads.assignedToId, schema.users.id))
    .where(eq(schema.leads.id, id))
    .limit(1);

    const rawUpdated = updatedLeadList[0];
    const updated = rawUpdated ? {
      id: rawUpdated.id, leadNumber: rawUpdated.leadNumber, title: rawUpdated.title,
      description: rawUpdated.description, status: rawUpdated.status, source: rawUpdated.source,
      estimateAmount: rawUpdated.estimateAmount, closeDate: rawUpdated.closeDate,
      customerId: rawUpdated.customerId, assignedToId: rawUpdated.assignedToId,
      createdAt: rawUpdated.createdAt, updatedAt: rawUpdated.updatedAt,
      customer: rawUpdated.customerId_ ? { id: rawUpdated.customerId_, contactName: rawUpdated.customerContactName, email: rawUpdated.customerEmail, phone: rawUpdated.customerPhone, companyName: rawUpdated.customerCompanyName } : null,
      assignedTo: rawUpdated.assignedToId_ ? { id: rawUpdated.assignedToId_, firstName: rawUpdated.assignedToFirstName, lastName: rawUpdated.assignedToLastName } : null
    } : null;

    // Status changed timeline note
    if (newStatus && newStatus !== oldStatus) {
      await db.insert(schema.leadTimeline).values({
        id: randomUUID(),
        leadId: id,
        action: 'Status Changed',
        oldValue: oldStatus,
        newValue: newStatus,
        performedBy: req.user.id,
        createdAt: new Date()
      });
      
      const io = req.app.get('io');
      if (io) {
        io.emit('notification', {
          type: 'LEAD_STATUS_CHANGED',
          title: 'Lead Status Updated',
          body: `Lead ${lead.leadNumber} status changed to ${newStatus}`,
          entityType: 'lead',
          entityId: id,
          targetUserId: lead.assignedToId
        });
      }
    }
    
    const ioRefresh = req.app.get('io');
    if (ioRefresh) {
      ioRefresh.emit('REFRESH_DATA', { module: 'LEADS' });
      ioRefresh.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    if (newStatus === 'WON' && newStatus !== oldStatus) {
      triggerRefreshForEmployee(updated.assignedToId, ioRefresh);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Archive lead — soft delete (Admin only)
exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const leadList = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
    if (leadList.length === 0) return res.status(404).json({ success: false, message: 'Lead not found' });

    await db.update(schema.leads)
      .set({
        isArchived: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.leads.id, id));

    res.json({ success: true, message: 'Lead archived successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign lead to employee
exports.assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;
    
    const leadList = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
    const lead = leadList[0];
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Validate assignment permissions
    if (req.user.role === 'EMPLOYEE') {
      const validUserIds = await getSubordinateIds(req.user.id, true);
      validUserIds.push(req.user.id);
      
      if (!validUserIds.includes(assignedToId)) {
        return res.status(403).json({ success: false, message: 'You can only assign leads to yourself or your subordinates.' });
      }
    }
    
    const oldAssignee = lead.assignedToId;
    
    await db.update(schema.leads)
      .set({
        assignedToId,
        updatedAt: new Date()
      })
      .where(eq(schema.leads.id, id));

    const updatedLeadList = await db.select({
      id: schema.leads.id,
      leadNumber: schema.leads.leadNumber,
      assignedToId_: schema.users.id,
      assignedToFirstName: schema.users.firstName,
      assignedToLastName: schema.users.lastName,
      assignedToEmail: schema.users.email,
      customerContactName: schema.customers.contactName
    })
    .from(schema.leads)
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.leads.assignedToId, schema.users.id))
    .where(eq(schema.leads.id, id))
    .limit(1);

    const rawU = updatedLeadList[0];
    const updated = rawU ? {
      id: rawU.id, leadNumber: rawU.leadNumber,
      assignedTo: rawU.assignedToId_ ? { id: rawU.assignedToId_, firstName: rawU.assignedToFirstName, lastName: rawU.assignedToLastName, email: rawU.assignedToEmail } : null,
      customer: { contactName: rawU.customerContactName }
    } : null;
    
    // Timeline update
    await db.insert(schema.leadTimeline).values({
      id: randomUUID(),
      leadId: id,
      action: 'Lead Reassigned',
      description: `Assigned to ${updated.assignedTo.firstName} ${updated.assignedTo.lastName}`,
      performedBy: req.user.id,
      createdAt: new Date()
    });
    
    // Notify assignee
    const io = req.app.get('io');
    if (assignedToId !== oldAssignee) {
      if (io) {
        io.emit('notification', {
          type: 'LEAD_ASSIGNED',
          title: 'Lead Assigned to You',
          body: `Lead ${lead.leadNumber} - ${updated.customer.contactName}`,
          entityType: 'lead',
          entityId: id,
          targetUserId: assignedToId
        });
      }
      
      await db.insert(schema.notifications).values({
        id: randomUUID(),
        userId: assignedToId,
        type: 'LEAD_ASSIGNED',
        title: 'Lead Assigned to You',
        body: `Lead ${lead.leadNumber} - ${updated.customer.contactName}`,
        entityType: 'lead',
        entityId: id,
        isRead: false,
        createdAt: new Date()
      });
    }
    
    if (io) {
      io.emit('REFRESH_DATA', { module: 'LEADS' });
      io.emit('REFRESH_DATA', { module: 'DASHBOARD' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a note or voice message to a lead
exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const leadList = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
    if (leadList.length === 0) return res.status(404).json({ success: false, message: 'Lead not found' });

    const noteId = randomUUID();
    const isVoice = content.startsWith('/uploads');
    
    await db.insert(schema.notes).values({
      id: noteId,
      content,
      isVoiceNote: isVoice,
      voiceUrl: isVoice ? content : null,
      leadId: id,
      createdById: req.user.id,
      createdAt: new Date()
    });

    const noteRaw = await db.select({
      id: schema.notes.id,
      content: schema.notes.content,
      isVoiceNote: schema.notes.isVoiceNote,
      voiceUrl: schema.notes.voiceUrl,
      leadId: schema.notes.leadId,
      createdById: schema.notes.createdById,
      createdAt: schema.notes.createdAt,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.notes)
    .leftJoin(schema.users, eq(schema.notes.createdById, schema.users.id))
    .where(eq(schema.notes.id, noteId))
    .limit(1)
    .then(r => r[0]);

    const note = noteRaw ? {
      id: noteRaw.id, content: noteRaw.content, isVoiceNote: noteRaw.isVoiceNote,
      voiceUrl: noteRaw.voiceUrl, leadId: noteRaw.leadId, createdById: noteRaw.createdById,
      createdAt: noteRaw.createdAt,
      createdBy: noteRaw.createdByFirstName ? { firstName: noteRaw.createdByFirstName, lastName: noteRaw.createdByLastName } : null
    } : null;

    // Update timeline
    await db.insert(schema.leadTimeline).values({
      id: randomUUID(),
      leadId: id,
      action: 'Note Added',
      description: isVoice ? 'Recorded a voice message' : content.slice(0, 50),
      performedBy: req.user.id,
      createdAt: new Date()
    });

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Follow-up
exports.addFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, scheduledAt, assignedToId } = req.body;

    const followUpId = randomUUID();
    const followUpData = {
      id: followUpId,
      type,
      description,
      scheduledAt: new Date(scheduledAt),
      leadId: id,
      assignedToId: assignedToId || req.user.id,
      status: 'SCHEDULED',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.followUps).values(followUpData);

    await db.insert(schema.leadTimeline).values({
      id: randomUUID(),
      leadId: id,
      action: 'Follow-up Scheduled',
      description: `${type}: ${description} (For ${new Date(scheduledAt).toLocaleDateString()})`,
      performedBy: req.user.id,
      createdAt: new Date()
    });

    res.status(201).json({ success: true, data: followUpData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Log Mock Interaction (WhatsApp/Email)
exports.logInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, message } = req.body;

    const timelineId = randomUUID();
    const timelineData = {
      id: timelineId,
      leadId: id,
      action: `${channel} Sent`,
      description: message.substring(0, 200),
      performedBy: req.user.id,
      createdAt: new Date()
    };

    await db.insert(schema.leadTimeline).values(timelineData);

    res.status(201).json({ success: true, data: timelineData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Product to Lead
exports.addLeadProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, quantity, notes } = req.body;

    const leadProductId = randomUUID();
    await db.insert(schema.leadProducts).values({
      id: leadProductId,
      leadId: id,
      productId,
      quantity: parseInt(quantity) || 1,
      notes: notes || null
    });

    const leadProductRaw = await db.select({
      id: schema.leadProducts.id,
      leadId: schema.leadProducts.leadId,
      productId: schema.leadProducts.productId,
      quantity: schema.leadProducts.quantity,
      notes: schema.leadProducts.notes,
      productId_: schema.products.id,
      productName: schema.products.name
    })
    .from(schema.leadProducts)
    .leftJoin(schema.products, eq(schema.leadProducts.productId, schema.products.id))
    .where(eq(schema.leadProducts.id, leadProductId))
    .limit(1)
    .then(r => r[0]);

    const leadProduct = leadProductRaw ? {
      id: leadProductRaw.id, leadId: leadProductRaw.leadId, productId: leadProductRaw.productId,
      quantity: leadProductRaw.quantity, notes: leadProductRaw.notes,
      product: leadProductRaw.productId_ ? { id: leadProductRaw.productId_, name: leadProductRaw.productName } : null
    } : null;

    await db.insert(schema.leadTimeline).values({
      id: randomUUID(),
      leadId: id,
      action: 'Product Added',
      description: `Added ${quantity}x ${leadProduct.product.name}`,
      performedBy: req.user.id,
      createdAt: new Date()
    });

    res.status(201).json({ success: true, data: leadProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk Import Leads from CSV
exports.importLeads = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided' });
    }

    const BATCH_SIZE = 50;
    let imported = 0;
    let skipped = 0;
    const failedRows = [];
    const duplicateRows = [];

    const totalRes = await db.select({ count: sql`count(*)` }).from(schema.leads);
    const existingMax = Number(totalRes[0]?.count || 0);
    await syncCounterToMax('LEAD', existingMax);

    // Process in batches
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

      try {
        await db.transaction(async (tx) => {
          for (let i = 0; i < batch.length; i++) {
            const rowIndex = batchStart + i + 1;
            const row = batch[i];
            const { title, phone, email, source, estimateAmount, description, companyName } = row;

            if (!title || !phone) {
              skipped++;
              failedRows.push({ row: rowIndex, reason: 'Missing required fields: title or phone' });
              continue;
            }

            // Duplicate customer check
            const customerConditions = [eq(schema.customers.phone, String(phone))];
            if (email) customerConditions.push(eq(schema.customers.email, String(email)));

            const existingList = await tx.select()
              .from(schema.customers)
              .where(or(...customerConditions))
              .limit(1);

            const existingCustomer = existingList[0];

            let customerId;
            if (existingCustomer) {
              customerId = existingCustomer.id;
              duplicateRows.push({ row: rowIndex, phone, email, message: 'Linked to existing customer' });
            } else {
              customerId = randomUUID();
              await tx.insert(schema.customers).values({
                id: customerId,
                contactName: String(title),
                phone: String(phone),
                email: email ? String(email) : null,
                companyName: companyName ? String(companyName) : null,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }

            const nextNum = await incrementAndGet('LEAD');
            const leadNumber = `L-${String(nextNum).padStart(5, '0')}`;

            const leadId = randomUUID();
            await tx.insert(schema.leads).values({
              id: leadId,
              leadNumber,
              title: String(title),
              description: description ? String(description) : null,
              status: 'NEW',
              source: source ? String(source).toUpperCase() : 'OTHER',
              estimateAmount: estimateAmount ? parseFloat(estimateAmount).toFixed(2) : null,
              customerId,
              createdById: req.user.id,
              assignedToId: req.user.id,
              isArchived: false,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            imported++;
          }
        });
      } catch (batchError) {
        for (let i = 0; i < batch.length; i++) {
          const rowIndex = batchStart + i + 1;
          failedRows.push({ row: rowIndex, reason: batchError.message });
          skipped++;
        }
      }
    }

    res.json({
      success: true,
      imported,
      skipped,
      duplicatesLinked: duplicateRows.length,
      failedRows: failedRows.slice(0, 20),
      duplicateRows: duplicateRows.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove Product from Lead
exports.removeLeadProduct = async (req, res) => {
  try {
    const { id, productId } = req.params;
    
    await db.delete(schema.leadProducts).where(eq(schema.leadProducts.id, productId));
    
    await db.insert(schema.leadTimeline).values({
      id: randomUUID(),
      leadId: id,
      action: 'Product Removed',
      description: 'Removed an interested product from this lead',
      performedBy: req.user.id,
      createdAt: new Date()
    });

    res.json({ success: true, message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add direct timeline event
exports.addTimelineEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, description } = req.body;

    const timelineId = randomUUID();
    const timelineData = {
      id: timelineId,
      leadId: id,
      action,
      description: description || null,
      performedBy: req.user.id,
      createdAt: new Date()
    };

    await db.insert(schema.leadTimeline).values(timelineData);

    res.status(201).json({ success: true, data: timelineData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};