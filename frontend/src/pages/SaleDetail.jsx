import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useSaleStore } from '../stores/saleStore';
import { useAuthStore } from '../stores/authStore';
import {
  ArrowLeft, Download, CreditCard, Calendar, CheckCircle2,
  Clock, Package, User, X, Plus, Loader2, IndianRupee,
  FileText, AlertCircle, BadgeCheck, RefreshCw
} from 'lucide-react';

/* ─── Constants ──────────────────────────────────────── */
const PAYMENT_STYLE = {
  UNPAID:  { cls: 'bg-red-100 text-red-700 border border-red-300',      label: 'Unpaid' },
  PARTIAL: { cls: 'bg-amber-100 text-amber-700 border border-amber-300', label: 'Partial' },
  PAID:    { cls: 'bg-emerald-100 text-emerald-700 border border-emerald-300', label: 'Paid' },
  OVERDUE: { cls: 'bg-orange-100 text-orange-700 border border-orange-300', label: 'Overdue' },
};

const STATUS_STYLE = {
  PENDING:     { cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200', label: 'Pending' },
  CONFIRMED:   { cls: 'bg-blue-100 text-blue-800 border border-blue-200',       label: 'Confirmed' },
  IN_PROGRESS: { cls: 'bg-indigo-100 text-indigo-800 border border-indigo-200', label: 'In Progress' },
  COMPLETED:   { cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200', label: 'Completed' },
  CANCELLED:   { cls: 'bg-red-100 text-red-800 border border-red-200',          label: 'Cancelled' },
};

const SALE_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const fmt  = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtD = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

/* ─── Status Badge ───────────────────────────────────── */
function Badge({ type, value }) {
  const map = type === 'payment' ? PAYMENT_STYLE : STATUS_STYLE;
  const s = map[value] || { cls: 'bg-gray-100 text-gray-600', label: value };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ─── Info Row ───────────────────────────────────────── */
function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */
export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentSale: sale, isLoading, getSale, recordPayment, updateSale } = useSaleStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '', paymentMethod: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '', notes: ''
  });
  const [paying, setPaying]     = useState(false);
  const [payError, setPayError] = useState('');

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Invoice download
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { getSale(id); }, [id]);

  /* ── Download Invoice ──────────────────────────── */
  const handleDownloadInvoice = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/sales/${id}/invoice`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `Invoice-${sale.saleNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download invoice. Try again.');
    }
    setDownloading(false);
  };

  /* ── Record Payment ────────────────────────────── */
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setPayError('');
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { setPayError('Enter a valid amount.'); return; }
    if (amt > Number(sale.balanceAmount) + 0.01) {
      setPayError(`Amount exceeds balance due: ${fmt(sale.balanceAmount)}`); return;
    }
    setPaying(true);
    const result = await recordPayment(id, { ...payForm, amount: amt });
    setPaying(false);
    if (result.success) {
      setShowPayModal(false);
      setPayForm({ amount: '', paymentMethod: 'UPI', paymentDate: new Date().toISOString().split('T')[0], referenceNumber: '', notes: '' });
    } else {
      setPayError(result.error || 'Failed to record payment.');
    }
  };

  /* ── Update Sale Status ────────────────────────── */
  const handleStatusChange = async (newStatus) => {
    if (newStatus === sale.status) return;
    setUpdatingStatus(true);
    setStatusMsg('');
    const result = await updateSale(id, { status: newStatus });
    setUpdatingStatus(false);
    if (result.success) {
      setStatusMsg('Status updated!');
      setTimeout(() => setStatusMsg(''), 2500);
    }
  };

  /* ── Loading / Not Found ───────────────────────── */
  if (isLoading && !sale) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={36} className="animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }
  if (!sale) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <AlertCircle size={40} className="text-gray-300" />
          <p className="text-gray-500 font-medium">Sale not found.</p>
          <button onClick={() => navigate('/sales')} className="text-sm text-emerald-600 hover:underline">← Back to Sales</button>
        </div>
      </Layout>
    );
  }

  const paidPct     = sale.totalAmount > 0 ? Math.min((Number(sale.paidAmount) / Number(sale.totalAmount)) * 100, 100) : 0;
  const isFullyPaid = sale.paymentStatus === 'PAID';
  const ps          = PAYMENT_STYLE[sale.paymentStatus] || PAYMENT_STYLE.UNPAID;
  const ss          = STATUS_STYLE[sale.status] || STATUS_STYLE.PENDING;

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales')} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{sale.saleNumber}</h1>
              <Badge type="status" value={sale.status} />
              <Badge type="payment" value={sale.paymentStatus} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Created {fmtD(sale.createdAt)} by {sale.createdBy?.firstName} {sale.createdBy?.lastName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isFullyPaid && (
            <button
              id="btn-record-payment"
              onClick={() => setShowPayModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <CreditCard size={16} /> Record Payment
            </button>
          )}
          <button
            id="btn-download-invoice"
            onClick={handleDownloadInvoice}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Invoice PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── LEFT: Main content ────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Payment progress strip */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <IndianRupee size={15} className="text-emerald-500" /> Payment Overview
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${ps.cls}`}>{ps.label}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Invoice Total', val: fmt(sale.totalAmount), color: 'text-gray-900' },
                { label: 'Amount Paid',  val: fmt(sale.paidAmount),   color: 'text-emerald-600 font-bold' },
                { label: 'Balance Due',  val: fmt(sale.balanceAmount), color: Number(sale.balanceAmount) > 0 ? 'text-red-600 font-bold' : 'text-emerald-600' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className={`text-sm font-bold ${color}`}>{val}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isFullyPaid ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-gray-400">
              <span>0%</span>
              <span className={`font-semibold ${isFullyPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                {paidPct.toFixed(1)}% paid
                {isFullyPaid && ' ✓ Fully Paid'}
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Order Status Update */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <RefreshCw size={15} className="text-blue-500" /> Sale Status
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isAdmin ? 'Update the operational status of this sale order' : 'Current status of this sale order'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <select
                    value={sale.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className={`px-3 py-2 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-colors ${ss.cls}`}
                  >
                    {SALE_STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_STYLE[s]?.label || s}</option>
                    ))}
                  </select>
                ) : (
                  <Badge type="status" value={sale.status} />
                )}
                {updatingStatus && <Loader2 size={16} className="animate-spin text-blue-500" />}
                {statusMsg && <span className="text-xs text-emerald-600 font-semibold">{statusMsg}</span>}
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package size={16} className="text-emerald-500" />
              <h2 className="font-semibold text-sm text-gray-700">Products / Line Items</h2>
              <span className="ml-auto text-xs text-gray-400">{sale.items?.length} item{sale.items?.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    {['#', 'Product', 'Qty', 'Unit Price', 'Disc%', 'GST%', 'Total'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sale.items?.map((item, i) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{item.product?.name}</div>
                        {item.description && (
                          <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {item.quantity} <span className="text-gray-400 text-xs">{item.product?.unitOfMeasure}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmt(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.discount}%</td>
                      <td className="px-4 py-3 text-gray-600">{item.taxRate}%</td>
                      <td className="px-4 py-3 font-bold text-gray-900">{fmt(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-100 text-sm">
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-gray-500">Sub Total</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{fmt(sale.subTotal)}</td>
                  </tr>
                  {Number(sale.discountAmount) > 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-1.5 text-right text-red-500 text-xs">Discount</td>
                      <td className="px-4 py-1.5 text-red-500 text-xs font-medium">−{fmt(sale.discountAmount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={6} className="px-4 py-1.5 text-right text-xs text-gray-500">CGST + SGST (18%)</td>
                    <td className="px-4 py-1.5 text-xs text-gray-700">{fmt(sale.taxAmount)}</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan={6} className="px-4 py-3 text-right font-bold text-emerald-700 text-base">Grand Total</td>
                    <td className="px-4 py-3 font-bold text-emerald-700 text-base">{fmt(sale.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={13} /> Notes / Terms
              </h3>
              <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar panels ─────────────────────── */}
        <div className="space-y-5">

          {/* Customer info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User size={13} /> Customer
            </h3>
            <p className="font-bold text-gray-900">{sale.customer?.contactName}</p>
            {sale.customer?.companyName && (
              <p className="text-sm text-gray-600 mt-0.5">{sale.customer.companyName}</p>
            )}
            <div className="mt-3 space-y-1">
              <InfoRow label="Phone" value={sale.customer?.phone} />
              <InfoRow label="Email" value={sale.customer?.email} />
              <InfoRow label="GST"   value={sale.customer?.gstNumber} />
              <InfoRow label="City"  value={[sale.customer?.city, sale.customer?.state].filter(Boolean).join(', ')} />
            </div>
          </div>

          {/* Sale details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Calendar size={13} /> Sale Details
            </h3>
            <div className="space-y-1">
              <InfoRow label="Sale Date"  value={fmtD(sale.saleDate)} />
              <InfoRow label="Created By" value={`${sale.createdBy?.firstName} ${sale.createdBy?.lastName}`} />
              {sale.quotation && (
                <InfoRow label="Quotation" value={sale.quotation.quotationNumber} />
              )}
            </div>
          </div>

          {/* Payment history */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Payment History
            </h3>

            {sale.payments?.length === 0 ? (
              <div className="text-center py-5">
                <CreditCard size={28} className="mx-auto mb-2 text-gray-200" />
                <p className="text-xs text-gray-400">No payments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sale.payments.map((p) => (
                  <div key={p.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-emerald-700">{fmt(p.amount)}</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">{p.paymentMethod}</span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div>{fmtD(p.paymentDate)}</div>
                      {p.referenceNumber && <div className="font-mono">Ref: {p.referenceNumber}</div>}
                      {p.notes && <div className="italic">{p.notes}</div>}
                    </div>
                    {p.receiptUrl && (
                      <a
                        href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${p.receiptUrl}`}
                        target="_blank" rel="noreferrer"
                        className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        <Download size={11} /> Download Receipt
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isFullyPaid && (
              <button
                onClick={() => setShowPayModal(true)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-xl transition-colors font-medium"
              >
                <Plus size={15} /> Record Payment
              </button>
            )}

            {isFullyPaid && (
              <div className="mt-3 flex items-center justify-center gap-2 py-2.5 text-sm text-emerald-600 bg-emerald-50 rounded-xl font-semibold">
                <BadgeCheck size={16} /> Fully Paid
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment Modal ─────────────────────────────── */}
      {showPayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowPayModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ animation: 'slideUp .25s cubic-bezier(.34,1.56,.64,1)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
              <div>
                <h2 className="font-bold text-gray-900 text-base">Record Payment</h2>
                <p className="text-xs text-gray-500 mt-0.5">Balance due: <span className="font-semibold text-red-600">{fmt(sale.balanceAmount)}</span></p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              {payError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {payError}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Amount Received (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                  <input
                    type="number" min="0.01" step="0.01" required
                    value={payForm.amount}
                    placeholder={Number(sale.balanceAmount).toFixed(2)}
                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    onFocus={e => e.target.select()}
                    autoFocus
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                {/* Quick-fill buttons */}
                <div className="flex gap-2 mt-1.5">
                  {[25, 50, 100].map(pct => {
                    const quickAmt = ((Number(sale.balanceAmount) * pct) / 100).toFixed(2);
                    return (
                      <button
                        key={pct} type="button"
                        onClick={() => setPayForm(f => ({ ...f, amount: quickAmt }))}
                        className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-gray-500 font-medium transition-colors"
                      >
                        {pct}% ({fmt(quickAmt)})
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPayForm(f => ({ ...f, amount: Number(sale.balanceAmount).toFixed(2) }))}
                    className="px-2 py-1 text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg font-semibold transition-colors"
                  >
                    Full
                  </button>
                </div>
              </div>

              {/* Method + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Payment Method *</label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  >
                    {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'NEFT', 'RTGS'].map(m => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Payment Date *</label>
                  <input
                    type="date" required
                    value={payForm.paymentDate}
                    onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Reference / UTR Number</label>
                <input
                  value={payForm.referenceNumber}
                  onChange={e => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  placeholder="Optional (e.g. UTR123456)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
                <textarea
                  rows={2} value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit" disabled={paying}
                  id="btn-confirm-payment"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                >
                  {paying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  {paying ? 'Saving…' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: scale(.95) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </Layout>
  );
}
