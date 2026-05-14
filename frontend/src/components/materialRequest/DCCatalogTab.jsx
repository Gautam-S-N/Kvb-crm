import { useState, useRef } from 'react';
import { useMaterialStore } from '../../stores/materialStore';
import api from '../../services/api';
import { Plus, Search, Edit2, Trash2, AlertTriangle, X, Info, Save } from 'lucide-react';

const CATS = ['Sq. Tube','Flat Plate','Rec. Tube','Hardware','Round Tube','Round Rod','L Angle','C Channel'];
const BLANK = { itemName:'', itemCode:'', category:CATS[0], unit:'Nos', balance:0, inQty:0, outQty:0, rate:0, location:'', remarks:'' };

export default function DCCatalogTab() {
  const { materials, isLoading, fetchMaterials, createMaterial, updateMaterial, deleteMaterial } = useMaterialStore();
  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('ALL');
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(BLANK);
  const [err, setErr]       = useState('');
  const [lookup, setLookup] = useState(null);
  const [looking, setLooking] = useState(false);
  const timer = useRef(null);

  const dcItems = materials
    .filter(m => CATS.includes(m.category))
    .sort((a, b) => {
      const numA = parseInt((a.itemCode || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.itemCode || '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const shown   = dcItems.filter(m => {
    if (cat !== 'ALL' && m.category !== cat) return false;
    const q = search.toLowerCase();
    return !q || m.itemName?.toLowerCase().includes(q) || m.itemCode?.toLowerCase().includes(q);
  });

  const doLookup = (field, val) => {
    setForm(p => ({...p, [field]: val})); setLookup(null);
    if (editing || val.length < 2) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLooking(true);
      try {
        const { data } = await api.get(`/materials/stock-summary?${field}=${encodeURIComponent(val)}`);
        if (data.found) { setLookup(data); setForm(p => ({...p, unit: data.unit || p.unit})); }
      } catch {}
      setLooking(false);
    }, 500);
  };

  const openAdd  = () => { setEditing(null); setForm(BLANK); setErr(''); setLookup(null); setModal(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ itemName:m.itemName, itemCode:m.itemCode||'', category:m.category||CATS[0], unit:m.unit||'Nos', balance:Number(m.balance), inQty:Number(m.inQty)||0, outQty:Number(m.outQty)||0, rate:Number(m.rate)||0, location:m.location||'', remarks:m.remarks||'' });
    setErr(''); setLookup(null); setModal(true);
  };
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const r = editing ? await updateMaterial(editing.id, form) : await createMaterial(form);
    if (r?.success === false) { setErr(r.error || 'Failed'); return; }
    setModal(false); fetchMaterials({ limit:1000 });
  };
  const del = async (id) => { if (!confirm('Delete this item?')) return; await deleteMaterial(id); };

  const badge = (b,m) => Number(b)<=0 ? 'bg-red-100 text-red-700' : Number(b)<=Number(m) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🔩 DC Raw Materials</h2>
          <p className="text-xs text-gray-500">Structural & hardware materials — DC List 2026 Sheet 3 · {dcItems.length} items</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
          <Plus size={16}/> Add Material
        </button>
      </div>

      {/* Search filter only */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or code…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"/>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase">
              <tr>
                <th className="px-4 py-3">#</th><th className="px-4 py-3">Item Name</th><th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Category</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length===0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{isLoading?'Loading…':'No items found.'}</td></tr>
              ) : (
                (() => {
                  let lastSection = null;
                  return shown.map((m, i) => {
                    const sectionHeading = m.projectSite && m.projectSite !== lastSection ? (
                      <tr key={`section-${m.projectSite}`} className="bg-gray-50/50">
                        <td colSpan={7} className="px-4 py-2 text-[10px] font-black text-red-600 uppercase tracking-widest border-y border-gray-100">
                          {m.projectSite}
                        </td>
                      </tr>
                    ) : null;
                    if (m.projectSite) lastSection = m.projectSite;
                    
                    return (
                      <div key={`group-${m.id}`} style={{ display: 'contents' }}>
                        {sectionHeading}
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{m.itemName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.itemCode||'—'}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-semibold">{m.category}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-500 uppercase">{m.unit}</td>
                          <td className="px-4 py-3 text-right text-gray-600">₹{Number(m.rate).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button onClick={()=>openEdit(m)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md"><Edit2 size={13}/></button>
                              <button onClick={()=>del(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      </div>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold">{editing?`Edit — ${editing.itemName}`:'Add DC Raw Material'}</h3>
              <button onClick={()=>setModal(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex gap-2"><Info size={13}/>{err}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Item Name *</label>
                  <input required value={form.itemName} onChange={e=>doLookup('itemName',e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. Sq.pipe (6000x20x20x3)"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Item Code</label>
                  <input value={form.itemCode} onChange={e=>doLookup('itemCode',e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"/>
                  {looking && <p className="text-[10px] text-gray-400 mt-1 animate-pulse">Checking stock…</p>}
                  {!looking && lookup && <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">
                    <AlertTriangle size={10} className="inline mr-1"/>Existing: <b>{lookup.totalStock} {lookup.unit}</b> across {lookup.recordCount} location(s)
                  </div>}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category *</label>
                  <select required value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                    {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unit</label>
                  <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                    {['Nos','Kg','Meter','Liter','Set','Box','Roll','Pair'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Rate (₹)</label>
                  <input type="number" step="0.01" value={form.rate} onChange={e=>setForm(p=>({...p,rate:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Location</label>
                  <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Warehouse / Site"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                {[['In Qty','inQty','blue'],['Out Qty','outQty','orange'],['Stock in Hand','balance','green']].map(([lbl,key,col])=>(
                  <div key={key} className={`bg-${col}-50 p-3 rounded-xl`}>
                    <label className={`block text-[10px] font-bold text-${col}-600 uppercase mb-1`}>{lbl}</label>
                    <input type="number" value={form[key]} onChange={e=>{
                      const v = Number(e.target.value)||0;
                      if (key==='inQty')  setForm(p=>({...p,inQty:v,balance:v-(Number(p.outQty)||0)}));
                      else if (key==='outQty') setForm(p=>({...p,outQty:v,balance:(Number(p.inQty)||0)-v}));
                      else setForm(p=>({...p,balance:v}));
                    }} className={`w-full bg-white px-3 py-1.5 rounded-lg border border-${col}-100 outline-none text-sm`}/>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Remarks / Size</label>
                <textarea rows={2} value={form.remarks} onChange={e=>setForm(p=>({...p,remarks:e.target.value}))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" placeholder="Type, size, notes…"/>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setModal(false)} className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-[2] py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={15}/>{isLoading?'Saving…':editing?'Save Changes':'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
