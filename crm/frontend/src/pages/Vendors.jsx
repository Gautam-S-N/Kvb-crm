import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { usePurchaseStore } from '../stores/purchaseStore';
import { Plus, Search, Edit2, Trash2, Building2, User, Phone, Mail } from 'lucide-react';

export default function Vendors() {
  const { vendors, isLoading, vendorPagination, fetchVendors, createVendor, updateVendor, deleteVendor } = usePurchaseStore();
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    companyName: '', contactName: '', email: '', phone: '', address: '', gstNumber: ''
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVendors({ search });
  };

  const openForm = (vendor = null) => {
    if (vendor) {
      setEditingId(vendor.id);
      setFormData({
        companyName: vendor.companyName,
        contactName: vendor.contactName || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        gstNumber: vendor.gstNumber || ''
      });
    } else {
      setEditingId(null);
      setFormData({ companyName: '', contactName: '', email: '', phone: '', address: '', gstNumber: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await updateVendor(editingId, formData);
    } else {
      await createVendor(formData);
    }
    setShowModal(false);
    fetchVendors({ search }); // Refresh list
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      await deleteVendor(id);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your suppliers and vendors</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
        >
          <Plus size={18} />
          Add Vendor
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors by name, company, or phone..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg transition-colors">
            Search
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Building2 size={36} className="mb-2 opacity-40" />
            <p>No vendors found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Contact Details</th>
                  <th className="px-4 py-3">GST Number</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map(vendor => (
                  <tr key={vendor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-gray-400" />
                        {vendor.companyName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <User size={14} className="text-gray-400" />
                        {vendor.contactName || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs text-gray-600">
                        {vendor.phone && <span className="flex items-center gap-1"><Phone size={12}/>{vendor.phone}</span>}
                        {vendor.email && <span className="flex items-center gap-1"><Mail size={12}/>{vendor.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{vendor.gstNumber || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openForm(vendor)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-2" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(vendor.id, vendor.companyName)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-lg">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Company Name *</label>
                <input required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Contact Name</label>
                  <input value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Phone</label>
                  <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">GST Number</label>
                <input value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Address</label>
                <textarea rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 font-medium">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
