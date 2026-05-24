import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useMaterialRequestStore } from '../stores/materialRequestStore';
import { useMaterialStore } from '../stores/materialStore';
import api from '../services/api';
import DCCatalogTab from '../components/materialRequest/DCCatalogTab';
import DryerCatalogTab from '../components/materialRequest/DryerCatalogTab';
import { Plus, X, Trash2, Edit, CheckCircle, XCircle, Package, ShoppingCart, Mic, Square, Play, RefreshCw } from 'lucide-react';


const STATUS_COLORS = {
  PENDING:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  COMPLETE:    'bg-green-100 text-green-700 border-green-200',
  INCOMPLETE:  'bg-red-100 text-red-700 border-red-200',
};

export default function MaterialRequests() {
  const { user } = useAuthStore();
  const { requests, loading, fetchRequests, createRequest, updateRequest, updateStatus, toggleItemPurchased, deleteRequest } = useMaterialRequestStore();
  const { materials, fetchMaterials } = useMaterialStore();

  const canCreate = user?.role === 'ADMIN' || user?.canCreateMaterialRequests === true;

  const [activeTab, setActiveTab]   = useState('requests'); // requests | dc | dryer
  const [showCreate, setShowCreate] = useState(false);

  const [editingReq, setEditingReq]   = useState(null);
  const [detailReq, setDetailReq]     = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [statusNote, setStatusNote]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [form, setForm] = useState({ title: '', projectName: '', location: '', notes: '', assignedToId: '' });
  const [selectedItems, setSelectedItems] = useState({});
  const [employees, setEmployees]   = useState([]);
  const [catFilter, setCatFilter]   = useState('dc');   // 'dc' | 'dryer' — tab inside modal catalog
  const [subCat, setSubCat]         = useState('ALL');  // DC sub-category
  const [saving, setSaving]         = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob]     = useState(null);
  const [audioUrl, setAudioUrl]       = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    fetchRequests();
    fetchMaterials({ limit: 1000 });
    if (canCreate) {
      api.get('/users?role=EMPLOYEE').then(r => setEmployees(r.data.data || []));
    }
  }, []);


  const resetCreate = () => {
    setForm({ title: '', projectName: '', location: '', notes: '', assignedToId: '' });
    setSelectedItems({});
    setEditingReq(null);
    setShowCreate(false);
  };

  const openEdit = (req) => {
    setEditingReq(req);
    setForm({ title: req.title, projectName: req.projectName || '', location: req.location || '', notes: req.notes || '', assignedToId: req.assignedToId });
    const sel = {};
    req.items.forEach(i => { sel[i.id] = { qty: Number(i.quantity), item: i }; });
    setSelectedItems(sel);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const items = Object.values(selectedItems).filter(s => Number(s.qty) > 0).map(s => ({
      itemName: s.item.itemName || s.item.name,
      itemCode: s.item.itemCode || null,
      category: s.item.category || null,
      unit:     s.item.unit || 'Nos',
      quantity: s.qty,
      notes:    s.notes || '',
      isPurchased: s.item.isPurchased || false,
    }));
    if (!form.title || !form.assignedToId || items.length === 0) {
      alert('Please fill Title, Assignee and select at least one item.');
      return;
    }
    setSaving(true);
    try {
      if (editingReq) {
        // If editing a closed request, reset status to IN_PROGRESS
        const newStatus = (editingReq.status === 'COMPLETE' || editingReq.status === 'INCOMPLETE') ? 'IN_PROGRESS' : editingReq.status;
        await updateRequest(editingReq.id, { ...form, items, status: newStatus });
      } else {
        await createRequest({ ...form, items });
      }
      resetCreate();
    } catch(e) { alert(e.message); }
    setSaving(false);
  };

  const handleStatusSubmit = async () => {
    if (!statusModal) return;
    const payload = {
      status: statusModal.targetStatus,
      ...(statusModal.targetStatus === 'COMPLETE'   && { completionNote: statusNote }),
      ...(statusModal.targetStatus === 'INCOMPLETE' && { failureReason:  statusNote }),
    };
    await updateStatus(statusModal.id, payload, audioBlob);
    setStatusModal(null); setStatusNote('');
    setAudioBlob(null); setAudioUrl(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { alert('Microphone access denied or not available.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const markAllSent = async (req) => {
    if (!confirm('Mark all items as sent?')) return;
    for (const item of req.items) {
      if (!item.isPurchased) {
        await toggleItemPurchased(req.id, item.id, true, '');
      }
    }
    setDetailReq(prev => ({
      ...prev,
      items: prev.items.map(i => ({ ...i, isPurchased: true }))
    }));
  };

  const DC_RAW_CATS = ['Sq. Tube','Flat Plate','Rec. Tube','Hardware','Round Tube','Round Rod','L Angle','C Channel'];

  // Rows shown in the catalog table inside the New/Edit Request modal
  const catalogRows = (() => {
    let base = [];
    if (catFilter === 'dryer') {
      base = materials.filter(m => m.category === 'Dryer Component');
    } else {
      // DC tab
      const dcItems = materials.filter(m => DC_RAW_CATS.includes(m.category));
      base = subCat === 'ALL' ? dcItems : dcItems.filter(m => m.category === subCat);
    }

    // Always sort by Sl No (numeric itemCode)
    return [...base].sort((a, b) => {
      const numA = parseInt((a.itemCode || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.itemCode || '').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  })();

  const filteredRequests  = filterStatus ? requests.filter(r => r.status === filterStatus) : requests;

  const toggleItemSelect = (mat) => {
    setSelectedItems(prev => {
      if (prev[mat.id]) { const n = {...prev}; delete n[mat.id]; return n; }
      return { ...prev, [mat.id]: { qty: 1, notes: '', item: mat } };
    });
  };

  const toggleSelectAll = () => {
    const allIds = catalogRows.map(m => m.id);
    const areAllSelected = allIds.every(id => !!selectedItems[id]);

    if (areAllSelected) {
      setSelectedItems(prev => {
        const next = { ...prev };
        allIds.forEach(id => delete next[id]);
        return next;
      });
    } else {
      setSelectedItems(prev => {
        const next = { ...prev };
        catalogRows.forEach(m => {
          if (!next[m.id]) next[m.id] = { qty: 1, notes: '', item: m };
        });
        return next;
      });
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Material Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">{canCreate ? 'Create and track procurement requests' : 'Your assigned material requests'}</p>
        </div>
        {activeTab === 'requests' && canCreate && (
          <button onClick={() => { setEditingReq(null); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow">
            <Plus size={18}/> New Request
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {[
          { key: 'requests', label: '📋 Material Requests' },
          ...(canCreate ? [
            { key: 'dc',       label: '🔩 DC Raw Materials' },
            { key: 'dryer',    label: '☀️ Dryer Components' },
          ] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Catalog Tabs ── */}
      {activeTab === 'dc'    && <DCCatalogTab />}
      {activeTab === 'dryer' && <DryerCatalogTab />}

      {/* ── Requests Tab ── */}
      {activeTab === 'requests' && (<>

        {/* Status filter */}

      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'PENDING', 'IN_PROGRESS', 'COMPLETE', 'INCOMPLETE'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30"/>
          <p>No material requests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRequests.map(req => {
            const purchased = req.items.filter(i => i.isPurchased).length;
            const total = req.items.length;
            const pct = total ? Math.round((purchased / total) * 100) : 0;
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{req.title}</h3>
                    {req.projectName && <p className="text-xs text-gray-500">{req.projectName}{req.location ? ` · ${req.location}` : ''}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${STATUS_COLORS[req.status]}`}>{req.status.replace('_',' ')}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>👤 {req.assignedTo?.firstName} {req.assignedTo?.lastName}</span>
                  <span className="ml-auto">{total} items</span>
                </div>

                {total > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Delivered</span><span>{purchased}/{total} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDetailReq(req)} className="flex-1 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors">View Details</button>
                  {canCreate && (
                    <>
                      <button onClick={() => openEdit(req)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"><Edit size={14}/></button>
                      <button onClick={() => { if(confirm('Delete this request?')) deleteRequest(req.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"><Trash2 size={14}/></button>
                    </>
                  )}
                  {!canCreate && req.status !== 'COMPLETE' && req.status !== 'INCOMPLETE' && (
                    <>
                      <button onClick={() => setStatusModal({ id: req.id, targetStatus: 'COMPLETE' })} className="flex-1 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 rounded-lg text-green-700 transition-colors">✓ Complete</button>
                      <button onClick={() => setStatusModal({ id: req.id, targetStatus: 'INCOMPLETE' })} className="flex-1 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 rounded-lg text-red-700 transition-colors">✗ Incomplete</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {detailReq && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={() => setDetailReq(null)}>
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg">{detailReq.title}</h2>
                <p className="text-sm text-gray-500">{detailReq.projectName} {detailReq.location && `· ${detailReq.location}`}</p>
              </div>
              <button onClick={() => setDetailReq(null)}><X size={20} className="text-gray-400 hover:text-black"/></button>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <div className="flex gap-3 text-sm">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[detailReq.status]}`}>{detailReq.status.replace('_',' ')}</span>
                <span className="text-gray-500">Assigned to: <strong>{detailReq.assignedTo?.firstName} {detailReq.assignedTo?.lastName}</strong></span>
              </div>
              {detailReq.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{detailReq.notes}</p>}

              {/* Items table */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><ShoppingCart size={15}/> Materials ({detailReq.items.length})</h3>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Remarks</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detailReq.items.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{item.itemName}</td>
                          <td className="px-3 py-2 text-gray-500">{item.itemCode || '—'}</td>
                          <td className="px-3 py-2">{Number(item.quantity)}</td>
                          <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                          <td className="px-3 py-2 text-gray-400 italic">{item.notes || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center gap-1">
                              <button
                                disabled={saving}
                                onClick={async () => {
                                  if (item.isPurchased) return;
                                  setSaving(true);
                                  try {
                                    await toggleItemPurchased(detailReq.id, item.id, true, '');
                                    setDetailReq(prev => ({
                                      ...prev,
                                      items: prev.items.map(i => i.id === item.id ? { ...i, isPurchased: true } : i)
                                    }));
                                  } catch (e) { alert(e.message); }
                                  setSaving(false);
                                }}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${item.isPurchased ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                              >
                                Sent
                              </button>
                              <button
                                disabled={saving}
                                onClick={async () => {
                                  if (!item.isPurchased) return;
                                  setSaving(true);
                                  try {
                                    await toggleItemPurchased(detailReq.id, item.id, false, '');
                                    setDetailReq(prev => ({
                                      ...prev,
                                      items: prev.items.map(i => i.id === item.id ? { ...i, isPurchased: false } : i)
                                    }));
                                  } catch (e) { alert(e.message); }
                                  setSaving(false);
                                }}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${!item.isPurchased ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                              >
                                Not Sent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Completion info */}
              {detailReq.completionNote && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">Completion Note</p>
                  <p className="text-sm text-gray-700">{detailReq.completionNote}</p>
                </div>
              )}
              {detailReq.failureReason && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-xs font-bold text-red-700 mb-1">Failure Reason</p>
                  <p className="text-sm text-gray-700">{detailReq.failureReason}</p>
                </div>
              )}

              {!canCreate && detailReq.status !== 'COMPLETE' && detailReq.status !== 'INCOMPLETE' && (
                <div className="space-y-3 pt-2">
                  <button onClick={() => markAllSent(detailReq)}
                    className="w-full py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2">
                    <CheckCircle size={14}/> Mark All Items as Sent
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => { setStatusModal({ id: detailReq.id, targetStatus: 'COMPLETE' }); setDetailReq(null); }}
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                      ✓ Request Completion
                    </button>
                    <button onClick={() => { setStatusModal({ id: detailReq.id, targetStatus: 'INCOMPLETE' }); setDetailReq(null); }}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                      ✗ Mark Incomplete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-lg">{editingReq ? 'Edit Request' : 'New Material Request'}</h2>
              <button onClick={resetCreate}><X size={20} className="text-gray-400 hover:text-black"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold block mb-1">Title *</label>
                  <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-green-500 outline-none" placeholder="e.g. Solar Dryer Project Phase 2"/>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Project Name</label>
                  <input value={form.projectName} onChange={e => setForm({...form, projectName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-green-500 outline-none"/>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Location</label>
                  <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-green-500 outline-none"/>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold block mb-1">Assign To *</label>
                  <select value={form.assignedToId} onChange={e => setForm({...form, assignedToId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-green-500 outline-none">
                    <option value="">— Select Employee —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold block mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-green-500 outline-none resize-none"/>
                </div>
              </div>

              {/* Material catalog — tabbed by sheet */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-800">Select Materials from Catalog</h3>
                  {Object.keys(selectedItems).length > 0 && (
                    <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                      ✓ {Object.keys(selectedItems).length} selected
                    </span>
                  )}
                </div>

                {/* Sheet tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-3">
                  {[
                    { key: 'dc',    label: '🔩 DC Raw Materials' },
                    { key: 'dryer', label: '☀️ Dryer Components' },
                  ].map(t => (
                    <button key={t.key} type="button" onClick={() => setCatFilter(t.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                        catFilter === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Catalog table */}
                <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[450px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className={`text-gray-500 uppercase sticky top-0 ${catFilter === 'dryer' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <tr>
                        <th className="px-3 py-2 w-8">
                          <input type="checkbox" 
                            checked={catalogRows.length > 0 && catalogRows.every(m => !!selectedItems[m.id])}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Item Name</th>
                        <th className="px-3 py-2 text-left">Code</th>
                        {catFilter === 'dc' && <th className="px-3 py-2 text-left">Category</th>}
                        <th className="px-3 py-2 text-left w-16">Qty</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {catalogRows.length === 0 ? (
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No items found.</td></tr>
                      ) : (
                        (() => {
                          let lastSection = null;
                          return catalogRows.map(m => {
                            const sel = selectedItems[m.id];
                            const sectionHeading = (catFilter === 'dc' && subCat === 'ALL' && m.projectSite && m.projectSite !== lastSection) ? (
                              <tr key={`sec-${m.projectSite}`} className="bg-gray-50/80">
                                <td colSpan={8} className="px-3 py-1.5 text-[9px] font-black text-red-600 uppercase tracking-widest border-y border-gray-100">
                                  {m.projectSite}
                                </td>
                              </tr>
                            ) : null;
                            if (m.projectSite) lastSection = m.projectSite;

                            return (
                              <div key={`group-${m.id}`} style={{ display: 'contents' }}>
                                {sectionHeading}
                                <tr className={`hover:bg-gray-50 transition-colors ${sel ? 'bg-green-50' : ''}`}>
                                  <td className="px-3 py-2">
                                    <input type="checkbox" checked={!!sel} onChange={() => toggleItemSelect(m)} className="rounded"/>
                                  </td>
                                  <td className="px-3 py-2 font-medium text-gray-800">{m.itemName || m.name}</td>
                                  <td className="px-3 py-2 font-mono text-gray-500">{m.itemCode || '—'}</td>
                                  {catFilter === 'dc' && <td className="px-3 py-2 text-gray-400">{m.category}</td>}
                                  <td className="px-3 py-2">
                                    {sel ? (
                                      <input type="number" min="1" value={sel.qty}
                                        onChange={e => setSelectedItems(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: e.target.value } }))}
                                        className="w-14 px-2 py-1 border rounded text-xs focus:border-green-500 outline-none"
                                      />
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500 uppercase">{m.unit}</td>
                                  <td className="px-3 py-2">
                                    {sel ? (
                                      <input type="text" placeholder="Remarks..." value={sel.notes}
                                        onChange={e => setSelectedItems(prev => ({ ...prev, [m.id]: { ...prev[m.id], notes: e.target.value } }))}
                                        className="w-full px-2 py-1 border rounded text-[10px] focus:border-green-500 outline-none"
                                      />
                                    ) : (
                                      <span className="text-gray-400 text-[10px] truncate max-w-[100px] inline-block">{m.remarks || '—'}</span>
                                    )}
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
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={resetCreate} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editingReq ? 'Update Request' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Update Modal ── */}
      {statusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-4">
              {statusModal.targetStatus === 'COMPLETE' ? '✓ Mark as Complete' : '✗ Mark as Incomplete'}
            </h2>
            <label className="text-xs font-semibold block mb-1">
              {statusModal.targetStatus === 'COMPLETE' ? 'Completion Note (optional)' : 'Reason for Incomplete *'}
            </label>
            <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-green-500 outline-none resize-none mb-4"
              placeholder={statusModal.targetStatus === 'COMPLETE' ? 'Any notes about completion…' : 'Describe the issue or blocker…'}
            />

            {/* Voice Recorder UI */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                <Mic size={10}/> Voice Note {statusModal.targetStatus === 'INCOMPLETE' && '*'}
              </p>
              
              <div className="flex items-center gap-3">
                {!isRecording && !audioUrl && (
                  <button onClick={startRecording} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                    <Mic size={14}/> Start Recording
                  </button>
                )}
                {isRecording && (
                  <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold animate-pulse">
                    <Square size={14}/> Stop Recording
                  </button>
                )}
                {audioUrl && (
                  <div className="flex items-center gap-2 w-full">
                    <audio src={audioUrl} controls className="h-8 flex-1" />
                    <button onClick={() => { setAudioUrl(null); setAudioBlob(null); }} className="p-2 text-gray-400 hover:text-red-500">
                      <RefreshCw size={14}/>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStatusModal(null); setStatusNote(''); }} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleStatusSubmit}
                className={`flex-1 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors ${statusModal.targetStatus === 'COMPLETE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

    </Layout>
  );
}
