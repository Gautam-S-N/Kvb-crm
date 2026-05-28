import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useSaleStore } from '../stores/saleStore';
import { useProductStore } from '../stores/productStore';
import api from '../services/api';
import {
  Plus, Trash2, ArrowLeft, Save, Search, Info, Tag, Loader2, FileText
} from 'lucide-react';

const DEFAULT_TAX = 18;

const EMPTY_ITEM = () => ({
  productId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  discount: '',
  taxRate: String(DEFAULT_TAX),
  hsnCode: '',
  uom: '',
  _basePrice: null,
});

export default function CreateSale() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get('quotationId');

  const { createSale, isLoading } = useSaleStore();
  const { products, fetchProducts } = useProductStore();

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDD, setShowCustomerDD] = useState(false);

  // Items
  const [items, setItems] = useState([EMPTY_ITEM()]);

  // Invoice metadata
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxType, setTaxType] = useState('CGST_SGST'); // or 'IGST'
  // Editable tax rate overrides (leave blank = use per-item weighted average)
  const [cgstRateOverride, setCgstRateOverride] = useState('');
  const [sgstRateOverride, setSgstRateOverride] = useState('');
  const [igstRateOverride, setIgstRateOverride] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [dispatchDocNo, setDispatchDocNo] = useState('');
  const [dispatchedThrough, setDispatchedThrough] = useState('');
  const [destination, setDestination] = useState('');
  const [buyersOrderNo, setBuyersOrderNo] = useState('');
  const [termsOfDelivery, setTermsOfDelivery] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [existingSaleId, setExistingSaleId] = useState(null);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  const [quotationRef, setQuotationRef] = useState(null); // stores quotation number for display

  useEffect(() => { fetchProducts(); }, []);

  // Load quotation data if quotationId is present
  useEffect(() => {
    if (!quotationId) return;
    const loadQuotation = async () => {
      setLoadingQuotation(true);
      try {
        const res = await api.get(`/quotations/${quotationId}`);
        const q = res.data.data || res.data;
        setQuotationRef(q.quotationNumber);

        // Pre-populate customer
        if (q.customer) {
          setSelectedCustomer(q.customer);
        }

        // Pre-populate items from quotation
        if (q.items && q.items.length > 0) {
          setItems(q.items.map(qi => ({
            productId: qi.productId || '',
            description: qi.description || '',
            quantity: String(qi.quantity || 1),
            unitPrice: String(qi.unitPrice || ''),
            discount: String(qi.discount || ''),
            taxRate: String(qi.taxRate || DEFAULT_TAX),
            hsnCode: qi.product?.hsnCode || '',
            uom: qi.product?.unitOfMeasure || '',
            _basePrice: Number(qi.unitPrice || 0),
          })));
        }

        // Pre-populate other fields
        if (q.notes) setNotes(q.notes);
        if (q.paymentTerms) setPaymentTerms(q.paymentTerms);
      } catch (err) {
        console.error('Failed to load quotation:', err);
      }
      setLoadingQuotation(false);
    };
    loadQuotation();
  }, [quotationId]);

  // Customer search debounce
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) { setCustomers([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/leads?search=${customerSearch}&limit=30`);
        const seen = new Set();
        const unique = [];
        for (const lead of res.data.data) {
          const c = lead.customer;
          if (!seen.has(c.id)) { seen.add(c.id); unique.push(c); }
        }
        setCustomers(unique);
        setShowCustomerDD(true);
      } catch { setCustomers([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };

      if (field === 'productId' && value) {
        const prod = products.find(p => p.id === value);
        if (prod) {
          next[idx].unitPrice   = String(prod.basePrice);
          next[idx].taxRate     = String(prod.taxRate || DEFAULT_TAX);
          next[idx].description = prod.description || '';
          next[idx].hsnCode     = prod.hsnCode || '';
          next[idx].uom         = prod.unitOfMeasure || '';
          next[idx]._basePrice  = Number(prod.basePrice);
        }
      }
      if (field === 'productId' && !value) {
        next[idx]._basePrice = null;
        next[idx].hsnCode = '';
        next[idx].uom = '';
      }
      return next;
    });
  };

  const num = (v) => parseFloat(v) || 0;

  const lineTotal = (item) =>
    num(item.quantity) * num(item.unitPrice) * (1 - num(item.discount) / 100);

  const subTotal    = items.reduce((s, i) => s + lineTotal(i), 0);
  const discAmt     = num(discountAmount);
  const taxableAmt  = subTotal - discAmt;

  // Per-item weighted average GST rate (used when no manual override)
  const weightedTaxRate = subTotal > 0
    ? items.reduce((s, i) => s + (lineTotal(i) / subTotal) * num(i.taxRate), 0)
    : DEFAULT_TAX;

  // Effective rates — use manual override if provided, otherwise use weighted average
  const effectiveCgst = cgstRateOverride !== '' ? num(cgstRateOverride) : weightedTaxRate / 2;
  const effectiveSgst = sgstRateOverride !== '' ? num(sgstRateOverride) : weightedTaxRate / 2;
  const effectiveIgst = igstRateOverride !== '' ? num(igstRateOverride) : weightedTaxRate;

  const taxAmt = taxType === 'CGST_SGST'
    ? taxableAmt * ((effectiveCgst + effectiveSgst) / 100)
    : taxableAmt * (effectiveIgst / 100);
  const grandTotal  = taxableAmt + taxAmt;

  const fmt = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExistingSaleId(null);

    if (!selectedCustomer) { setError('Please select a customer.'); return; }
    if (items.some(i => !i.productId)) { setError('Select a product for every line item.'); return; }

    const extraMeta = JSON.stringify({
      taxType,
      cgstRate: effectiveCgst,
      sgstRate: effectiveSgst,
      igstRate: effectiveIgst,
      deliveryNote,
      dispatchDocNo,
      dispatchedThrough,
      destination,
      buyersOrderNo,
      termsOfDelivery,
    });

    const result = await createSale({
      customerId: selectedCustomer.id,
      quotationId: quotationId || undefined,
      saleDate,
      items: items.map(i => ({
        productId:   i.productId,
        description: i.description,
        quantity:    parseInt(i.quantity)   || 1,
        unitPrice:   parseFloat(i.unitPrice) || 0,
        discount:    parseFloat(i.discount)  || 0,
        taxRate:     parseFloat(i.taxRate)   || DEFAULT_TAX,
        hsnCode:     i.hsnCode || undefined,
      })),
      discountAmount: discAmt,
      paymentTerms,
      notes: `${notes ? notes + '\n' : ''}__META__${extraMeta}`,
    });

    if (result.success) {
      navigate(`/sales/${result.data.id}`);
    } else if (result.error?.includes('already been converted')) {
      setError(result.error);
      try {
        const res = await api.get(`/sales?quotationId=${quotationId}&limit=1`);
        const existing = res.data?.data?.[0];
        if (existing?.id) setExistingSaleId(existing.id);
      } catch {}
    } else {
      setError(result.error || 'Failed to create sale');
    }
  };

  if (loadingQuotation) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
          <Loader2 size={28} className="animate-spin text-green-500" />
          <span>Loading quotation data…</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(quotationId ? '/quotations' : '/sales')} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {quotationId ? 'Convert Quotation to Sale' : 'Create Sale'}
          </h1>
          <p className="text-sm text-gray-500">
            {quotationRef
              ? `Pre-filled from ${quotationRef} — review and confirm all fields before saving`
              : 'New sale order with GST-compliant invoice'}
          </p>
        </div>
      </div>

      {error && !existingSaleId && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <Info size={16} className="flex-shrink-0" />{error}
        </div>
      )}

      {existingSaleId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-sm">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <Info size={16} className="flex-shrink-0 text-amber-600" />
            This quotation has already been converted to a sale.
          </div>
          <p className="text-amber-700 mb-3">A quotation can only produce one sale. View the existing sale below.</p>
          <button
            type="button"
            onClick={() => navigate(`/sales/${existingSaleId}`)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            View Existing Sale →
          </button>
        </div>
      )}

      {quotationRef && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm">
          <FileText size={16} className="flex-shrink-0" />
          Converting from Quotation <strong className="font-mono ml-1">{quotationRef}</strong>. All fields are editable below.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Customer ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Customer</h2>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <div className="font-semibold text-gray-900">{selectedCustomer.contactName}</div>
                {selectedCustomer.companyName && <div className="text-sm text-gray-600">{selectedCustomer.companyName}</div>}
                <div className="text-sm text-gray-500">
                  {selectedCustomer.phone}
                  {selectedCustomer.email && ` · ${selectedCustomer.email}`}
                  {selectedCustomer.gstNumber && ` · GSTIN: ${selectedCustomer.gstNumber}`}
                </div>
                {selectedCustomer.city && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-sm text-red-500 hover:text-red-700">Change</button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDD(true); }}
                  placeholder="Search customer by name or phone..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {showCustomerDD && customers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customers.map(c => (
                    <button
                      key={c.id} type="button"
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDD(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0"
                    >
                      <div className="font-medium">{c.contactName}</div>
                      <div className="text-gray-500 text-xs">{c.phone} {c.companyName && `· ${c.companyName}`}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Invoice Metadata ──────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Invoice Details</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Invoice Date *</label>
              <input type="date" required value={saleDate} onChange={e => setSaleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Tax Type *</label>
              <select value={taxType} onChange={e => setTaxType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option value="CGST_SGST">CGST + SGST (Intra-state)</option>
                <option value="IGST">IGST (Inter-state)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Mode/Terms of Payment</label>
              <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30 days net"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Buyer's Order No.</label>
              <input value={buyersOrderNo} onChange={e => setBuyersOrderNo(e.target.value)}
                placeholder="PO-12345"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Delivery Note</label>
              <input value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)}
                placeholder="DN-001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Dispatch Doc No.</label>
              <input value={dispatchDocNo} onChange={e => setDispatchDocNo(e.target.value)}
                placeholder="DD-001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Dispatched Through</label>
              <input value={dispatchedThrough} onChange={e => setDispatchedThrough(e.target.value)}
                placeholder="By Road / Courier"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Destination</label>
              <input value={destination} onChange={e => setDestination(e.target.value)}
                placeholder="Hubli"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="col-span-2 lg:col-span-4">
              <label className="text-xs text-gray-500 mb-1 block font-medium">Terms of Delivery</label>
              <input value={termsOfDelivery} onChange={e => setTermsOfDelivery(e.target.value)}
                placeholder="e.g. Ex-works / FOB"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
        </div>

        {/* ── Product line items ───────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Product Details</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium">
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => {
              const customPriceDiffers = item._basePrice !== null && num(item.unitPrice) !== item._basePrice && num(item.unitPrice) > 0;
              return (
                <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="grid grid-cols-12 gap-3 items-start">

                    {/* Product */}
                    <div className="col-span-12 md:col-span-4">
                      <label className="text-xs text-gray-500 mb-1 block">Product *</label>
                      <select
                        value={item.productId}
                        onChange={e => updateItem(idx, 'productId', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      >
                        <option value="">Select product…</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} — ₹{Number(p.basePrice).toLocaleString('en-IN')} {p.category ? `(${p.category})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* HSN/SAC */}
                    <div className="col-span-4 md:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">HSN/SAC</label>
                      <input
                        value={item.hsnCode}
                        onChange={e => updateItem(idx, 'hsnCode', e.target.value)}
                        placeholder="8541"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* Qty */}
                    <div className="col-span-4 md:col-span-1">
                      <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                      <input
                        type="number" min="1"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* UOM */}
                    <div className="col-span-4 md:col-span-1">
                      <label className="text-xs text-gray-500 mb-1 block">UOM</label>
                      <input
                        value={item.uom}
                        onChange={e => updateItem(idx, 'uom', e.target.value)}
                        placeholder="Nos"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-4 md:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Unit Price (₹)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.unitPrice}
                        placeholder="0.00"
                        onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                        onFocus={e => e.target.select()}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${customPriceDiffers ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
                      />
                      {item._basePrice !== null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Tag size={10} className="text-gray-400" />
                          <span className="text-[10px] text-gray-400">Cat: ₹{Number(item._basePrice).toLocaleString('en-IN')}</span>
                          {customPriceDiffers && <span className="text-[10px] text-amber-600 font-semibold ml-1">· Custom</span>}
                        </div>
                      )}
                    </div>

                    {/* Disc % */}
                    <div className="col-span-3 md:col-span-1">
                      <label className="text-xs text-gray-500 mb-1 block">Disc %</label>
                      <input
                        type="number" min="0" max="100"
                        value={item.discount}
                        placeholder="0"
                        onChange={e => updateItem(idx, 'discount', e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* GST % */}
                    <div className="col-span-3 md:col-span-1">
                      <label className="text-xs text-gray-500 mb-1 block">GST %</label>
                      <input
                        type="number" min="0" max="100"
                        value={item.taxRate}
                        placeholder="18"
                        onChange={e => updateItem(idx, 'taxRate', e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* Delete */}
                    <div className="col-span-12 md:col-span-1 flex md:mt-5">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <div className="col-span-12">
                      <label className="text-xs text-gray-500 mb-1 block">
                        Description <span className="text-gray-400">(pre-filled from catalogue — customise if needed)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="e.g. 3kW rooftop solar system with on-grid inverter"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Totals + Notes ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notes + discount */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Additional Notes</h2>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Overall Discount (₹)</label>
              <input
                type="number" min="0" step="0.01"
                value={discountAmount}
                placeholder="0.00"
                onChange={e => setDiscountAmount(e.target.value)}
                onFocus={e => e.target.select()}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes / Remarks</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
          </div>

          {/* Totals panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Sub Total</span>
                <span className="font-medium text-gray-900">{fmt(subTotal)}</span>
              </div>
              {discAmt > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Overall Discount</span>
                  <span>-{fmt(discAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Taxable Amount</span>
                <span className="font-medium text-gray-900">{fmt(taxableAmt)}</span>
              </div>
              {taxType === 'CGST_SGST' ? (
                <>
                  {/* CGST editable row */}
                  <div className="flex items-center justify-between text-gray-600 gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <span>CGST</span>
                      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-gray-50 ml-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={cgstRateOverride}
                          placeholder={(weightedTaxRate / 2).toFixed(1)}
                          onChange={e => setCgstRateOverride(e.target.value)}
                          onFocus={e => e.target.select()}
                          className="w-14 px-1.5 py-0.5 text-xs text-center bg-transparent outline-none focus:ring-1 focus:ring-green-400 rounded"
                        />
                        <span className="pr-1.5 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                    <span className="font-medium text-gray-900">{fmt(taxableAmt * effectiveCgst / 100)}</span>
                  </div>
                  {/* SGST editable row */}
                  <div className="flex items-center justify-between text-gray-600 gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <span>SGST</span>
                      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-gray-50 ml-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={sgstRateOverride}
                          placeholder={(weightedTaxRate / 2).toFixed(1)}
                          onChange={e => setSgstRateOverride(e.target.value)}
                          onFocus={e => e.target.select()}
                          className="w-14 px-1.5 py-0.5 text-xs text-center bg-transparent outline-none focus:ring-1 focus:ring-green-400 rounded"
                        />
                        <span className="pr-1.5 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                    <span className="font-medium text-gray-900">{fmt(taxableAmt * effectiveSgst / 100)}</span>
                  </div>
                </>
              ) : (
                /* IGST editable row */
                <div className="flex items-center justify-between text-gray-600 gap-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <span>IGST</span>
                    <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-gray-50 ml-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={igstRateOverride}
                        placeholder={weightedTaxRate.toFixed(1)}
                        onChange={e => setIgstRateOverride(e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-14 px-1.5 py-0.5 text-xs text-center bg-transparent outline-none focus:ring-1 focus:ring-green-400 rounded"
                      />
                      <span className="pr-1.5 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">{fmt(taxableAmt * effectiveIgst / 100)}</span>
                </div>
              )}
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between text-lg font-bold text-green-700">
                <span>Grand Total</span>
                <span>{fmt(grandTotal)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Tax type: <span className="font-semibold">{taxType === 'CGST_SGST' ? 'CGST + SGST (Intra-state)' : 'IGST (Inter-state)'}</span>
              </p>
            </div>

            <button
              type="submit" disabled={isLoading} id="btn-save-sale"
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Save size={18} /> {quotationId ? 'Confirm & Create Invoice' : 'Save Sale'}</>
              }
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
