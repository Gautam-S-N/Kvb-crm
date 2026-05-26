const XLSX = require('xlsx');
const path = require('path');

const filePath = 'd:\\kvb-crm\\DC LIST 2026.xlsx';
console.log('Reading:', filePath);
const workbook = XLSX.readFile(filePath);

console.log('Sheets found:', workbook.SheetNames);

for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log(`Sheet "${name}" has rows: ${range.e.r + 1}, columns: ${range.e.c + 1}`);
  
  // Read first few rows
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('First 5 rows of data:');
  console.log(json.slice(0, 5));
  console.log('----------------------------------------------------');
}
