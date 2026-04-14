const prisma = require('../utils/db');

// GET /api/bulk-messages
exports.getCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [campaigns, total] = await Promise.all([
      prisma.bulkMessageCampaign.findMany({
        where: req.user.role === 'EMPLOYEE' ? { createdById: req.user.id } : {},
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.bulkMessageCampaign.count({
        where: req.user.role === 'EMPLOYEE' ? { createdById: req.user.id } : {}
      })
    ]);

    res.json({
      success: true,
      data: campaigns,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bulk-messages/:id
exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await prisma.bulkMessageCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        logs: {
          include: { lead: { select: { title: true, customer: { select: { contactName: true } } } } }
        }
      }
    });

    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, data: campaign });
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

    // 1. Create the campaign draft/record
    const campaign = await prisma.bulkMessageCampaign.create({
      data: {
        campaignName,
        channel: channel || 'WHATSAPP',
        messageTemplate,
        subject,
        status: 'SENDING',
        totalLeads: leadIds.length,
        createdById: req.user.id
      }
    });

    // 2. Fetch the actual leads & their customers to parse templates
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      include: { customer: true }
    });

    let sent = 0;
    let failed = 0;
    const logs = [];

    // 3. Process each lead
    for (const lead of leads) {
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

      // Simulate sending. In reality, you would call WhatsApp Cloud API or Nodemailer here.
      if (status === 'SENT') sent++;
      else failed++;

      logs.push({
        campaignId: campaign.id,
        leadId: lead.id,
        channel: channel || 'WHATSAPP',
        recipient,
        status,
        errorMsg
      });

      // Also log as an activity in the lead timeline if successful
      if (status === 'SENT') {
        await prisma.leadTimeline.create({
          data: {
            leadId: lead.id,
            action: `Bulk ${channel} Sent`,
            description: `Sent via campaign: ${campaignName}`,
            performedBy: req.user.id
          }
        });
      }
    }

    // 4. Save bulk logs in a batch
    if (logs.length > 0) {
      await prisma.bulkMessageLog.createMany({ data: logs });
    }

    // 5. Update campaign status
    const finalStatus = failed === leads.length ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED';
    const updatedCampaign = await prisma.bulkMessageCampaign.update({
      where: { id: campaign.id },
      data: {
        status: finalStatus,
        sentCount: sent,
        failedCount: failed,
        sentAt: new Date()
      }
    });

    res.status(201).json({ success: true, data: updatedCampaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
