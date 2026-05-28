import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { usePurchaseStore } from '../stores/purchaseStore';
import { Plus, Search, Filter, FileText, FileSpreadsheet, File, Truck, ShoppingBag, Edit } from 'lucide-react';
import useFYStore from '../stores/fyStore';

const STATUS_COLORS = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  ORDERED:   'bg-blue-100 text-blue-800',
  RECEIVED:  'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const fmtMoney = (v) => '₹' + Number(v||0).toLocaleString('en-IN', {minimumFractionDigits: 2});
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : '-';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const {
    purchaseOrders, isLoading, poPagination,
    fetchPurchaseOrders, updatePurchaseOrder,
    downloadPODOCX, downloadPOXLSX
  } = usePurchaseStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const selectedFY = useFYStore(state => state.selectedFY);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [selectedFY]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPurchaseOrders({ search, status: statusFilter });
  };

  const handleDownloadPDF = async (poId, poNumber) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase/${poId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `PO-${poNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to download PO PDF.'); }
  };

  const handleDownloadDOCX = (poId, poNumber) => downloadPODOCX(poId, poNumber);
  const handleDownloadXLSX = (poId, poNumber) => downloadPOXLSX(poId, poNumber);

  const updateStatus = async (id, status) => {
    await updatePurchaseOrder(id, { status, ...(status === 'RECEIVED' ? { receivedDate: new Date() } : {}) });
    fetchPurchaseOrders();
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage POs and track incoming stock</p>
        </div>
        <div className="flex gap-3">
          <Link to="/purchase/items" className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
            Manage Items
          </Link>
          <button
            onClick={() => navigate('/purchase/new')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
          >
            <Plus size={18} /> New PO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="PO#, Vendor Name..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Status</option>
              {['PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg transition-colors">
            <Filter size={15} /> Apply
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <ShoppingBag size={36} className="mb-2 opacity-40" />
            <p>No purchase orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Exp. Delivery</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {purchaseOrders.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50 text-gray-700">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{po.poNumber}</td>
                    <td className="px-4 py-3 font-medium">
                      {po.vendor?.companyName || (() => { try { return JSON.parse(po.notes||'{}').vendorName || '—'; } catch { return '—'; } })()}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{fmtMoney(po.totalAmount)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(po.orderDate)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(po.expectedDate)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={po.status}
                        onChange={(e) => updateStatus(po.id, e.target.value)}
                        className={`text-xs font-semibold px-2 py-1 rounded outline-none cursor-pointer ${STATUS_COLORS[po.status]}`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="ORDERED">ORDERED</option>
                        <option value="RECEIVED">RECEIVED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownloadPDF(po.id, po.poNumber)}
                          title="Download PDF"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors font-medium"
                        >
                          <File size={13} /> PDF
                        </button>

                        <button
                          onClick={() => navigate(`/purchase/edit/${po.id}`)}
                          title="Edit PO"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors font-medium"
                        >
                          <Edit size={13} /> Edit
                        </button>

                        <button
                          onClick={() => handleDownloadXLSX(po.id, po.poNumber)}
                          title="Download XLSX"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors font-medium"
                        >
                          <FileSpreadsheet size={13} /> XLSX
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
