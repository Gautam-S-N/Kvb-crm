import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useMaterialStore } from '../stores/materialStore';
import api from '../services/api';
import {
  Plus, Search, Edit2, Trash2, AlertTriangle, Package, X,
  Tag, Info, CheckCircle2, ChevronDown, Save
} from 'lucide-react';

const DC_RAW_CATS = ['Sq. Tube', 'Flat Plate', 'Rec. Tube', 'Hardware', 'Round Tube', 'Round Rod', 'L Angle', 'C Channel'];

const BLANK = {
  itemName: '', itemCode: '', category: DC_RAW_CATS[0],
  unit: 'Nos', balance: 0, minQuantity: 0, rate: 0,
  inQty: 0, outQty: 0, location: '', projectSite: '', remarks: ''
};

export default function DCRawMaterials() {
  const { materials, isLoading, fetchMaterials, createMaterial, updateMaterial, deleteMaterial } = useMaterialStore();
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('ALL');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(BLANK);
  const [submitError, setSubmitError] = useState('');
  const [stockLookup, setStockLookup] = useState(null);
  const [lookingUp, setLookingUp]   = useState(false);
  const timer = useRef(null);

  useEffect(() => { fetchMaterials({ limit: 1000 }); }, []);

  // Only DC raw materials
  const dcMaterials = materials.filter(m => DC_RAW_CATS.includes(m.category));

  const filtered = dcMaterials.filter(m => {
    if (catFilter !== 'ALL' && m.category !== catFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return m.itemName?.toLowerCase().includes(q) ||
           m.itemCode?.toLowerCase().includes(q) ||
           m.category?.toLowerCase().includes(q);
  });

  // Stock code lookup
  const handleLookup = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    setStockLookup(null);
    if (editing) return;
    if (timer.current) clearTimeout(timer.current);
    if (!value || value.length < 2) return;
    timer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const p = field === 'itemCode' ? 'itemCode' : 'itemName';
        const { data } = await api.get(`/materials/stock-summary?${p}=${encodeURIComponent(value)}`);
        if (data.found) {
          setStockLookup(data);
          setForm(prev => ({
            ...prev,
            ...(field === 'itemCode' && data.itemName ? { itemName: data.itemName } : {}),
            ...(field === 'itemName' && data.itemCode ? { itemCode: data.itemCode } : {}),
            ...(data.unit ? { unit: data.unit } : {}),
          }));
        }
      } catch {}
      setLookingUp(false);
    }, 500);
  };

  const openAdd = () => {
    setEditing(null); setForm(BLANK); setStockLookup(null); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      itemName: m.itemName, itemCode: m.itemCode || '', category: m.category || DC_RAW_CATS[0],
      unit: m.unit || 'Nos', balance: Number(m.balance), minQuantity: Number(m.minQuantity),
      rate: Number(m.rate), inQty: Number(m.inQty) || 0, outQty: Number(m.outQty) || 0,
      location: m.location || '', projectSite: m.projectSite || '', remarks: m.remarks || ''
    });
    setStockLookup(null); setSubmitError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitError('');
    const result = editing
      ? await updateMaterial(editing.id, form)
      : await createMaterial({ ...form, category: form.category || DC_RAW_CATS[0] });
    if (result?.success === false) { setSubmitError(result.error || 'Failed to save.'); return; }
    setShowModal(false);
    fetchMaterials({ limit: 1000 });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    await deleteMaterial(id);
  };

  const stockBadge = (bal, min) => {
    if (Number(bal) <= 0) return 'bg-red-100 text-red-700 border-red-200';
    if (Number(bal) <= Number(min)) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const cats = ['ALL', ...DC_RAW_CATS];

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🔩 DC Raw Materials
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Structural & hardware materials from DC List 2026 — Sheet 3</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
          <Plus size={18} /> Add Material
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Items',   val: dcMaterials.length,                                                                               icon: Package,       color: 'blue'  },
          { label: 'Categories',    val: DC_RAW_CATS.length,                                                                               icon: Tag,           color: 'purple'},
          { label: 'Low Stock',     val: dcMaterials.filter(m => Number(m.balance) <= Number(m.minQuantity) && Number(m.balance) > 0).length, icon: AlertTriangle, color: 'amber' },
          { label: 'Out of Stock',  val: dcMaterials.filter(m => Number(m.balance) <= 0).length,                                           icon: X,             color: 'red'   },
        ].map(s => {
          const Icon = s.icon;
          const clr = { blue:'bg-blue-50 text-blue-600', purple:'bg-purple-50 text-purple-600', amber:'bg-amber-50 text-amber-600', red:'bg-red-50 text-red-600' }[s.color];
          return (
            <div key={s.label} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${clr}`}><Icon size={18}/></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{s.val}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category pills + search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code or category…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cats.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${catFilter === c ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Rate (₹)</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading && filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No DC raw materials found.</td></tr>
              ) : filtered.map((m, i) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 text-sm transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-xs">
                    <div className="font-semibold">{m.itemName}</div>
                    {m.remarks && <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{m.remarks}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.itemCode || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{m.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{Number(m.balance)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 uppercase">{m.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₹{Number(m.rate).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.location || m.projectSite || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${stockBadge(m.balance, m.minQuantity)}`}>
                      {Number(m.balance) <= 0 ? 'OUT' : Number(m.balance) <= Number(m.minQuantity) ? 'LOW' : 'OK'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md" title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md" title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">
                {editing ? `✏️ Edit — ${editing.itemName}` : '➕ Add DC Raw Material'}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400 hover:text-black dark:hover:text-white"/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                  <Info size={14}/> {submitError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Item Name *</label>
                  <input required value={form.itemName} onChange={e => handleLookup('itemName', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="e.g. Sq.pipe (6000x20x20x3)"/>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Item Code</label>
                  <input value={form.itemCode} onChange={e => handleLookup('itemCode', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="DC3-SQ-001"/>
                  {lookingUp && <p className="mt-1 text-[10px] text-gray-400 animate-pulse">Checking stock…</p>}
                  {!lookingUp && stockLookup && (
                    <div className="mt-1.5 border border-amber-200 bg-amber-50 rounded-xl p-2 text-[10px] text-amber-800">
                      <AlertTriangle size={10} className="inline mr-1 text-amber-600"/>
                      Existing stock: <strong>{stockLookup.totalStock} {stockLookup.unit}</strong> across {stockLookup.recordCount} location(s)
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category *</label>
                  <select required value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none">
                    {DC_RAW_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none">
                    {['Nos', 'Kg', 'Meter', 'Liter', 'Set', 'Box', 'Roll', 'Pair'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Rate (₹)</label>
                  <input type="number" step="0.01" value={form.rate} onChange={e => setForm(p => ({...p, rate: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"/>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Location / Site</label>
                  <input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Warehouse / Project Site"/>
                </div>

                {/* Qty row */}
                <div className="md:col-span-2 grid grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">In Qty</label>
                    <input type="number" value={form.inQty} onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setForm(p => ({...p, inQty: v, balance: v - (Number(p.outQty) || 0)}));
                    }} className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 outline-none text-sm"/>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Out Qty</label>
                    <input type="number" value={form.outQty} onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setForm(p => ({...p, outQty: v, balance: (Number(p.inQty) || 0) - v}));
                    }} className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 outline-none text-sm"/>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-green-600 uppercase mb-1">Stock in Hand</label>
                    <input type="number" value={form.balance} onChange={e => setForm(p => ({...p, balance: e.target.value}))}
                      className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800 outline-none text-sm font-bold"/>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Remarks</label>
                  <textarea rows={2} value={form.remarks} onChange={e => setForm(p => ({...p, remarks: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none resize-none"
                    placeholder="Type, size specifications, notes…"/>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-[2] py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save size={16}/> {isLoading ? 'Saving…' : editing ? 'Save Changes' : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
