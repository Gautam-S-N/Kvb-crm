import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { usePurchaseStore } from '../stores/purchaseStore';
import { ArrowLeft, Save, Plus, Trash2, Info } from 'lucide-react';

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const { vendors, fetchVendors, createPurchaseOrder, isLoading } = usePurchaseStore();

  const [vendorId, setVendorId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { itemName: '', description: '', quantity: 1, unitPrice: 0 }
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVendors(); // Initial full list
  }, []);

  const addItem = () => setItems([...items, { itemName: '', description: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx, field, val) => {
    const next = [...items];
    next[idx][field] = val;
    setItems(next);
  };

  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = subTotal * 0.18;
  const grandTotal = subTotal + taxAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!vendorId) { setError('Please select a vendor'); return; }
    if (items.some(i => !i.itemName.trim())) { setError('All items must have a name'); return; }

    const res = await createPurchaseOrder({
      vendorId,
      expectedDate: expectedDate || null,
      notes,
      items
    });

    if (res.success) navigate('/purchase');
    else setError(res.error || 'Failed to create PO');
  };

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/purchase')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Purchase Order</h1>
          <p className="text-sm text-gray-500">Generate a new PO for your vendor</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <Info size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor & Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-2">Select Vendor *</label>
            <select required value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-green-500 focus:outline-none">
              <option value="">-- Choose Vendor --</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName} {v.contactName ? `(${v.contactName})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-2">Expected Delivery Date</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-green-500 focus:outline-none" />
          </div>
        </div>

        {/* PO Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
            <button type="button" onClick={addItem} className="text-xs font-medium text-green-600 flex items-center gap-1 hover:text-green-700">
              <Plus size={14} /> Add Item
            </button>
          </div>
          
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-lg grid grid-cols-12 gap-3 items-start">
                <div className="col-span-12 md:col-span-4">
                  <label className="text-xs text-gray-500 mb-1 block">Item Name *</label>
                  <input required value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)} className="w-full px-3 py-2 text-sm border rounded outline-none focus:ring-1 focus:ring-green-500" placeholder="e.g. Solar Panel 500W" />
                </div>
                <div className="col-span-12 md:col-span-3">
                  <label className="text-xs text-gray-500 mb-1 block">Description</label>
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-3 py-2 text-sm border rounded outline-none focus:ring-1 focus:ring-green-500" placeholder="Optional specs..." />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                  <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', +e.target.value)} className="w-full px-3 py-2 text-sm border rounded outline-none focus:ring-1 focus:ring-green-500" />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Unit Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', +e.target.value)} className="w-full px-3 py-2 text-sm border rounded outline-none focus:ring-1 focus:ring-green-500" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Total (₹)</label>
                  <div className="px-3 py-2 bg-gray-200 text-sm font-semibold rounded text-gray-700">
                    {Number(item.quantity * item.unitPrice).toLocaleString()}
                  </div>
                </div>
                <div className="col-span-12 md:col-span-1 flex md:mt-6 justify-center">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer/Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-2">Terms / Notes</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, payment terms, etc." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-green-500 focus:outline-none resize-none" />
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3 uppercase tracking-wide text-xs">PO Summary</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between"><span>Sub Total</span><span className="font-medium text-gray-900">₹{subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
              <div className="flex justify-between"><span>GST Estimate (18%)</span><span>₹{taxAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between text-base font-bold text-green-700"><span>Grand Total</span><span>₹{grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
            </div>
            <button type="submit" disabled={isLoading} className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow disabled:opacity-60">
              {isLoading ? 'Saving...' : <><Save size={18} /> Save & Generate PO</>}
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
