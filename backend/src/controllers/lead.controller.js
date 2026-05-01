const prisma = require('../utils/db');

const { getSubordinateIds } = require('../middleware/permission.middleware');

// Get all leads with filters
exports.getLeads = async (req, res) => {
  try {
    const { status, source, assignedTo, search, page = 1, limit = 20 } = req.query;
    
    const where = {};
    
    // Role-based filtering
    if (req.user.role === 'EMPLOYEE') {
      const validUserIds = await getSubordinateIds(req.user.id, true);
      validUserIds.push(req.user.id);
      
      where.assignedToId = { in: validUserIds };
    } else if (req.user.role === 'USER') {
      where.createdById = req.user.id;
    }
    
    // Apply filters
    if (status) where.status = status;
    if (source) where.source = source;
    if (assignedTo) where.assignedToId = assignedTo;
    
    // Search by name, email, or lead number
    if (search) {
      where.OR = [
        { leadNumber: { contains: search } },
        { title: { contains: search } },
        { customer: { contactName: { contains: search } } },
        { customer: { email: { contains: search } } },
        { customer: { phone: { contains: search } } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          customer: {
            select: { 
              id: true, 
              contactName: true, 
              email: true, 
              phone: true, 
              companyName: true 
            }
          },
          assignedTo: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true 
            }
          },
          createdBy: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true 
            }
          },
          _count: {
            select: { followUps: true, notes: true, quotations: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.lead.count({ where })
    ]);
    
    res.json({
      success: true,
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
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
    
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedTo: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            phone: true 
          }
        },
        createdBy: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true 
          }
        },
        products: {
          include: {
            product: {
              select: { 
                id: true, 
                name: true, 
                basePrice: true, 
                unitOfMeasure: true 
              }
            }
          }
        },
        followUps: {
          orderBy: { scheduledAt: 'desc' }
        },
        notes: {
          include: {
            createdBy: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true 
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        quotations: {
          include: { 
            items: {
              include: { product: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        timeline: {
          include: {
            user: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true 
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Check permissions — employees can only view leads assigned to them
    if (req.user.role === 'EMPLOYEE' && lead.assignedToId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({ success: true, data: lead });
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
    
    const where = {};
    if (phone) where.phone = phone;
    if (email) where.email = email;
    
    const existing = await prisma.customer.findFirst({
      where,
      include: {
        leads: {
          select: { 
            id: true, 
            status: true, 
            createdAt: true 
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (existing && existing.id !== excludeId) {
      return res.status(409).json({
        success: false,
        message: 'Customer already exists',
        data: existing
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
      title,
      description,
      status,
      source,
      estimateAmount,
      closeDate,
      // Customer info
      customerName,
      customerEmail,
      customerPhone,
      customerCompany,
      customerAddress,
      customerCity,
      customerState,
      customerPincode,
      // Products
      products,
      // Assignment
      assignedToId
    } = req.body;
    
    // Validate assignment permissions for employees
    let finalAssignedToId = assignedToId || req.user.id;
    if (req.user.role === 'EMPLOYEE' && finalAssignedToId !== req.user.id) {
      const validUserIds = await getSubordinateIds(req.user.id, true);
      validUserIds.push(req.user.id);
      
      if (!validUserIds.includes(finalAssignedToId)) {
        return res.status(403).json({ success: false, message: 'You can only assign leads to yourself or your subordinates.' });
      }
    }

    // Check for duplicate customer
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: customerPhone },
          { email: customerEmail }
        ]
      }
    });
    
    let customerId;
    let isDuplicate = false;
    
    if (existingCustomer) {
      // Use existing customer
      customerId = existingCustomer.id;
      isDuplicate = true;
    } else {
      // Create new customer
      const newCustomer = await prisma.customer.create({
        data: {
          contactName: customerName,
          email: customerEmail,
          phone: customerPhone,
          companyName: customerCompany,
          address: customerAddress,
          city: customerCity,
          state: customerState,
          pincode: customerPincode
        }
      });
      customerId = newCustomer.id;
    }
    
    // Generate lead number
    const leadCount = await prisma.lead.count();
    const leadNumber = `L-${String(leadCount + 1).padStart(5, '0')}`;
    
    // Create lead
    const lead = await prisma.lead.create({
      data: {
        leadNumber,
        title,
        description,
        status: status || 'NEW',
        source: source || 'OTHER',
        estimateAmount: estimateAmount ? parseFloat(estimateAmount) : null,
        closeDate: closeDate ? new Date(closeDate) : null,
        customerId,
        createdById: req.user.id,
        // Employees always own their leads; admins can assign to others
        assignedToId: req.user.role === 'ADMIN' ? (assignedToId || req.user.id) : finalAssignedToId,
        // Add products if provided
        products: products?.length ? {
          create: products.map(p => ({
            productId: p.productId,
            quantity: parseInt(p.quantity) || 1,
            notes: p.notes
          }))
        } : undefined
      },
      include: {
        customer: true,
        assignedTo: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true 
          }
        }
      }
    });
    
    // Create timeline entry
    await prisma.leadTimeline.create({
      data: {
        leadId: lead.id,
        action: 'Lead Created',
        description: isDuplicate ? 'Lead created for existing customer' : 'New lead and customer created',
        performedBy: req.user.id
      }
    });
    
    // Emit real-time notification if assigned to someone else
    const io = req.app.get('io');
    if (assignedToId && assignedToId !== req.user.id) {
      io.emit('notification', {
        type: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        body: `Lead ${lead.leadNumber} has been assigned to you`,
        entityType: 'lead',
        entityId: lead.id,
        targetUserId: assignedToId
      });
      
      // Persist notification
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: 'LEAD_ASSIGNED',
          title: 'New Lead Assigned',
          body: `Lead ${lead.leadNumber} has been assigned to you`,
          entityType: 'lead',
          entityId: lead.id
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: isDuplicate ? 'Lead created for existing customer' : 'Lead created successfully',
      data: lead,
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
    
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Check permissions
    if (req.user.role === 'EMPLOYEE' && lead.assignedToId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Track status change for timeline
    const oldStatus = lead.status;
    const newStatus = updateData.status;
    
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...updateData,
        estimateAmount: updateData.estimateAmount ? parseFloat(updateData.estimateAmount) : undefined,
        closeDate: updateData.closeDate ? new Date(updateData.closeDate) : undefined
      },
      include: {
        customer: true,
        assignedTo: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true 
          }
        }
      }
    });
    
    // Create timeline entry if status changed
    if (newStatus && newStatus !== oldStatus) {
      await prisma.leadTimeline.create({
        data: {
          leadId: id,
          action: 'Status Changed',
          oldValue: oldStatus,
          newValue: newStatus,
          performedBy: req.user.id
        }
      });
      
      // Emit notification
      const io = req.app.get('io');
      io.emit('notification', {
        type: 'LEAD_STATUS_CHANGED',
        title: 'Lead Status Updated',
        body: `Lead ${lead.leadNumber} status changed to ${newStatus}`,
        entityType: 'lead',
        entityId: id,
        targetUserId: lead.assignedToId
      });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete lead (Admin only)
exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.lead.delete({ where: { id } });
    
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign lead to employee
exports.assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;
    
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    // Validate assignment permissions for employees
    if (req.user.role === 'EMPLOYEE') {
      const validUserIds = await getSubordinateIds(req.user.id, true);
      validUserIds.push(req.user.id);
      
      if (!validUserIds.includes(assignedToId)) {
        return res.status(403).json({ success: false, message: 'You can only assign leads to yourself or your subordinates.' });
      }
    }
    
    const oldAssignee = lead.assignedToId;
    
    const updated = await prisma.lead.update({
      where: { id },
      data: { assignedToId },
      include: {
        assignedTo: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true 
          }
        },
        customer: true
      }
    });
    
    // Create timeline entry
    await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action: 'Lead Reassigned',
        description: `Assigned to ${updated.assignedTo.firstName} ${updated.assignedTo.lastName}`,
        performedBy: req.user.id
      }
    });
    
    // Notify new assignee
    const io = req.app.get('io');
    if (assignedToId !== oldAssignee) {
      io.emit('notification', {
        type: 'LEAD_ASSIGNED',
        title: 'Lead Assigned to You',
        body: `Lead ${lead.leadNumber} - ${updated.customer.contactName}`,
        entityType: 'lead',
        entityId: id,
        targetUserId: assignedToId
      });
      
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: 'LEAD_ASSIGNED',
          title: 'Lead Assigned to You',
          body: `Lead ${lead.leadNumber} - ${updated.customer.contactName}`,
          entityType: 'lead',
          entityId: id
        }
      });
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

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Insert Note
    const note = await prisma.note.create({
      data: {
        content,
        leadId: id,
        createdById: req.user.id
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });

    // Also inject directly into timeline so it updates the overall view
    await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action: 'Note Added',
        description: content.startsWith('/uploads') ? 'Recorded a voice message' : content.slice(0, 50),
        performedBy: req.user.id
      }
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

    const followUp = await prisma.followUp.create({
      data: {
        type,
        description,
        scheduledAt: new Date(scheduledAt),
        leadId: id,
        assignedToId: assignedToId || req.user.id
      }
    });

    await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action: 'Follow-up Scheduled',
        description: `${type}: ${description} (For ${new Date(scheduledAt).toLocaleDateString()})`,
        performedBy: req.user.id
      }
    });

    res.status(201).json({ success: true, data: followUp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Log Mock Interaction (WhatsApp/Email)
exports.logInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, message } = req.body;

    const timeline = await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action: `${channel} Sent`,
        description: message.substring(0, 200),
        performedBy: req.user.id
      }
    });

    res.status(201).json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Product to Lead
