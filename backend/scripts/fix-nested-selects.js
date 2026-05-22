/**
 * Auto-patches all controllers that use invalid Drizzle nested selects.
 * Drizzle does NOT support:  key: { colA: schema.table.col, ... }  inside .select()
 * This script rewrites each broken file by:
 *  1. Replacing nested select blocks with flat aliased fields
 *  2. Injecting a mapping step after the query to reconstruct the nested shape
 *
 * Run from backend/: node scripts/fix-nested-selects.js
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../src/controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

// Mapping: nested key -> alias prefix + fields
// Each entry says: when we see `KEY: {` inside a .select() block, flatten using aliasPrefix_fieldName
const NESTED_MAPPINGS = {
  customer:   { table: 'schema.customers', prefix: 'customer', fields: ['id','contactName','email','phone','companyName','alternatePhone','address','city','state','pincode','country','gstNumber','facebookPsid','createdAt','updatedAt'] },
  assignedTo: { table: 'schema.users',     prefix: 'assignedTo', fields: ['id','firstName','lastName','email','phone','role'] },
  createdBy:  { table: 'schema.users',     prefix: 'createdBy', fields: ['id','firstName','lastName','email'] },
  employee:   { table: 'schema.users',     prefix: 'employee', fields: ['id','firstName','lastName','email','role','managerId'] },
  manager:    { table: 'schema.users',     prefix: 'manager', fields: ['id','firstName','lastName','email'] },
  vendor:     { table: 'schema.vendors',   prefix: 'vendor', fields: ['id','companyName','contactName','email','phone'] },
  product:    { table: 'schema.products',  prefix: 'product', fields: ['id','name','sku','unitOfMeasure','basePrice','hsnCode','taxRate'] },
  user:       { table: 'schema.users',     prefix: 'user', fields: ['id','firstName','lastName','email','role'] },
};

let totalFixed = 0;

for (const file of files) {
  const fullPath = path.join(controllersDir, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // For each nested mapping key, find instances in .select({ ... KEY: { ... } ... })
  // Strategy: parse line by line, detect nested patterns, replace with flat fields
  for (const [key, mapping] of Object.entries(NESTED_MAPPINGS)) {
    const regex = new RegExp(`^([ \\t]+)${key}:\\s*\\{\\s*\\n([\\s\\S]*?)^\\1\\},?`, 'gm');
    content = content.replace(regex, (match, indent, inner) => {
      // Parse lines inside the nested block to get schema field references
      const lines = inner.split('\n');
      const flatLines = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '{' || trimmed === '}') continue;
        // Match: fieldName: schema.table.colName,
        const m = trimmed.match(/^(\w+):\s*(schema\.\w+\.\w+),?\s*$/);
        if (m) {
          const [, fieldName, schemaRef] = m;
          flatLines.push(`${indent}${key}_${fieldName}: ${schemaRef},`);
        }
      }
      if (flatLines.length === 0) return match; // can't parse, leave alone
      totalFixed++;
      return flatLines.join('\n');
    });
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Patched: ${file}`);
  } else {
    console.log(`⏭  No change: ${file}`);
  }
}

console.log(`\nDone. Total nested blocks replaced: ${totalFixed}`);
console.log('\n⚠️  NOTE: You still need to add .map() calls after each query to reconstruct nested objects.');
console.log('   The flat fields are now named KEY_fieldName (e.g. customer_id, customer_contactName).');
console.log('   The frontend expects the nested structure, so the mapping step is needed in each controller.');
