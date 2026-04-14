import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useSaleStore } from '../stores/saleStore';
import { useProductStore } from '../stores/productStore';
import api from '../services/api';
import {
  Plus, Trash2, ArrowLeft, Save, Search, Info, Tag
} from 'lucide-react';

const DEFAULT_TAX = 18;

// Keep numeric fields as raw strings so user can clear "0" freely
const EMPTY_ITEM = () => ({
  productId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  discount: '',
  taxRate: String(DEFAULT_TAX),
  _basePrice: null,   // catalogue reference
});

export default function CreateSale() {
  const navigate = useNavigate();
  const { createSale, isLoading } = useSaleStore();
  const { products, fetchProducts } = useProductStore();

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers]           = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDD, setShowCustomerDD] = useState(false);

  // Form state — all numeric values kept as strings
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentTerms, setPaymentTerms]     = useState('');
  const [expectedDelivery, setExpected]     = useState('');
  const [notes, setNotes]                   = useState('');
  const [error, setError]                   = useState('');

  useEffect(() => { fetchProducts(); }, []);

  // Search customers
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

  // Item helpers
  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };

      // Auto-fill price + description + taxRate when product chosen
      if (field === 'productId' && value) {
        const prod = products.find(p => p.id === value);
        if (prod) {
          next[idx].unitPrice   = String(prod.basePrice);
          next[idx].taxRate     = String(prod.taxRate || DEFAULT_TAX);
          next[idx].description = prod.description || '';
          next[idx]._basePrice  = Number(prod.basePrice);
        }
      }
      if (field === 'productId' && !value) {
        next[idx]._basePrice = null;
      }
      return next;
    });
  };

  // Safe parsers
  const num = (v) => parseFloat(v) || 0;

  // Totals
  const lineTotal = (item) =>
    num(item.quantity) * num(item.unitPrice) * (1 - num(item.discount) / 100);

  const subTotal   = items.reduce((s, i) => s + lineTotal(i), 0);
  const discAmt    = num(discountAmount);
  const taxableAmt = subTotal - discAmt;
  const taxAmt     = taxableAmt * (DEFAULT_TAX / 100);
  const grandTotal = taxableAmt + taxAmt;
  const fmt = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomer) { setError('Please select a customer.'); return; }
    if (items.some(i => !i.productId)) { setError('Select a product for every line item.'); return; }

    const result = await createSale({
      customerId: selectedCustomer.id,
      items: items.map(i => ({
        productId:   i.productId,
        description: i.description,
        quantity:    parseInt(i.quantity)   || 1,
        unitPrice:   parseFloat(i.unitPrice) || 0,
        discount:    parseFloat(i.discount)  || 0,
        taxRate:     parseFloat(i.taxRate)   || DEFAULT_TAX,
      })),
      discountAmount: discAmt,
      paymentTerms,
      expectedDelivery,
      notes
    });

    if (result.success) {
      navigate(`/sales/${result.data.id}`);
    } else {
      setError(result.error || 'Failed to create sale');
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/sales')} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Sale</h1>
          <p className="text-sm text-gray-500">New sale order with GST-compliant invoice</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <Info size={16} className="flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Customer</h2>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <div className="font-semibold text-gray-900">{selectedCustomer.contactName}</div>
                {selectedCustomer.companyName && <div className="text-sm text-gray-600">{selectedCustomer.companyName}</div>}
                <div className="text-sm text-gray-500">{selectedCustomer.phone} {selectedCustomer.email && `· ${selectedCustomer.email}`}</div>
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

        {/* Product line items */}
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
                      {/* Catalogue reference */}
                      {item._basePrice !== null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Tag size={10} className="text-gray-400" />
                          <span className="text-[10px] text-gray-400">
                            Catalogue: ₹{Number(item._basePrice).toLocaleString('en-IN')}
                          </span>
                          {customPriceDiffers && (
                            <span className="text-[10px] text-amber-600 font-semibold ml-1">· Custom price</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Discount */}
                    <div className="col-span-4 md:col-span-1">
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

                    {/* Tax */}
                    <div className="col-span-4 md:col-span-1">
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

                    {/* Line total */}
                    <div className="col-span-4 md:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Total</label>
                      <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-900">
                        {fmt(lineTotal(item))}
                      </div>
                    </div>

                    {/* Delete */}
                    <div className="col-span-12 md:col-span-1 flex md:mt-5">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Description — customer-specific */}
                    <div className="col-span-12">
                      <label className="text-xs text-gray-500 mb-1 block">
                        Description <span className="text-gray-400">(pre-filled from catalogue — customise for this customer)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="e.g. 3kW rooftop solar system with on-grid inverter, custom mounting structure for flat RCC roof"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terms + Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Terms */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Additional Info</h2>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Payment Terms</label>
              <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. 30 days net" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Expected Delivery Date</label>
              <input type="date" value={expectedDelivery} onChange={e => setExpected(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
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
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
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
                  <span>Discount</span>
                  <span>-{fmt(discAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Taxable Amount</span>
                <span className="font-medium text-gray-900">{fmt(taxableAmt)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>CGST (9%)</span>
                <span>{fmt(taxAmt / 2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>SGST (9%)</span>
                <span>{fmt(taxAmt / 2)}</span>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between text-lg font-bold text-green-700">
                <span>Grand Total</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </div>

            <button
              type="submit" disabled={isLoading} id="btn-save-sale"
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Save size={18} /> Save Sale</>
              }
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
