import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useMaterialStore } from '../stores/materialStore';
import api from '../services/api';
import { 
  Plus, Search, Edit2, Trash2, AlertTriangle, 
  Package, X, Calendar, MapPin, Tag, Info, CheckCircle2
} from 'lucide-react';

const Inventory = () => {
  const { materials, isLoading, fetchMaterials, createMaterial, updateMaterial, deleteMaterial } = useMaterialStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [submitError, setSubmitError] = useState('');

  // Item code stock lookup state (aggregated across ALL records with the same code)
  const [stockLookup, setStockLookup] = useState(null);
  // { found, itemName, unit, totalStock, totalInQty, totalOutQty, recordCount, breakdown[] }
  const [lookingUp, setLookingUp] = useState(false);
  const lookupTimer = useRef(null);

  const initialFormData = {
    itemName: '', 
    itemCode: '', 
    category: '', 
    unit: 'Nos', 
    balance: 0, 
    minQuantity: 0, 
    rate: 0,
    inQty: 0,
    outQty: 0,
    location: '',
    projectSite: '',
    remarks: '',
    date: new Date().toISOString().split('T')[0]
  };

  const [formData, setFormData] = useState(initialFormData);

  const units = ['Nos', 'Kg', 'Meter', 'Liter', 'Set', 'Box', 'Roll', 'Pair', 'Ton'];

  useEffect(() => {
    fetchMaterials({ search: searchTerm, status: filter === 'LOW_STOCK' ? 'LOW_STOCK' : undefined });
  }, [searchTerm, filter]);

  // Debounced item code lookup using the aggregation endpoint (only on Add, not Edit)
  const handleItemCodeChange = (value) => {
    setFormData(prev => ({ ...prev, itemCode: value }));
    setStockLookup(null);

    if (editingMaterial) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!value || value.length < 2) return;

    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await api.get(`/materials/stock-summary?itemCode=${encodeURIComponent(value)}`);
        const d = res.data;
        if (d.found) {
          setStockLookup(d);
        } else {
          setStockLookup(null);
        }
      } catch {
        setStockLookup(null);
      }
      setLookingUp(false);
    }, 500);
  };

  const handleOpenModal = (material = null) => {
    setStockLookup(null);
    setSubmitError('');
    if (material) {
      setEditingMaterial(material);
      setFormData({
        itemName: material.itemName,
        itemCode: material.itemCode || '',
        category: material.category || '',
        unit: material.unit || 'Nos',
        balance: Number(material.balance),
        minQuantity: Number(material.minQuantity),
        rate: Number(material.rate),
        inQty: Number(material.inQty) || 0,
        outQty: Number(material.outQty) || 0,
        location: material.location || '',
        projectSite: material.projectSite || '',
        remarks: material.remarks || '',
        date: (material.date && !isNaN(new Date(material.date).getTime())) 
          ? new Date(material.date).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingMaterial(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    let result;
    if (editingMaterial) {
      result = await updateMaterial(editingMaterial.id, formData);
    } else {
      result = await createMaterial(formData);
    }
    if (result?.success === false) {
      setSubmitError(result.error || 'Failed to save. Please try again.');
      return;
    }
    setIsModalOpen(false);
    fetchMaterials();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      await deleteMaterial(id);
    }
  };

  const getStatusColor = (qty, min) => {
    if (Number(qty) <= 0) return 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800';
    if (Number(qty) <= Number(min)) return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800';
    return 'text-green-600 bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800';
  };

  const totalStockValue = (materials || []).reduce((s, m) => s + (Number(m?.totalValue) || 0), 0);

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Comprehensive stock tracking based on project requirements.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus size={18} /> Add New Material
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <Package size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Items</p>
            <p className="text-xl font-bold dark:text-white">{materials.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Low Stock</p>
            <p className="text-xl font-bold dark:text-white">
              {(materials || []).filter(m => Number(m?.balance || 0) <= Number(m?.minQuantity || 0) && Number(m?.balance || 0) > 0).length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600">
            <X size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Out of Stock</p>
            <p className="text-xl font-bold dark:text-white">
              {(materials || []).filter(m => Number(m?.balance || 0) <= 0).length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Value</p>
            <p className="text-xl font-bold dark:text-white">₹{totalStockValue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, item code, location or site..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">All Stock</option>
              <option value="LOW_STOCK">Low Stock Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Item Code / Name</th>
                <th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold text-right">In Qty</th>
                <th className="px-4 py-3 font-bold text-right">Out Qty</th>
                <th className="px-4 py-3 font-bold text-right">Stock in Hand</th>
                <th className="px-4 py-3 font-bold text-right">Rate</th>
                <th className="px-4 py-3 font-bold text-right">Total Value</th>
                <th className="px-4 py-3 font-bold">Location / Site</th>
                <th className="px-4 py-3 font-bold text-center">Status</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading && materials.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-10 text-center text-gray-500">Loading materials...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-10 text-center text-gray-500">No materials found.</td>
                </tr>
              ) : (
                (materials || []).map((m) => (
                  <tr key={m?.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm">
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {m.date ? new Date(m.date).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 dark:text-white">{m.itemName}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{m.itemCode || 'No Code'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded font-medium">
                        {m.category || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{m.inQty}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-medium">{m.outQty}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-gray-900 dark:text-white">{m.balance}</div>
                      <div className="text-[10px] text-gray-400 uppercase">{m.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      ₹{(Number(m.rate) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 dark:text-green-400">
                      ₹{(Number(m.totalValue) || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1">
                        <MapPin size={10} className="text-gray-400" /> {m.location || 'N/A'}
                      </div>
                      <div className="text-[10px] text-blue-500 font-medium">{m.projectSite || 'Stock'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(m?.balance || 0, m?.minQuantity || 0)}`}>
                          {Number(m?.balance || 0) <= 0 ? 'OUT' : Number(m?.balance || 0) <= Number(m?.minQuantity || 0) ? 'LOW' : 'GOOD'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                  <Package size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {editingMaterial ? 'Edit Inventory Item' : 'Add Inventory Item'}
                  </h2>
                  <p className="text-xs text-gray-500">Enter item details correctly to maintain stock accuracy.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-2">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                  <Info size={14} className="shrink-0" /> {submitError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-h-[60vh] overflow-y-auto px-1 pr-3 custom-scrollbar">
                
                {/* General Info */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                      <Tag size={12} /> Item Name*
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all shadow-sm"
                      placeholder="e.g. Solar Panel 400W"
                      value={formData.itemName}
                      onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Item Code</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm"
                        placeholder="SP-400"
                        value={formData.itemCode}
                        onChange={(e) => handleItemCodeChange(e.target.value)}
                      />
                      {/* Stock lookup result — aggregated across ALL locations */}
                      {lookingUp && (
                        <p className="mt-1 text-[10px] text-gray-400 animate-pulse">Checking stock across all locations...</p>
                      )}
                      {!lookingUp && stockLookup && (
                        <div className="mt-2 border border-amber-200 bg-amber-50 rounded-xl p-2.5 text-[10px]">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                            <span className="text-amber-800 font-bold">
                              {stockLookup.itemName} — Total Stock: {stockLookup.totalStock} {stockLookup.unit}
                              <span className="text-amber-600 font-normal ml-1">
                                ({stockLookup.recordCount} {stockLookup.recordCount === 1 ? 'location' : 'locations'})
                              </span>
                            </span>
                          </div>
                          {stockLookup.breakdown.map((r, i) => (
                            <div key={r.id} className="flex justify-between items-center py-0.5 border-t border-amber-100 text-amber-700">
                              <span className="truncate max-w-[120px]">{r.location} / {r.projectSite}</span>
                              <span className="font-bold ml-1 shrink-0">
                                {r.balance} {r.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Category</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm"
                        placeholder="Panels"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                        <MapPin size={12} /> Location
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm"
                        placeholder="Warehouse A"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Project / Site</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm"
                        placeholder="Solar Hub"
                        value={formData.projectSite}
                        onChange={(e) => setFormData({...formData, projectSite: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Sidebar Fields */}
                <div className="space-y-4 md:border-l md:border-gray-100 md:dark:border-gray-700 md:pl-5">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                      <Calendar size={12} /> Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Unit Of Measure</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm"
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    >
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                      value={formData.rate}
                      onChange={(e) => setFormData({...formData, rate: e.target.value})}
                    />
                  </div>
                </div>

                {/* Quantitative Fields */}
                <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-gray-50 dark:border-gray-700 mt-2">
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1.5">In Qty</label>
                    <input
                      type="number"
                      className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 outline-none"
                      value={formData.inQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev, 
                          inQty: val,
                          balance: (Number(val) || 0) - (Number(prev.outQty) || 0)
                        }));
                      }}
                    />
                  </div>
                  <div className="bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-1.5">Out Qty</label>
                    <input
                      type="number"
                      className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 outline-none"
                      value={formData.outQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev, 
                          outQty: val,
                          balance: (Number(prev.inQty) || 0) - (Number(val) || 0)
                        }));
                      }}
                    />
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-1.5">Stock in Hand</label>
                    <input
                      type="number"
                      className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800 outline-none font-bold"
                      value={formData.balance}
                      onChange={(e) => setFormData({...formData, balance: e.target.value})}
                    />
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1.5">Min Level</label>
                    <input
                      type="number"
                      className="w-full bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-800 outline-none"
                      value={formData.minQuantity}
                      onChange={(e) => setFormData({...formData, minQuantity: e.target.value})}
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="md:col-span-3">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                    <Info size={12} /> Remarks
                  </label>
                  <textarea
                    rows="2"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 outline-none shadow-sm"
                    placeholder="General remarks or notes..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  ></textarea>
                </div>

              </div>
              
              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] px-4 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : editingMaterial ? 'Save Changes' : 'Confirm & Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Inventory;
