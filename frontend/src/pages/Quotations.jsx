import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useQuotationStore } from '../stores/quotationStore';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Download, RefreshCw, Search, ArrowRight,
  CheckCircle, Clock, Send, XCircle, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';

const STATUS_META = {
  DRAFT:              { label: 'Draft',             cls: 'bg-gray-100 text-gray-700' },
  SENT:               { label: 'Sent',              cls: 'bg-blue-100 text-blue-700' },
  ACCEPTED:           { label: 'Accepted',          cls: 'bg-green-100 text-green-700' },
  REJECTED:           { label: 'Rejected',          cls: 'bg-red-100 text-red-700' },
  CONVERTED_TO_SALE:  { label: 'Converted',         cls: 'bg-purple-100 text-purple-700' },
};

const fmtMoney = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Quotations() {
  const navigate = useNavigate();
  const { quotations, productSummary, isLoading, pagination, fetchQuotations, fetchProductSummary, downloadPDF, downloadDOCX, convertToSale } = useQuotationStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'products'
  const [expandedProducts, setExpandedProducts] = useState({});
  const [converting, setConverting] = useState(null);
  const isAdmin = user?.role === 'ADMIN';

  const toggleProduct = (idx) => {
    setExpandedProducts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    fetchQuotations();
    fetchProductSummary();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchQuotations({ search, status: statusFilter, page: 1 });
  };

  const handleConvert = async (q) => {
    if (q.status === 'CONVERTED_TO_SALE') return;
    // Navigate to the editable Create Sale form, pre-populating with quotation data
    navigate(`/sales/new?quotationId=${q.id}`);
  };

  const totalValue = quotations.reduce((s, q) => s + Number(q.totalAmount || 0), 0);
  const countAccepted = quotations.filter(q => q.status === 'ACCEPTED').length;
  const countConverted = quotations.filter(q => q.status === 'CONVERTED_TO_SALE').length;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quotations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            All customer quotations across leads
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Quotes Value', value: fmtMoney(totalValue), icon: FileText, color: 'bg-indigo-500' },
          { label: 'Total Quotations', value: quotations.length, icon: Send, color: 'bg-blue-500' },
          { label: 'Accepted', value: countAccepted, icon: CheckCircle, color: 'bg-green-500' },
          { label: 'Converted to Sale', value: countConverted, icon: ArrowRight, color: 'bg-purple-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4">
            <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Search Customer</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Customer name, quotation number..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Status</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-600 hover:bg-gray-900 text-white text-sm rounded-lg transition-colors">
            <Search size={15} /> Search
          </button>
          <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); fetchQuotations(); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm rounded-lg transition-colors">
            <RefreshCw size={15} /> Reset
          </button>
        </form>
      </div>

    {/* View Toggle */}
      <div className="flex gap-4 mb-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setViewMode('list')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${viewMode === 'list' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          All Quotations
        </button>
        <button
          onClick={() => setViewMode('products')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${viewMode === 'products' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Product Summary
        </button>
      </div>

      {viewMode === 'products' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : productSummary?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <FileText size={36} className="mb-2 opacity-40" />
              <p>No product data found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">Product Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">HSN Code</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500">Times Quoted</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500">Total Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">Total Value (Earnings)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {productSummary?.map((p, idx) => (
                    <React.Fragment key={idx}>
                      <tr onClick={() => toggleProduct(idx)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          {expandedProducts[idx] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                          {p.productName}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.hsnCode || '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-600 font-bold">{p.totalQuotations}</td>
                        <td className="px-4 py-3 text-center text-gray-600 font-bold">{p.totalQty}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(p.totalValue)}</td>
                      </tr>
                      {expandedProducts[idx] && p.documents?.length > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-900/30">
                          <td colSpan="5" className="px-8 py-3 border-t border-gray-100 dark:border-gray-700">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Quotations including this product</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {p.documents.map(doc => (
                                <div key={doc.id} onClick={() => { setViewMode('list'); setSearch(doc.number); fetchQuotations({ search: doc.number }); }} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-3 rounded-lg shadow-sm cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{doc.number}</span>
                                    <span className="text-gray-400 text-xs">{fmtDate(doc.date)}</span>
                                  </div>
                                  <div className="text-gray-800 dark:text-gray-200 font-medium mb-1 truncate">{doc.customer}</div>
                                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                                    <span>Qty: <span className="font-semibold">{doc.qty}</span></span>
                                    <span>Value: <span className="font-semibold">{fmtMoney(doc.value)}</span></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <FileText size={36} className="mb-2 opacity-40" />
            <p>No quotations found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    {['Quotation #', 'Lead', 'Customer', 'Items', 'Total', 'Valid Until', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {quotations.map(q => {
                    const sm = STATUS_META[q.status] || STATUS_META.DRAFT;
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">{q.quotationNumber}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{q.lead?.leadNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{q.customer?.contactName}</div>
                          {q.customer?.companyName && <div className="text-xs text-gray-500">{q.customer.companyName}</div>}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{q._count?.items ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{fmtMoney(q.totalAmount)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{fmtDate(q.validUntil)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sm.cls}`}>{sm.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              id={`download-pdf-${q.id}`}
                              onClick={() => downloadPDF(q.id, q.quotationNumber)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Download PDF"
                            >
                              <Download size={15} />
                            </button>
                            <button
                              id={`download-docx-${q.id}`}
                              onClick={() => downloadDOCX(q.id, q.quotationNumber)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Download DOCX"
                            >
                              <FileText size={15} />
                            </button>
                            {isAdmin && (
                              <button
                                id={`convert-sale-${q.id}`}
                                onClick={() => handleConvert(q)}
                                disabled={q.status === 'CONVERTED_TO_SALE' || converting === q.id}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  q.status === 'CONVERTED_TO_SALE'
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                                }`}
                                title={q.status === 'CONVERTED_TO_SALE' ? 'Already converted' : 'Convert to Sale (Admin only)'}
                              >
                                {converting === q.id
                                  ? <RefreshCw size={15} className="animate-spin" />
                                  : <ArrowRight size={15} />
                                }
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {quotations.map(q => {
                const sm = STATUS_META[q.status] || STATUS_META.DRAFT;
                return (
                  <div key={q.id} className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono font-bold text-gray-900 dark:text-white">{q.quotationNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{q.customer?.contactName}</p>
                    <p className="text-sm text-gray-500">{fmtMoney(q.totalAmount)} · Valid till {fmtDate(q.validUntil)}</p>
                    <div className="flex gap-3 mt-3">
                      <button onClick={() => downloadPDF(q.id, q.quotationNumber)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg font-medium">
                        <Download size={13} /> PDF
                      </button>
                      <button onClick={() => downloadDOCX(q.id, q.quotationNumber)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg font-medium">
                        <FileText size={13} /> DOCX
                      </button>
                      {isAdmin && q.status !== 'CONVERTED_TO_SALE' && (
                        <button onClick={() => handleConvert(q)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg font-medium">
                          <ArrowRight size={13} /> Convert to Sale
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {quotations.length} of {pagination.total} quotations
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchQuotations({ page: pagination.page - 1 })}
                className="p-1.5 border rounded disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchQuotations({ page: pagination.page + 1 })}
                className="p-1.5 border rounded disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </Layout>
  );
}
