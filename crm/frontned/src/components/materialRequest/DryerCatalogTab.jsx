import { useState } from 'react';
import { useMaterialCatalogStore } from '../../stores/materialCatalogStore';
import { Plus, Search, Edit2, Trash2, X, Info, Save } from 'lucide-react';

const CAT = 'Dryer Component';
const BLANK = { itemName:'', itemCode:'', category:CAT, unit:'Nos', rate:0, projectSite:'', remarks:'' };

export default function DryerCatalogTab() {
  const { materials, isLoading, fetchMaterials, createMaterial, updateMaterial, deleteMaterial } = useMaterialCatalogStore();
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(BLANK);
  const [err, setErr]       = useState('');

  const items  = materials
    .filter(m => m.category === CAT)
    .sort((a, b) => {
      // Sort by numeric suffix: DC1-001 → 1, DC1-041 → 41
      const numA = parseInt((a.itemCode || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.itemCode || '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const shown  = items.filter(m => {
    const q = search.toLowerCase();
    return !q || m.itemName?.toLowerCase().includes(q) || m.itemCode?.toLowerCase().includes(q) || m.remarks?.toLowerCase().includes(q);
  });

  const openAdd  = () => { setEditing(null); setForm(BLANK); setErr(''); setModal(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ itemName:m.itemName, itemCode:m.itemCode||'', category:CAT, unit:m.unit||'Nos', rate:Number(m.rate)||0, projectSite:m.projectSite||'', remarks:m.remarks||'' });
    setErr(''); setModal(true);
  };
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const r = editing ? await updateMaterial(editing.id, { ...form, category:CAT }) : await createMaterial({ ...form, category:CAT });
    if (r?.success === false) { setErr(r.error||'Failed'); return; }
    setModal(false); fetchMaterials({ limit:1000 });
  };
  const del = async (id) => { if (!confirm('Delete this component?')) return; await deleteMaterial(id); };

  const badge = (b,m) => Number(b)<=0?'bg-red-100 text-red-700':Number(b)<=Number(m)?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">☀️ Dryer Components</h2>
          <p className="text-xs text-gray-500">Solar dryer component checklist — DC List 2026 Sheet 1 · {items.length} items</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
          <Plus size={16}/> Add Component
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search components…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"/>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-amber-50 text-gray-500 text-[10px] uppercase">
              <tr>
                <th className="px-4 py-3">#</th><th className="px-4 py-3">Component Name</th>
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3">Size / Remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length===0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">{isLoading?'Loading…':'No components found.'}</td></tr>
              ) : shown.map((m,i)=>(
                <tr key={m.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.itemName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.itemCode||'—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 uppercase">{m.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(m.rate)>0?`₹${Number(m.rate).toLocaleString('en-IN')}`:'—'}</td>
                  <td className="px-4 py-3">
                    {m.remarks
                      ? <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded">{m.remarks}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={()=>openEdit(m)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-md"><Edit2 size={13}/></button>
                      <button onClick={()=>del(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-amber-50">
              <h3 className="font-bold">{editing?`Edit — ${editing.itemName}`:'Add Dryer Component'}</h3>
              <button onClick={()=>setModal(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex gap-2"><Info size={13}/>{err}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Component Name *</label>
                  <input required value={form.itemName} onChange={e=>setForm(p=>({...p,itemName:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" placeholder="e.g. PV Panel, Heater, Arch Material"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Item Code</label>
                  <input value={form.itemCode} onChange={e=>setForm(p=>({...p,itemCode:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" placeholder="DC1-001"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unit</label>
                  <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none">
                    {['Nos','Kg','Meter','Liter','Set','Box','Roll','Pair'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Rate (₹)</label>
                  <input type="number" step="0.01" value={form.rate} onChange={e=>setForm(p=>({...p,rate:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Project / Site</label>
                  <input value={form.projectSite} onChange={e=>setForm(p=>({...p,projectSite:e.target.value}))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" placeholder="Solar Dryer Phase 1"/>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Remarks / Size</label>
                <textarea rows={2} value={form.remarks} onChange={e=>setForm(p=>({...p,remarks:e.target.value}))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none" placeholder="Size, specs, supplier…"/>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setModal(false)} className="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={15}/>{isLoading?'Saving…':editing?'Save Changes':'Add Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
