import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useSaleStore } from '../stores/saleStore';
import { useAuthStore } from '../stores/authStore';
import {
  Plus, Search, Filter, Eye, Download, IndianRupee,
  RefreshCw, ShoppingCart, CheckCircle, Clock, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  PENDING:     'bg-yellow-100 text-yellow-800',
  CONFIRMED:   'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  COMPLETED:   'bg-green-100 text-green-800',
  CANCELLED:   'bg-red-100 text-red-800',
};

const PAYMENT_COLORS = {
  UNPAID:  'bg-red-100 text-red-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID:    'bg-green-100 text-green-700',
  OVERDUE: 'bg-orange-100 text-orange-700',
};

const fmtMoney = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function Sales() {
  const navigate = useNavigate();
  const { sales, isLoading, pagination, fetchSales, updateSale } = useSaleStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  useEffect(() => {
    fetchSales();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchSales({ search, status: statusFilter, paymentStatus: paymentFilter });
  };

  const handleDownloadInvoice = async (saleId, saleNumber) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/sales/${saleId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${saleNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download invoice.');
    }
  };

  const handleExportExcel = () => {
    const rows = sales.map(s => ({
      'Invoice #': s.saleNumber,
      'Customer': s.customer?.contactName,
      'Company': s.customer?.companyName || '',
      'Date': fmtDate(s.saleDate),
      'Total Amount': Number(s.totalAmount || 0),
      'Paid Amount': Number(s.paidAmount || 0),
      'Balance': Number(s.balanceAmount || 0),
      'Status': s.status,
      'Payment Status': s.paymentStatus,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `Sales_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Stat cards
  const totalRevenue = sales.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
  const totalPaid    = sales.reduce((s, x) => s + Number(x.paidAmount || 0), 0);
  const countPaid    = sales.filter(x => x.paymentStatus === 'PAID').length;
  const countPending = sales.filter(x => x.paymentStatus !== 'PAID').length;

  return (
    <Layout>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage invoices, payments, and order status</p>
        </div>
        <div className="flex gap-3">
          <button
            id="export-sales-btn"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600" /> Export Excel
          </button>
          <button
            id="btn-new-sale"
            onClick={() => navigate('/sales/new')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
          >
            <Plus size={18} />
            New Sale
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: fmtMoney(totalRevenue), icon: IndianRupee, color: 'bg-green-500' },
          { label: 'Amount Received', value: fmtMoney(totalPaid), icon: CheckCircle, color: 'bg-blue-500' },
          { label: 'Fully Paid', value: countPaid, icon: CheckCircle, color: 'bg-emerald-500' },
          { label: 'Payment Pending', value: countPending, icon: Clock, color: 'bg-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
            <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Invoice #, customer name, phone..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sale Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Status</option>
              {['PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Payment</label>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Payments</option>
              {['UNPAID','PARTIAL','PAID','OVERDUE'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg transition-colors"
          >
            <Filter size={15} />
            Apply
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); setStatusFilter(''); setPaymentFilter(''); fetchSales(); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={15} />
            Reset
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <ShoppingCart size={36} className="mb-2 opacity-40" />
            <p>No sales found</p>
            <button onClick={() => navigate('/sales/new')} className="mt-2 text-sm text-green-600 hover:underline">
              Create your first sale →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100">
                  {['Invoice #', 'Customer', 'Date', 'Amount', 'Paid', 'Balance', 'Status', 'Payment', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{sale.saleNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sale.customer.contactName}</div>
                      {sale.customer.companyName && <div className="text-xs text-gray-500">{sale.customer.companyName}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(sale.saleDate)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fmtMoney(sale.totalAmount)}</td>
                    <td className="px-4 py-3 text-green-700 font-medium">{fmtMoney(sale.paidAmount)}</td>
                    <td className="px-4 py-3 text-red-600 font-medium">{fmtMoney(sale.balanceAmount)}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <select
                          value={sale.status}
                          onChange={(e) => updateSale(sale.id, { status: e.target.value })}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-400 ${STATUS_COLORS[sale.status] || 'bg-gray-100 text-gray-800'}`}
                          style={{ appearance: 'none', cursor: 'pointer' }}
                        >
                          {['PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED'].map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[sale.status] || 'bg-gray-100 text-gray-800'}`}>
                          {sale.status.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PAYMENT_COLORS[sale.paymentStatus] || ''}`}>
                        {sale.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          id={`view-sale-${sale.id}`}
                          onClick={() => navigate(`/sales/${sale.id}`)}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View Sale"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          id={`invoice-${sale.id}`}
                          onClick={() => handleDownloadInvoice(sale.id, sale.saleNumber)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download Invoice"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card stack */}
            <div className="md:hidden divide-y divide-gray-100">
              {sales.map(sale => (
                <div key={sale.id} className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono font-bold text-gray-900">{sale.saleNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PAYMENT_COLORS[sale.paymentStatus] || ''}`}>{sale.paymentStatus}</span>
                  </div>
                  <p className="font-medium text-gray-800">{sale.customer.contactName}</p>
                  <p className="text-sm text-gray-500">{fmtDate(sale.saleDate)} · {fmtMoney(sale.totalAmount)}</p>
                  <p className="text-sm">
                    <span className="text-green-600 font-medium">Paid:{fmtMoney(sale.paidAmount)}</span>
                    <span className="text-red-500 font-medium ml-3">Due:{fmtMoney(sale.balanceAmount)}</span>
                  </p>
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => navigate(`/sales/${sale.id}`)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium">
                      <Eye size={13} /> View
                    </button>
                    <button onClick={() => handleDownloadInvoice(sale.id, sale.saleNumber)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium">
                      <Download size={13} /> Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {sales.length} of {pagination.total} sales
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchSales({ page: pagination.page - 1 })}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchSales({ page: pagination.page + 1 })}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
