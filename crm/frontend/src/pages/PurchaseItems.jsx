import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { usePurchaseItemStore } from '../stores/purchaseItemStore';
import {
  Plus, Search, Edit2, Trash2, X, Save, Package, Tag,
  Hash, RefreshCw, ArrowLeft, CheckCircle
} from 'lucide-react';

const UNITS = ['Nos', 'Pcs', 'Set', 'Kg', 'g', 'm', 'cm', 'mm', 'ft', 'inch', 'L', 'ml', 'Box', 'Pair', 'Roll', 'Sheet'];

const empty = () => ({ name: '', hsnCode: '', description: '', unit: 'Nos', rate: '' });

export default function PurchaseItems() {
  const navigate = useNavigate();
  const { items, isLoading, fetchItems, createItem, updateItem, deleteItem } = usePurchaseItemStore();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchItems({ activeOnly: 'false' }); }, []);

  const filtered = items.filter(it =>
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    (it.hsnCode || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditId(null);
    setForm(empty());
    setError('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      hsnCode: item.hsnCode || '',
      description: item.description || '',
      unit: item.unit || 'Nos',
      rate: item.rate || ''
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Item name is required'); return; }
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(),
      hsnCode: form.hsnCode.trim() || null,
      description: form.description.trim() || null,
      unit: form.unit,
      rate: form.rate !== '' ? parseFloat(form.rate) : 0
    };
    const res = editId
      ? await updateItem(editId, payload)
      : await createItem(payload);
    setSaving(false);
    if (res.success) {
      setSuccess(editId ? 'Item updated!' : 'Item added!');
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    const res = await deleteItem(id);
    setDeleteConfirm(null);
    if (!res.success) setError(res.error || 'Cannot delete — item may be in use');
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchase')}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Items Catalog</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Items &amp; HSN codes used only in Purchase Orders
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow transition-colors"
        >
          <Plus size={18} /> Add Item
        </button>
      </div>

      {/* Success toast */}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && !showForm && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editId ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Item Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Solar Panel 400W"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">HSN Code</label>
                <input
                  value={form.hsnCode}
                  onChange={e => setForm(f => ({ ...f, hsnCode: e.target.value }))}
                  placeholder="e.g. 85414011"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Default Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Any extra details..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Item?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete <strong>{deleteConfirm.name}</strong>. Items currently used in purchase orders will not be affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by item name or HSN code..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Package size={40} className="mb-2 opacity-30" />
            <p className="font-medium">No items yet</p>
            <p className="text-sm mt-1">Add items to reuse them when creating Purchase Orders</p>
            <button
              onClick={openAdd}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
            >
              <Plus size={16} /> Add First Item
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Item Name', 'HSN Code', 'Default Rate', 'Description', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.name}</td>
                      <td className="px-4 py-3">
                        {item.hsnCode
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-mono font-medium">
                              <Hash size={10} />{item.hsnCode}
                            </span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {Number(item.rate) > 0
                          ? '₹' + Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                        {item.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(item)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map(item => (
                <div key={item.id} className="p-4 flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.hsnCode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                          <Hash size={9} />{item.hsnCode}
                        </span>
                      )}
                      {Number(item.rate) > 0 && (
                        <span className="text-xs text-gray-600 font-medium">
                          ₹{Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <button onClick={() => openEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteConfirm(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
