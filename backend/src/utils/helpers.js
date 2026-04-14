// Generate lead number (L-XXXXX format)
exports.generateLeadNumber = async (prisma) => {
  const count = await prisma.lead.count();
  return `L-${String(count + 1).padStart(5, '0')}`;
};