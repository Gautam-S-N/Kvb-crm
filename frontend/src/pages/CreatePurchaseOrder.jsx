import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { usePurchaseStore } from '../stores/purchaseStore';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';

// Yellow cell input style — matches the PO yellow cells
const YI = 'w-full bg-yellow-100 border-0 outline-none text-sm px-1 py-0 font-medium placeholder-yellow-400 focus:bg-yellow-200 transition-colors';
const YN = 'w-full bg-yellow-100 border-0 outline-none text-sm px-1 py-0 text-center placeholder-yellow-400 focus:bg-yellow-200 transition-colors';
const YR = 'w-full bg-yellow-100 border-0 outline-none text-sm px-1 py-0 text-right placeholder-yellow-400 focus:bg-yellow-200 transition-colors';

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const { createPurchaseOrder, isLoading } = usePurchaseStore();

  // PO Header
  const today = new Date().toISOString().split('T')[0];
  const fy = (() => { const y = new Date().getFullYear(); const m = new Date().getMonth(); return m >= 3 ? `${String(y).slice(2)}/${String(y+1).slice(2)}` : `${String(y-1).slice(2)}/${String(y).slice(2)}`; })();
  const [poNumber,  setPoNumber]  = useState(`KVB-${fy}-`);
  const [poDate,    setPoDate]    = useState(today);

  // Vendor (left yellow — free text)
  const [vendorName,    setVendorName]    = useState('');
  const [vendorGstin,   setVendorGstin]   = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorPinCode, setVendorPinCode] = useState('');
  const [vendorPhone,   setVendorPhone]   = useState('');

  // Ship To (right yellow — editable defaults)
  const [shipAddress,   setShipAddress]   = useState('1st Floor, RHK Building, BVB Campus, Hubblli.');
  const [shipPinCode,   setShipPinCode]   = useState('580 031');
  const [shipMNo,       setShipMNo]       = useState('95455 29950');
  const [shipGstin,     setShipGstin]     = useState('29AAXFK4926A1Z0');

  // Shipping
  const [shippingMethod, setShippingMethod] = useState('Door Delivery');
  const [deliveryDate,   setDeliveryDate]   = useState('');

  // Tax
  const [gstRate,  setGstRate]  = useState(18);
  const [roundOff, setRoundOff] = useState('');

  // Items
  const [items, setItems] = useState([
    { itemName: '', hsnCode: '', quantity: '', unitPrice: '' }
  ]);

  const [error, setError] = useState('');

  const addItem    = () => setItems([...items, { itemName: '', hsnCode: '', quantity: '', unitPrice: '' }]);
  const removeItem = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));
  const upd = (i, f, v) => { const n = [...items]; n[i][f] = v; setItems(n); };

  const subTotal = items.reduce((s, it) => s + ((+it.quantity || 0) * (+it.unitPrice || 0)), 0);
  const gstAmt   = parseFloat((subTotal * (+gstRate || 0) / 100).toFixed(2));
  const rnd      = parseFloat(roundOff) || 0;
  const grand    = parseFloat((subTotal + gstAmt + rnd).toFixed(2));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!vendorName.trim()) { setError('Please enter vendor company name'); return; }
    if (items.some(it => !it.itemName.trim())) { setError('All items must have a name'); return; }

    const res = await createPurchaseOrder({
      poNumber: poNumber.trim() || undefined,
      vendorName, vendorGstin, vendorAddress, vendorPinCode, vendorPhone,
      shipAddress, shipPinCode, shipMNo, shipGstin: '29AAXFK4926A1Z0',
      shippingMethod, gstRate: +gstRate, roundOff: rnd,
      comments: 'Digitally created, signature not required',
      expectedDate: deliveryDate || null,
      items: items.filter(it => it.itemName.trim()).map(it => ({
        itemName: it.itemName,
        hsnCode:  it.hsnCode || '',
        quantity: +it.quantity || 0,
        unitPrice: +it.unitPrice || 0,
      }))
    });

    if (res.success) navigate('/purchase');
    else setError(res.error || 'Failed to create PO');
  };

  const cell = 'border border-gray-400 px-2 py-1';
  const hdr  = 'bg-blue-700 text-white text-center font-bold text-sm border border-blue-900 px-2 py-1';

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/purchase')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Purchase Order</h1>
          <p className="text-xs text-gray-400">Yellow fields are editable</p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden max-w-4xl mx-auto">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 flex items-center justify-center">
                <span className="text-2xl font-black text-green-700">KVB</span>
              </div>
              <div className="text-2xl font-black text-gray-800 tracking-wide">KVB GREEN ENERGIES</div>
            </div>
          </div>

          {/* ── Title ──────────────────────────────────────────────────────── */}
          <div className="text-center bg-white border-b border-gray-300 py-1">
            <span className="font-bold text-blue-700 text-base tracking-widest">PURCHASE ORDER</span>
          </div>

          {/* PO No + Date */}
          <table className="w-full border-collapse border border-gray-400">
            <tbody>
              <tr className="bg-yellow-100">
                <td className="border border-gray-400 px-2 py-1 w-16 font-bold text-sm text-gray-700 whitespace-nowrap">PO No:</td>
                <td className="border border-gray-400 bg-yellow-100 px-1 py-0.5 w-48">
                  <input value={poNumber} onChange={e => setPoNumber(e.target.value)} required
                    className={YI + ' font-bold text-blue-700'} placeholder="e.g. KVB-26/27-0001" />
                </td>
                <td className="border border-gray-400 px-2 py-1 w-24 font-bold text-sm text-right text-gray-700 whitespace-nowrap">DATE :</td>
                <td className="border border-gray-400 bg-yellow-100 px-1 py-0.5">
                  <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} className={YI} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* VENDOR | SHIP TO */}
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr>
                <th className={hdr} style={{width:'50%'}}>VENDOR</th>
                <th className={hdr} style={{width:'50%'}}>SHIP TO</th>
              </tr>
            </thead>
            <tbody>
              {/* Name of Company */}
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Name Of Company:</span>
                    <input value={vendorName} onChange={e => setVendorName(e.target.value)} required
                      className={YI} placeholder="Enter vendor company name" />
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-0.5 text-sm">
                  <span className="font-semibold text-gray-600">Name Of Company: </span>KVB GREEN ENERGIES
                </td>
              </tr>
              {/* GSTIN */}
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">GSTIN:</span>
                    <input value={vendorGstin} onChange={e => setVendorGstin(e.target.value)}
                      className={YI} placeholder="Vendor GSTIN" />
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-0.5 text-sm">
                  <span className="font-semibold text-gray-600">GSTIN: </span>29AAXFK4926A1Z0
                </td>
              </tr>
              {/* Address */}
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Address:</span>
                    <input value={vendorAddress} onChange={e => setVendorAddress(e.target.value)}
                      className={YI} placeholder="Vendor address" />
                  </div>
                </td>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Address:</span>
                    <input value={shipAddress} onChange={e => setShipAddress(e.target.value)}
                      className={YI} />
                  </div>
                </td>
              </tr>
              {/* Pin Code */}
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Pin Code:</span>
                    <input value={vendorPinCode} onChange={e => setVendorPinCode(e.target.value)}
                      className={YI} placeholder="Pin code" />
                  </div>
                </td>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Pin Code:</span>
                    <input value={shipPinCode} onChange={e => setShipPinCode(e.target.value)}
                      className={YI} />
                  </div>
                </td>
              </tr>
              {/* M No */}
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">M No:</span>
                    <input value={vendorPhone} onChange={e => setVendorPhone(e.target.value)}
                      className={YI} placeholder="Mobile number" />
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-0.5 text-sm">
                  <span className="font-semibold text-gray-600">M No: </span>95455 29950
                </td>
              </tr>
            </tbody>
          </table>

          {/* Shipping Terms / Method / Delivery Date */}
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr>
                <th className="bg-blue-100 text-blue-800 font-bold text-sm border border-gray-400 px-2 py-1 text-center" style={{width:'34%'}}>SHIPPING TERMS</th>
                <th className="bg-blue-100 text-blue-800 font-bold text-sm border border-gray-400 px-2 py-1 text-center" style={{width:'33%'}}>SHIPPING METHOD</th>
                <th className="bg-blue-100 text-blue-800 font-bold text-sm border border-gray-400 px-2 py-1 text-center" style={{width:'33%'}}>DELIVERY DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 px-2 py-1 text-sm text-center text-gray-700">Cost, Insurance &amp; Freight</td>
                <td className="border border-gray-400 bg-yellow-100 px-1 py-0.5">
                  <select value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}
                    className="w-full bg-yellow-100 border-0 outline-none text-sm font-medium text-center py-0">
                    <option>Door Delivery</option>
                    <option>Pickup</option>
                    <option>Courier</option>
                    <option>Transport</option>
                  </select>
                </td>
                <td className="border border-gray-400 bg-yellow-100 px-1 py-0.5">
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                    className={YI} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Items Table */}
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-700 text-white text-xs font-bold">
                <th className="border border-blue-900 px-2 py-1 text-center w-10">Sl.No.</th>
                <th className="border border-blue-900 px-2 py-1 text-left">Description of Goods</th>
                <th className="border border-blue-900 px-2 py-1 text-center w-24">HSN Code</th>
                <th className="border border-blue-900 px-2 py-1 text-center w-12">QTY</th>
                <th className="border border-blue-900 px-2 py-1 text-right w-28">UNIT PRICE</th>
                <th className="border border-blue-900 px-2 py-1 text-right w-24">TOTAL</th>
                <th className="border border-blue-900 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-300">
                  <td className="border border-gray-400 text-center text-sm py-1 px-1">{i + 1}</td>
                  <td className="border border-gray-400 py-0.5 px-1">
                    <input value={item.itemName} onChange={e => upd(i, 'itemName', e.target.value)} required
                      placeholder="Item / description"
                      className="w-full bg-white border-0 outline-none text-sm px-1 py-0 focus:bg-yellow-50" />
                  </td>
                  <td className="border border-gray-400 py-0.5 px-1">
                    <input value={item.hsnCode} onChange={e => upd(i, 'hsnCode', e.target.value)}
                      placeholder="HSN"
                      className="w-full bg-white border-0 outline-none text-sm text-center px-1 py-0 focus:bg-yellow-50" />
                  </td>
                  <td className="border border-gray-400 py-0.5 px-1">
                    <input type="number" value={item.quantity} onChange={e => upd(i, 'quantity', e.target.value)} min="0"
                      className="w-full bg-white border-0 outline-none text-sm text-center px-1 py-0 focus:bg-yellow-50" />
                  </td>
                  <td className="border border-gray-400 py-0.5 px-1">
                    <input type="number" value={item.unitPrice} onChange={e => upd(i, 'unitPrice', e.target.value)} min="0" step="0.01"
                      className="w-full bg-white border-0 outline-none text-sm text-right px-1 py-0 focus:bg-yellow-50" />
                  </td>
                  <td className="border border-gray-400 py-1 px-2 text-right text-sm font-medium text-gray-800">
                    {((+item.quantity||0)*(+item.unitPrice||0)).toLocaleString('en-IN', {minimumFractionDigits:2})}
                  </td>
                  <td className="border border-gray-400 text-center">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-0.5">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {/* Add Item row */}
              <tr>
                <td colSpan={7} className="border border-gray-400 py-1 px-3">
                  <button type="button" onClick={addItem}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={13} /> Add Item
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals + Comments */}
          <table className="w-full border-collapse border border-gray-400">
            <tbody>
              <tr>
                <td rowSpan={4} className="border border-gray-400 px-3 py-2 align-top text-sm" style={{width:'55%'}}>
                  <div className="font-bold text-gray-700 mb-1">Comments or Special Instructions</div>
                  <div className="text-gray-500 text-xs italic">Digitally created, signature not required</div>
                </td>
                <td className="border border-gray-400 px-2 py-1 text-sm font-semibold text-gray-700 text-right">SUB-TOTAL</td>
                <td className="border border-gray-400 px-2 py-1 text-sm text-right font-medium text-gray-800">
                  {subTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs font-semibold text-gray-600">GST @</span>
                    <input type="number" min="0" max="28" step="0.5" value={gstRate}
                      onChange={e => setGstRate(e.target.value)}
                      className="w-12 bg-yellow-100 border-0 outline-none text-sm text-center font-semibold" />
                    <span className="text-xs font-semibold text-gray-600">%</span>
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-1 text-sm text-right font-medium text-gray-800">
                  {gstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-400 bg-yellow-100 px-2 py-0.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs font-semibold text-gray-600">Round Off</span>
                    <input type="number" step="0.01" value={roundOff}
                      onChange={e => setRoundOff(e.target.value)}
                      className="w-16 bg-yellow-100 border-0 outline-none text-sm text-right font-semibold"
                      placeholder="0.00" />
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-1 text-sm text-right font-medium text-gray-800">
                  {rnd.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-400 bg-blue-700 text-white px-2 py-1 text-sm font-bold text-right">GRAND TOTAL</td>
                <td className="border border-gray-400 bg-blue-700 text-white px-2 py-1 text-sm font-bold text-right">
                  ₹{grand.toLocaleString('en-IN', {minimumFractionDigits:2})}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer slogan */}
          <div className="bg-gradient-to-r from-green-700 to-blue-700 text-white text-center py-2 text-sm font-semibold italic">
            Let us Help the Sun, To Help You
          </div>

        </div>

        {/* Submit */}
        <div className="max-w-4xl mx-auto mt-4 flex justify-end">
          <button type="submit" disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg shadow transition-colors disabled:opacity-60">
            {isLoading ? 'Saving...' : <><Save size={18} /> Save &amp; Generate PO</>}
          </button>
        </div>
      </form>
    </Layout>
  );
}
