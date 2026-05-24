const fs = require('fs');
const path = require('path');

async function readBackup() {
  const filePath = path.resolve(__dirname, '../../kvb_crm_backup.sql');
  console.log('Reading backup file from:', filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf16le');
    console.log('File size:', content.length, 'characters');
    
    // Look for lines containing "users" or "INSERT INTO"
    const lines = content.split('\n');
    console.log('Total lines:', lines.length);
    
    const matchedLines = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('insert into') && line.toLowerCase().includes('users')) {
        matchedLines.push({ index: index + 1, content: line.trim() });
      }
    });
    
    console.log(`Found ${matchedLines.length} INSERT INTO lines for "users":`);
    matchedLines.forEach(match => {
      console.log(`Line ${match.index}:`, match.content.substring(0, 500) + '...');
    });
  } catch (err) {
    console.error('Error reading backup:', err.message);
  }
}

readBackup();
