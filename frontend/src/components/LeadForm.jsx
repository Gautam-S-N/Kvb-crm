import { useState, useEffect } from 'react';
import { useLeadStore } from '../stores/leadStore';
import { useProductStore } from '../stores/productStore';
import { Search, X, Package } from 'lucide-react';

const LeadForm = ({ onClose, onSuccess }) => {
  const { createLead, checkDuplicate, isLoading, error, clearError } = useLeadStore();
  const { products, fetchProducts } = useProductStore();
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Selected products: [{ productId, name, basePrice, quantity }]
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    source: 'WEBSITE',
    estimateAmount: '',
    closeDate: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCompany: '',
    customerAddress: '',
    customerCity: '',
    customerState: '',
    customerPincode: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    clearError();
    setDuplicateWarning(null);
  };

  const handlePhoneBlur = async () => {
    if (formData.customerPhone) {
      const result = await checkDuplicate(formData.customerPhone, formData.customerEmail);
      if (result.exists) setDuplicateWarning(result.data);
    }
  };

  const handleSelectProduct = (product) => {
    if (selectedProducts.find(p => p.productId === product.id)) return;
    setSelectedProducts(prev => [...prev, { productId: product.id, name: product.name, basePrice: product.basePrice, quantity: 1 }]);
    setShowProductPicker(false);
    setProductSearch('');
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleQtyChange = (productId, qty) => {
    setSelectedProducts(prev =>
      prev.map(p => p.productId === productId ? { ...p, quantity: Math.max(1, parseInt(qty) || 1) } : p)
    );
  };

  const filteredProducts = products.filter(p =>
    p.isActive && p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      products: selectedProducts.map(p => ({ productId: p.productId, quantity: p.quantity }))
    };
    const result = await createLead(payload);
    if (result.success) {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create New Lead</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fill in details to start tracking this opportunity</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
              <p className="font-semibold">⚠️ Existing customer: {duplicateWarning.contactName}</p>
              <p className="mt-0.5">Phone: {duplicateWarning.phone} — this lead will be linked to them.</p>
            </div>
          )}

          {/* Lead Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Lead Title <span className="text-red-500">*</span></label>
              <input type="text" name="title" required value={formData.title} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea name="description" rows="2" value={formData.description} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Source</label>
              <select name="source" value={formData.source} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
                <option value="WEBSITE">Website</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="GOOGLE">Google</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="JUSTDIAL">JustDial</option>
                <option value="REFERRAL">Referral</option>
                <option value="WALK_IN">Walk In</option>
                <option value="FIELD_MARKETING">Field Marketing</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Estimated Amount (₹)</label>
              <input type="number" name="estimateAmount" value={formData.estimateAmount} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
            </div>
          </div>

          {/* Customer Info */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Name <span className="text-red-500">*</span></label>
                <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                <input type="tel" name="customerPhone" required value={formData.customerPhone}
                  onChange={handleChange} onBlur={handlePhoneBlur}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input type="email" name="customerEmail" value={formData.customerEmail} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
                <input type="text" name="customerCompany" value={formData.customerCompany} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                <input type="text" name="customerCity" value={formData.customerCity} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                <input type="text" name="customerState" value={formData.customerState} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
            </div>
          </div>

          {/* Interested Products */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Interested Products</h3>
                <p className="text-xs text-gray-500 mt-0.5">Optional — select products the customer is interested in</p>
              </div>
              <button type="button" onClick={() => setShowProductPicker(!showProductPicker)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors">
                <Package size={14} /> Add Product
              </button>
            </div>

            {showProductPicker && (
              <div className="mb-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={productSearch} onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">No products found</p>
                  ) : filteredProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => handleSelectProduct(p)}
                      disabled={!!selectedProducts.find(s => s.productId === p.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                        selectedProducts.find(s => s.productId === p.id)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'hover:bg-orange-100 bg-white text-gray-800'
                      }`}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-gray-500">₹{Number(p.basePrice).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedProducts.length > 0 ? (
              <div className="space-y-2">
                {selectedProducts.map(p => (
                  <div key={p.productId} className="flex items-center gap-3 bg-white border border-orange-100 rounded-lg px-3 py-2">
                    <div className="w-7 h-7 bg-orange-100 rounded-md flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">₹{Number(p.basePrice).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 font-medium">Qty:</label>
                      <input type="number" min="1" value={p.quantity}
                        onChange={e => handleQtyChange(p.productId, e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    </div>
                    <button type="button" onClick={() => handleRemoveProduct(p.productId)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 border-2 border-dashed border-gray-200 rounded-xl">
                <Package size={24} className="mx-auto text-gray-300 mb-1" />
                <p className="text-sm text-gray-400">No products added yet</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 shadow-sm">
              {isLoading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadForm;