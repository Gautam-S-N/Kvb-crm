/**
 * Converts a number to words in Indian Numbering System (Lakhs, Crores)
 * Supports decimals (Paisa)
 * @param {number} num 
 * @returns {string}
 */
const numberToWords = (num) => {
  if (num === 0) return 'Zero Rupees Only';
  if (isNaN(num)) return '';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };

  const mainPart = Math.floor(num);
  const paisaPart = Math.round((num - mainPart) * 100);

  let result = inWords(mainPart) + ' Rupees';
  if (paisaPart > 0) {
    result += ' and ' + inWords(paisaPart) + ' Paisa';
  }
  
  return result + ' Only';
};

module.exports = { numberToWords };
