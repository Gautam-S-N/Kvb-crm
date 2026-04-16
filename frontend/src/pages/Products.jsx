import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useProductStore } from '../stores/productStore';
import {
  Package, Plus, Search, Edit3, Trash2, X, Loader2,
  Tag, IndianRupee, Layers, ToggleLeft, ToggleRight, Check
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────── */
const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const UOM_OPTIONS = ['Units', 'kW', 'kWp', 'Nos', 'Sets', 'Meters', 'Sq.ft', 'Kg', 'Liters', 'Hours'];

const CATEGORY_COLORS = {
  'Solar Panel':      'bg-yellow-100 text-yellow-800',
  'Inverter':         'bg-blue-100 text-blue-800',
  'Battery':          'bg-emerald-100 text-emerald-800',
  'Installation':     'bg-purple-100 text-purple-800',
  'Accessories':      'bg-pink-100 text-pink-800',
  'Maintenance':      'bg-orange-100 text-orange-800',
};
const catColor = (cat) => CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600';

const EMPTY_FORM = {
  name: '',
  description: '',
  sku: '',
  category: '',
  unitOfMeasure: 'Units',
  basePrice: '',
  taxRate: '18',
  hsnCode: '',
  isActive: true,
};

/* ─── Product Form Modal ──────────────────────────── */
function ProductModal({ open, onClose, onSubmit, initial, isSaving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      if (initial) {
        setForm({
          name:          initial.name || '',
          description:   initial.description || '',
          sku:           initial.sku || '',
          category:      initial.category || '',
          unitOfMeasure: initial.unitOfMeasure || 'Units',
          basePrice:     initial.basePrice != null ? String(initial.basePrice) : '',
          taxRate:       initial.taxRate != null ? String(initial.taxRate) : '18',
          hsnCode:       initial.hsnCode || '',
          isActive:      initial.isActive !== false,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, initial]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Product name is required.');
    if (!form.basePrice || isNaN(parseFloat(form.basePrice))) return setError('Base price must be a valid number.');
    onSubmit(form);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        style={{ animation: 'modalIn .25s cubic-bezier(.34,1.56,.64,1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <Package size={18} className="text-emerald-600" />
            {initial ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Product Name *</label>
            <input
              required autoFocus
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. 3kW On-Grid Solar System"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of what this product includes…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>

          {/* SKU + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">SKU / Code</label>
              <input
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. SOL-3KW-OG"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">HSN / SAC</label>
              <input
                value={form.hsnCode}
                onChange={e => setForm({ ...form, hsnCode: e.target.value })}
                placeholder="e.g. 8541"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Category</label>
              <input
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Solar Panel"
                list="category-list"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <datalist id="category-list">
                {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Price + Tax + UoM */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Base Price (₹) *</label>
              <input
                type="number" min="0" step="0.01"
                value={form.basePrice}
                placeholder="0.00"
                onChange={e => setForm({ ...form, basePrice: e.target.value })}
                onFocus={e => e.target.select()}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">GST Rate (%)</label>
              <input
                type="number" min="0" max="100"
                value={form.taxRate}
                onChange={e => setForm({ ...form, taxRate: e.target.value })}
                onFocus={e => e.target.select()}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Unit of Measure</label>
              <select
                value={form.unitOfMeasure}
                onChange={e => setForm({ ...form, unitOfMeasure: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                {UOM_OPTIONS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-700">Product Active</p>
              <p className="text-xs text-gray-400">Inactive products won't appear in sales/quotations</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${form.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
            >
              {form.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {form.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              type="submit" disabled={isSaving}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {initial ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Product Card ────────────────────────────────── */
function ProductCard({ product, onEdit, onDelete, onToggle }) {
  const cc = catColor(product.category);
  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col ${!product.isActive ? 'opacity-55 border-dashed' : 'border-gray-100'}`}>
      {/* Top strip */}
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${product.isActive ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <Package size={18} className={product.isActive ? 'text-emerald-600' : 'text-gray-400'} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{product.name}</h3>
              <div className="flex gap-2">
                {product.sku && (
                  <span className="text-[10px] text-gray-400 font-mono">SKU: {product.sku}</span>
                )}
                {product.hsnCode && (
                  <span className="text-[10px] text-emerald-600 font-mono">HSN: {product.hsnCode}</span>
                )}
              </div>
            </div>
          </div>
          {!product.isActive && (
            <span className="px-1.5 py-0.5 bg-gray-200 text-gray-500 text-[10px] font-bold rounded shrink-0">INACTIVE</span>
          )}
        </div>

        {product.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">{product.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {product.category && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cc}`}>{product.category}</span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 flex items-center gap-1">
            <Layers size={9} />{product.unitOfMeasure}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-700">
            GST {product.taxRate}%
          </span>
        </div>
      </div>

      {/* Price + actions footer */}
      <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-gray-400">Base Price</div>
          <div className="text-base font-bold text-emerald-700">{fmt(product.basePrice)}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(product)}
            title={product.isActive ? 'Deactivate' : 'Activate'}
            className={`p-2 rounded-lg transition-colors text-xs font-semibold ${product.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
          >
            {product.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
          </button>
          <button
            onClick={() => onEdit(product)}
            className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Edit3 size={15} />
          </button>
          <button
            onClick={() => onDelete(product)}
            className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────── */
export default function Products() {
  const { products, isLoading, fetchProducts } = useProductStore();
  const [search, setSearch]         = useState('');
  const [categoryFilter, setCat]    = useState('');
  const [activeFilter, setActive]   = useState('all'); // all / active / inactive
  const [modalOpen, setModalOpen]   = useState(false);
  const [editProduct, setEditProd]  = useState(null);
  const [isSaving, setIsSaving]     = useState(false);
  const [toast, setToast]           = useState(null);

  useEffect(() => { fetchProducts(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Derived filtered list
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase());
    const matchCat    = !categoryFilter || p.category === categoryFilter;
    const matchActive = activeFilter === 'all' || (activeFilter === 'active' ? p.isActive : !p.isActive);
    return matchSearch && matchCat && matchActive;
  });

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  const handleOpenAdd = () => { setEditProd(null); setModalOpen(true); };
  const handleOpenEdit = (p) => { setEditProd(p); setModalOpen(true); };

  const handleSubmit = async (form) => {
    setIsSaving(true);
    try {
      const import_api = (await import('../services/api')).default;

      if (editProduct) {
        await import_api.put(`/products/${editProduct.id}`, form);
        showToast('Product updated!');
      } else {
        await import_api.post('/products', form);
        showToast('Product added to catalogue!');
      }
      await fetchProducts();
      setModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    }
    setIsSaving(false);
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      const import_api = (await import('../services/api')).default;
      await import_api.delete(`/products/${product.id}`);
      await fetchProducts();
      showToast('Product deleted.', 'info');
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot delete — it may be in use.', 'error');
    }
  };

  const handleToggle = async (product) => {
    try {
      const import_api = (await import('../services/api')).default;
      await import_api.put(`/products/${product.id}`, { isActive: !product.isActive });
      await fetchProducts();
      showToast(product.isActive ? 'Product deactivated.' : 'Product activated!');
    } catch (err) {
      showToast('Failed to update status.', 'error');
    }
  };

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform:scale(.9) translateY(20px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .toast { animation: toastIn .3s cubic-bezier(.34,1.56,.64,1); }
        @keyframes toastIn {
          from { opacity:0; transform:translateY(20px) scale(.9); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>

      <Layout>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package size={24} className="text-emerald-500" />
                Product Catalogue
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage products that appear in Sales &amp; Quotations. Active products can be selected while creating a sale.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus size={18} /> Add Product
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Total Products', count: products.length,                         color: 'bg-gray-50 border-gray-200 text-gray-700' },
              { label: 'Active',         count: products.filter(p => p.isActive).length,  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { label: 'Inactive',       count: products.filter(p => !p.isActive).length, color: 'bg-amber-50 border-amber-200 text-amber-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} border rounded-xl px-4 py-3 text-center`}>
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCat(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white min-w-36"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              {['all', 'active', 'inactive'].map(v => (
                <button
                  key={v}
                  onClick={() => setActive(v)}
                  className={`px-4 py-2 font-medium capitalize transition-colors ${activeFilter === v ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
                <Package size={36} className="text-emerald-300" />
              </div>
              <div>
                <p className="font-bold text-gray-700">No products found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {products.length === 0
                    ? 'Add your first product to start building the catalogue.'
                    : 'Try adjusting your filters.'}
                </p>
              </div>
              {products.length === 0 && (
                <button onClick={handleOpenAdd} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
                  <Plus size={16} /> Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        <ProductModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          initial={editProduct}
          isSaving={isSaving}
        />

        {/* Toast */}
        {toast && (
          <div className={`toast fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl text-white ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-gray-700' : 'bg-emerald-700'}`}>
            {toast.msg}
          </div>
        )}
      </Layout>
    </>
  );
}
