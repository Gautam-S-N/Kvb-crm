require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  // 1. Login
  const login = await request({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@kvbgreenenergies.com', password: 'Admin@123' });

  if (!login.body.success) { console.error('Login failed:', login.body.message); process.exit(1); }
  const token = login.body.data.token;
  console.log('✅ Login OK');

  // 2. Get a lead to use
  const leads = await request({
    hostname: 'localhost', port: 5000, path: '/api/leads?limit=1', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!leads.body.success || !leads.body.data?.length) {
    console.error('No leads found to test with'); process.exit(1);
  }
  const leadId = leads.body.data[0].id;
  console.log('✅ Got lead:', leadId);

  // 3. Create quotation - SOLAR_PARABOLIC_TROUGH uses customFields for pricing, items can be empty
  const qtn = await request({
    hostname: 'localhost', port: 5000, path: '/api/quotations', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, {
    leadId,
    templateType: 'SOLAR_PARABOLIC_TROUGH',
    paymentTerms: '70% Advance along with PO',
    deliveryTerms: '12-14 Weeks',
    items: [],
    customFields: {
      toName: 'Test Customer',
      qtnDate: '22/05/2026',
      subjectLine: '700 kg/hr Solar Parabolic Trough Steam Generation',
      unitPrice: 500000,
      qty: 1,
      totalAmt: 500000,
      gstRate: 18
    }
  });

  console.log('Quotation creation STATUS:', qtn.status);
  if (qtn.body.success) {
    console.log('✅ Quotation created! Number:', qtn.body.data.quotationNumber, '| Total:', qtn.body.data.totalAmount);
  } else {
    console.error('❌ Quotation failed:', qtn.body.message);
  }
  process.exit(0);
}

run().catch(e => { console.error('Test error:', e.message); process.exit(1); });
