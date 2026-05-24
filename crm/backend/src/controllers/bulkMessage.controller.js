const { eq, and, inArray, sql, desc } = require('drizzle-orm');
const { db } = require('../utils/drizzle');
const schema = require('../models/schema');
const { randomUUID } = require('crypto');

// GET /api/bulk-messages
exports.getCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const conditions = [];
    if (req.user.role === 'EMPLOYEE') {
      conditions.push(eq(schema.bulkMessageCampaigns.createdById, req.user.id));
    }

    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schema.bulkMessageCampaigns)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(totalResult[0]?.count || 0);

    const campaignsRaw = await db.select({
      id: schema.bulkMessageCampaigns.id,
      campaignName: schema.bulkMessageCampaigns.campaignName,
      channel: schema.bulkMessageCampaigns.channel,
      messageTemplate: schema.bulkMessageCampaigns.messageTemplate,
      subject: schema.bulkMessageCampaigns.subject,
      status: schema.bulkMessageCampaigns.status,
      totalLeads: schema.bulkMessageCampaigns.totalLeads,
      sentCount: schema.bulkMessageCampaigns.sentCount,
      failedCount: schema.bulkMessageCampaigns.failedCount,
      scheduledAt: schema.bulkMessageCampaigns.scheduledAt,
      sentAt: schema.bulkMessageCampaigns.sentAt,
      createdAt: schema.bulkMessageCampaigns.createdAt,
      updatedAt: schema.bulkMessageCampaigns.updatedAt,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.bulkMessageCampaigns)
    .leftJoin(schema.users, eq(schema.bulkMessageCampaigns.createdById, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.bulkMessageCampaigns.createdAt))
    .limit(parsedLimit)
    .offset(skip);

    const campaigns = campaignsRaw.map(c => ({
      id: c.id,
      campaignName: c.campaignName,
      channel: c.channel,
      messageTemplate: c.messageTemplate,
      subject: c.subject,
      status: c.status,
      totalLeads: c.totalLeads,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      scheduledAt: c.scheduledAt,
      sentAt: c.sentAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      createdBy: c.createdById_ ? {
        id: c.createdById_,
        firstName: c.createdByFirstName,
        lastName: c.createdByLastName
      } : null
    }));

    res.json({
      success: true,
      data: campaigns,
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

// GET /api/bulk-messages/:id
exports.getCampaignById = async (req, res) => {
  try {
    const campaignsRaw = await db.select({
      id: schema.bulkMessageCampaigns.id,
      campaignName: schema.bulkMessageCampaigns.campaignName,
      channel: schema.bulkMessageCampaigns.channel,
      messageTemplate: schema.bulkMessageCampaigns.messageTemplate,
      subject: schema.bulkMessageCampaigns.subject,
      status: schema.bulkMessageCampaigns.status,
      totalLeads: schema.bulkMessageCampaigns.totalLeads,
      sentCount: schema.bulkMessageCampaigns.sentCount,
      failedCount: schema.bulkMessageCampaigns.failedCount,
      scheduledAt: schema.bulkMessageCampaigns.scheduledAt,
      sentAt: schema.bulkMessageCampaigns.sentAt,
      createdAt: schema.bulkMessageCampaigns.createdAt,
      updatedAt: schema.bulkMessageCampaigns.updatedAt,
      createdById_: schema.users.id,
      createdByFirstName: schema.users.firstName,
      createdByLastName: schema.users.lastName
    })
    .from(schema.bulkMessageCampaigns)
    .leftJoin(schema.users, eq(schema.bulkMessageCampaigns.createdById, schema.users.id))
    .where(eq(schema.bulkMessageCampaigns.id, req.params.id))
    .limit(1);

    if (campaignsRaw.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const rawCampaign = campaignsRaw[0];
    const campaign = {
      id: rawCampaign.id,
      campaignName: rawCampaign.campaignName,
      channel: rawCampaign.channel,
      messageTemplate: rawCampaign.messageTemplate,
      subject: rawCampaign.subject,
      status: rawCampaign.status,
      totalLeads: rawCampaign.totalLeads,
      sentCount: rawCampaign.sentCount,
      failedCount: rawCampaign.failedCount,
      scheduledAt: rawCampaign.scheduledAt,
      sentAt: rawCampaign.sentAt,
      createdAt: rawCampaign.createdAt,
      updatedAt: rawCampaign.updatedAt,
      createdBy: rawCampaign.createdById_ ? {
        id: rawCampaign.createdById_,
        firstName: rawCampaign.createdByFirstName,
        lastName: rawCampaign.createdByLastName
      } : null
    };

    // Fetch the logs for this campaign, including nested lead and customer information
    const logsRaw = await db.select({
      id: schema.bulkMessageLogs.id,
      campaignId: schema.bulkMessageLogs.campaignId,
      leadId: schema.bulkMessageLogs.leadId,
      channel: schema.bulkMessageLogs.channel,
      recipient: schema.bulkMessageLogs.recipient,
      status: schema.bulkMessageLogs.status,
      errorMsg: schema.bulkMessageLogs.errorMsg,
      sentAt: schema.bulkMessageLogs.sentAt,
      leadTitle: schema.leads.title,
      customerContactName: schema.customers.contactName
    })
    .from(schema.bulkMessageLogs)
    .leftJoin(schema.leads, eq(schema.bulkMessageLogs.leadId, schema.leads.id))
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .where(eq(schema.bulkMessageLogs.campaignId, req.params.id));

    const logs = logsRaw.map(l => ({
      id: l.id,
      campaignId: l.campaignId,
      leadId: l.leadId,
      channel: l.channel,
      recipient: l.recipient,
      status: l.status,
      errorMsg: l.errorMsg,
      sentAt: l.sentAt,
      lead: l.leadTitle ? {
        title: l.leadTitle,
        customer: l.customerContactName ? {
          contactName: l.customerContactName
        } : null
      } : null
    }));

    res.json({
      success: true,
      data: {
        ...campaign,
        logs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/bulk-messages
exports.createCampaign = async (req, res) => {
  try {
    const { campaignName, channel, messageTemplate, subject, leadIds } = req.body;

    if (!leadIds || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No leads selected' });
    }

    const campaignId = randomUUID();

    // 1. Create the campaign draft/record
    const campaignData = {
      id: campaignId,
      campaignName,
      channel: channel || 'WHATSAPP',
      messageTemplate,
      subject: subject || null,
      status: 'SENDING',
      totalLeads: leadIds.length,
      createdById: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(schema.bulkMessageCampaigns).values(campaignData);

    // 2. Fetch the actual leads & their customers to parse templates
    const leadsRaw = await db.select({
      id: schema.leads.id,
      title: schema.leads.title,
      customerPhone: schema.customers.phone,
      customerEmail: schema.customers.email
    })
    .from(schema.leads)
    .leftJoin(schema.customers, eq(schema.leads.customerId, schema.customers.id))
    .where(inArray(schema.leads.id, leadIds));

    const leadsRows = leadsRaw.map(l => ({
      id: l.id,
      title: l.title,
      customer: l.customerPhone || l.customerEmail ? {
        phone: l.customerPhone,
        email: l.customerEmail
      } : null
    }));

    let sent = 0;
    let failed = 0;
    const logs = [];
    const timelineInserts = [];

    // 3. Process each lead
    for (const lead of leadsRows) {
      let status = 'SENT';
      let errorMsg = null;
      let recipient = '';

      if (channel === 'WHATSAPP') {
        recipient = lead.customer?.phone || '';
        if (!recipient) { status = 'FAILED'; errorMsg = 'No phone number'; }
      } else if (channel === 'EMAIL') {
        recipient = lead.customer?.email || '';
        if (!recipient) { status = 'FAILED'; errorMsg = 'No email address'; }
      }

      if (status === 'SENT') sent++;
      else failed++;

      logs.push({
        id: randomUUID(),
        campaignId: campaignId,
        leadId: lead.id,
        channel: channel || 'WHATSAPP',
        recipient,
        status,
        errorMsg: errorMsg || null,
        sentAt: new Date()
      });

      // Log as timeline action
      if (status === 'SENT') {
        timelineInserts.push({
          id: randomUUID(),
          leadId: lead.id,
          action: `Bulk ${channel} Sent`,
          description: `Sent via campaign: ${campaignName}`,
          performedBy: req.user.id,
          createdAt: new Date()
        });
      }
    }

    // 4. Batch inserts for timeline and logs
    if (timelineInserts.length > 0) {
      await db.insert(schema.leadTimeline).values(timelineInserts);
    }
    if (logs.length > 0) {
      await db.insert(schema.bulkMessageLogs).values(logs);
    }

    // 5. Update campaign status
    const finalStatus = failed === leadsRows.length ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED';
    const finalCampaignData = {
      status: finalStatus,
      sentCount: sent,
      failedCount: failed,
      sentAt: new Date(),
      updatedAt: new Date()
    };

    await db.update(schema.bulkMessageCampaigns)
      .set(finalCampaignData)
      .where(eq(schema.bulkMessageCampaigns.id, campaignId));

    res.status(201).json({
      success: true,
      data: {
        ...campaignData,
        ...finalCampaignData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
