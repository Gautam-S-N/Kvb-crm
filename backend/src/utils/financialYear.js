/**
 * Financial Year Utility
 * FY runs April 1 → March 31.
 * Returns strings like '2025-26', '2024-25'.
 */

function getFinancialYear(date = new Date()) {
  const month = date.getMonth(); // 0 = Jan, 3 = April
  const year  = date.getFullYear();
  if (month >= 3) { // April onwards
    return `${year}-${String(year + 1).slice(2)}`;
  } else {
    return `${year - 1}-${String(year).slice(2)}`;
  }
}

module.exports = { getFinancialYear };