exports.addLeadProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, quantity, notes } = req.body;

    const leadProduct = await prisma.leadProduct.create({
      data: {
        leadId: id,
        productId,
        quantity: parseInt(quantity) || 1,
        notes
      },
      include: { product: true }
    });

    await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action: 'Product Added',
        description: `Added ${quantity}x ${leadProduct.product.name}`,
        performedBy: req.user.id
      }
    });

    res.status(201).json({ success: true, data: leadProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk Import Leads from CSV
exports.importLeads = async (req, res) => {
  try {
    const { rows } = req.body; // array of { title, phone, email, source, estimateAmount, description, companyName }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const { title, phone, email, source, estimateAmount, description, companyName } = row;
        if (!title || !phone) { skipped++; continue; }

        // Find or create customer
        let customer = await prisma.customer.findFirst({ where: { phone: String(phone) } });
        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              contactName: String(title),
              phone: String(phone),
              email: email ? String(email) : null,
              companyName: companyName ? String(companyName) : null,
            }
          });
        }

        const leadCount = await prisma.lead.count();
        const leadNumber = `L-${String(leadCount + 1).padStart(5, '0')}`;

        await prisma.lead.create({
          data: {
            leadNumber,
            title: String(title),
            description: description ? String(description) : null,
            status: 'NEW',
            source: source ? String(source).toUpperCase() : 'OTHER',
            estimateAmount: estimateAmount ? parseFloat(estimateAmount) : null,
            customerId: customer.id,
            createdById: req.user.id,
            assignedToId: req.user.id,
          }
        });
        imported++;
      } catch (e) {
        skipped++;
        errors.push(e.message);
      }
    }

    res.json({ success: true, imported, skipped, errors: errors.slice(0, 5) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove Product from Lead
exports.removeLeadProduct = async (req, res) => {
  try {
    const { id, productId } = req.params;
    await prisma.leadProduct.delete({ where: { id: productId } });
    await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action: 'Product Removed',
        description: 'Removed an interested product from this lead',
        performedBy: req.user.id
      }
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

    const timeline = await prisma.leadTimeline.create({
      data: {
        leadId: id,
        action,
        description,
        performedBy: req.user.id
      }
    });

    res.status(201).json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};